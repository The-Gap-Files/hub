/**
 * format-qa-for-architect.ts
 *
 * Pure function that maps Retention QA scene-level analysis
 * into structural, prescriptive feedback for the Story Architect.
 *
 * The Architect receives this as userNotes feedback and regenerates
 * the outline with corrected beats, tension curve, and hook strategy.
 */

import type { StoryOutline } from '../services/story-architect.service'

// ─── Input types (loose, compatible with RetentionQAResult from DB) ───

interface SceneAnalysisInput {
  sceneOrder: number
  retentionScore: number
  riskFlags: string[]
  suggestions: string[]
}

interface RetentionQAInput {
  overallScore: number
  summary: string
  sceneAnalysis: SceneAnalysisInput[]
}

// ─── Internal types ───────────────────────────────────────────────────

interface BeatMapping {
  beatOrder: number
  revelation: string
  scenes: SceneAnalysisInput[]
  avgScore: number
  dominantRisk: string | null
}

interface SegmentAnalysis {
  segment: string
  sceneStart: number
  sceneEnd: number
  scenes: SceneAnalysisInput[]
  avgScore: number
  riskFlags: Record<string, number>
  beatMappings?: BeatMapping[]
}

interface DeadZone {
  start: number
  end: number
  segment: string
  avgScore: number
  relatedBeats: number[]
}

// ─── Helpers ──────────────────────────────────────────────────────────

function aggregateRiskFlags(scenes: SceneAnalysisInput[]): Record<string, number> {
  const flags: Record<string, number> = {}
  for (const scene of scenes) {
    for (const flag of (scene.riskFlags || [])) {
      flags[flag] = (flags[flag] || 0) + 1
    }
  }
  return flags
}

function avgScore(scenes: SceneAnalysisInput[]): number {
  if (scenes.length === 0) return 0
  return scenes.reduce((sum, s) => sum + s.retentionScore, 0) / scenes.length
}

/**
 * Maps scene indices to outline segments using segmentDistribution.
 * Same algorithm as photographer.service.ts:buildSceneNarrativeAnnotations()
 */
function mapScenesToSegments(
  qa: RetentionQAInput,
  outline: StoryOutline
): SegmentAnalysis[] {
  const dist = outline.segmentDistribution
  if (!dist) return []

  const segments = [
    { name: 'HOOK', count: dist.hook },
    { name: 'CONTEXT', count: dist.context },
    { name: 'RISING', count: dist.rising },
    { name: 'CLIMAX', count: dist.climax },
    { name: 'RESOLUTION', count: dist.resolution },
    { name: 'CTA', count: dist.cta },
  ]

  const sorted = [...qa.sceneAnalysis].sort((a, b) => a.sceneOrder - b.sceneOrder)
  const result: SegmentAnalysis[] = []
  let sceneIdx = 0

  for (const seg of segments) {
    const start = sceneIdx
    const end = sceneIdx + seg.count
    const scenesInSegment = sorted.filter(
      s => s.sceneOrder >= start && s.sceneOrder < end
    )

    let beatMappings: BeatMapping[] | undefined
    if (seg.name === 'RISING' && outline.risingBeats?.length > 0) {
      beatMappings = mapRisingScenesToBeats(scenesInSegment, outline.risingBeats, seg.count, start)
    }

    result.push({
      segment: seg.name,
      sceneStart: start,
      sceneEnd: end,
      scenes: scenesInSegment,
      avgScore: avgScore(scenesInSegment),
      riskFlags: aggregateRiskFlags(scenesInSegment),
      beatMappings,
    })

    sceneIdx = end
  }

  return result
}

/**
 * Maps RISING scenes to specific risingBeats using proportional distribution.
 * Adapted from photographer.service.ts:buildSceneNarrativeAnnotations()
 */
function mapRisingScenesToBeats(
  scenes: SceneAnalysisInput[],
  beats: StoryOutline['risingBeats'],
  risingCount: number,
  risingStartIdx: number
): BeatMapping[] {
  const beatBuckets = new Map<number, SceneAnalysisInput[]>()

  for (const scene of scenes) {
    const relativeIdx = scene.sceneOrder - risingStartIdx
    if (relativeIdx < 0 || relativeIdx >= risingCount) continue
    const beatIdx = Math.min(
      Math.floor((relativeIdx / risingCount) * beats.length),
      beats.length - 1
    )
    const existing = beatBuckets.get(beatIdx) || []
    existing.push(scene)
    beatBuckets.set(beatIdx, existing)
  }

  return beats.map((beat, idx) => {
    const scenesInBeat = beatBuckets.get(idx) || []
    const flags = aggregateRiskFlags(scenesInBeat)
    const dominantRisk = Object.entries(flags)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null

    return {
      beatOrder: beat.order,
      revelation: beat.revelation,
      scenes: scenesInBeat,
      avgScore: avgScore(scenesInBeat),
      dominantRisk,
    }
  })
}

/**
 * Finds dead zones: 3+ consecutive scenes with score < 5.
 */
function findDeadZones(
  qa: RetentionQAInput,
  segmentAnalyses: SegmentAnalysis[]
): DeadZone[] {
  const sorted = [...qa.sceneAnalysis].sort((a, b) => a.sceneOrder - b.sceneOrder)
  const zones: DeadZone[] = []
  let streak: SceneAnalysisInput[] = []

  const flushStreak = () => {
    if (streak.length >= 3) {
      const start = streak[0]!.sceneOrder
      const end = streak[streak.length - 1]!.sceneOrder
      const seg = segmentAnalyses.find(
        s => start >= s.sceneStart && start < s.sceneEnd
      )
      const relatedBeats = seg?.beatMappings
        ?.filter(b => b.scenes.some(s => s.sceneOrder >= start && s.sceneOrder <= end))
        .map(b => b.beatOrder) || []

      zones.push({
        start,
        end,
        segment: seg?.segment || 'UNKNOWN',
        avgScore: avgScore(streak),
        relatedBeats,
      })
    }
    streak = []
  }

  for (const scene of sorted) {
    if (scene.retentionScore < 5) {
      streak.push(scene)
    } else {
      flushStreak()
    }
  }
  flushStreak()

  return zones
}

// ─── Risk flag labels ─────────────────────────────────────────────────

const riskFlagLabels: Record<string, string> = {
  slow: 'ritmo lento',
  expository: 'exposição sem emoção',
  confusing: 'confuso/denso demais',
  low_energy: 'baixa energia',
  redundant: 'redundante',
}

const riskFlagCorrections: Record<string, string> = {
  expository: 'A revelação é DECLARATIVA/GENÉRICA. Reformule como AÇÃO CONCRETA com dado numérico, nome próprio ou evento datado.',
  slow: 'Ritmo lento. O beat precisa de TENSÃO CRESCENTE. Adicione questionAnswered mais provocativo ou newQuestion mais urgente.',
  redundant: 'Beat REDUNDANTE com outro. Substitua por fato NOVO que não aparece em nenhum outro beat.',
  low_energy: 'Baixa energia. Insira contraste ou dado chocante. Considere fundir com o beat anterior ou posterior.',
  confusing: 'Conteúdo confuso/denso. Simplifique a revelação para UMA ideia clara com consequência tangível.',
}

// ─── Main function ────────────────────────────────────────────────────

/**
 * Converts Retention QA scene-level analysis into structural feedback
 * for the Story Architect. The output is injected as userNotes feedback
 * when regenerating the outline.
 */
export function formatRetentionQAForArchitect(
  qa: RetentionQAInput,
  outline: StoryOutline
): string {
  if (!qa?.sceneAnalysis?.length || !outline?.segmentDistribution) {
    return ''
  }

  const segmentAnalyses = mapScenesToSegments(qa, outline)
  const deadZones = findDeadZones(qa, segmentAnalyses)
  const lines: string[] = []

  lines.push(`🔬 DIAGNÓSTICO ESTRUTURAL DO RETENTION QA (Score geral: ${qa.overallScore}/10)`)
  if (qa.summary) lines.push(`Resumo: ${qa.summary}`)
  lines.push('')

  // ── HOOK ────────────────────────────────────────────────────────────
  const hookSeg = segmentAnalyses.find(s => s.segment === 'HOOK')
  if (hookSeg && hookSeg.scenes.length > 0 && hookSeg.avgScore < 7) {
    const flagsStr = Object.entries(hookSeg.riskFlags)
      .map(([f, c]) => `${riskFlagLabels[f] || f}(${c}x)`)
      .join(', ')
    lines.push(`🚨 HOOK FRACO (cenas ${hookSeg.sceneStart}-${hookSeg.sceneEnd - 1}, avg ${hookSeg.avgScore.toFixed(1)}/10):`)
    lines.push(`  hookStrategy atual: "${outline.hookStrategy.slice(0, 100)}"`)
    if (flagsStr) lines.push(`  Riscos: ${flagsStr}`)
    lines.push(`  → CORREÇÃO: Reescreva hookStrategy com técnica mais agressiva.`)
    lines.push(`  → Reformule hookVariants com dado/imagem concretos nos primeiros 2 segundos.`)
    lines.push(`  → Score alvo: 8+. Se precisar, mude o shockContrastBeat.`)
    lines.push('')
  }

  // ── RISING BEATS (per beat) ─────────────────────────────────────────
  const risingSeg = segmentAnalyses.find(s => s.segment === 'RISING')
  if (risingSeg?.beatMappings) {
    const weakBeats = risingSeg.beatMappings.filter(b => b.avgScore < 6 && b.scenes.length > 0)
    if (weakBeats.length > 0) {
      lines.push(`⚠️ BEATS FRACOS NO RISING ACTION (${weakBeats.length} de ${risingSeg.beatMappings.length}):`)
      for (const beat of weakBeats) {
        const sceneNums = beat.scenes.map(s => s.sceneOrder).join(', ')
        lines.push(`  Beat ${beat.beatOrder} ("${beat.revelation.slice(0, 70)}") → cenas [${sceneNums}] avg ${beat.avgScore.toFixed(1)}/10`)
        if (beat.dominantRisk && riskFlagCorrections[beat.dominantRisk]) {
          lines.push(`    → ${riskFlagCorrections[beat.dominantRisk]}`)
        }
      }
      lines.push('')
    }
  }

  // ── CLIMAX ──────────────────────────────────────────────────────────
  const climaxSeg = segmentAnalyses.find(s => s.segment === 'CLIMAX')
  if (climaxSeg && climaxSeg.scenes.length > 0 && climaxSeg.avgScore < 7) {
    lines.push(`🎯 CLÍMAX FRACO (avg ${climaxSeg.avgScore.toFixed(1)}/10):`)
    if (outline.climaxMoment) lines.push(`  climaxMoment: "${outline.climaxMoment.slice(0, 100)}"`)
    if (outline.climaxFormula) lines.push(`  climaxFormula: ${outline.climaxFormula}`)
    lines.push(`  → CORREÇÃO: Reformule climaxMoment com FATO ESPECÍFICO que recontextualiza tudo.`)
    lines.push(`  → Considere trocar climaxFormula se a atual não encaixa com o material.`)
    lines.push('')
  }

  // ── TENSION CURVE ───────────────────────────────────────────────────
  if (outline.tensionCurve?.length > 0 && qa.overallScore < 7) {
    const hasPauseBeforePeak = outline.tensionCurve.some((level, i) =>
      level === 'pause' && i + 1 < outline.tensionCurve.length && outline.tensionCurve[i + 1] === 'peak'
    )
    const hasAnyPause = outline.tensionCurve.includes('pause')

    if (!hasPauseBeforePeak) {
      lines.push(`📉 CURVA DE TENSÃO SEM CONTRASTE:`)
      lines.push(`  tensionCurve atual: [${outline.tensionCurve.join(' → ')}]`)
      if (!hasAnyPause) {
        lines.push(`  → CORREÇÃO: Insira "pause" (~75% do vídeo, antes do "peak") para criar Dark Moment.`)
      } else {
        lines.push(`  → CORREÇÃO: Mova o "pause" para imediatamente antes do "peak" — o contraste faz o clímax parecer mais intenso.`)
      }
      lines.push(`  → Intensidade linear = fadiga cognitiva. Ondas = retenção.`)
      lines.push('')
    }
  }

  // ── DEAD ZONES ──────────────────────────────────────────────────────
  if (deadZones.length > 0) {
    lines.push(`☠️ ZONAS MORTAS (3+ cenas consecutivas score < 5):`)
    for (const zone of deadZones) {
      lines.push(`  Cenas ${zone.start}-${zone.end} (segmento: ${zone.segment}, avg: ${zone.avgScore.toFixed(1)}/10)`)
      if (zone.relatedBeats.length > 0) {
        lines.push(`    → Beats afetados: ${zone.relatedBeats.map(b => `#${b}`).join(', ')}`)
        lines.push(`    → Reestruture estes beats com micro-revelações ou funda com beats adjacentes.`)
      }
    }
    lines.push('')
  }

  // ── MINI-CLIMAX BEATS (ausentes ou insuficientes) ───────────────────
  if (risingSeg && risingSeg.avgScore < 6) {
    const hasMiniClimax = outline.miniClimaxBeats && outline.miniClimaxBeats.length > 0
    if (!hasMiniClimax) {
      lines.push(`⚡ MINICLIMAXBEATS AUSENTES:`)
      lines.push(`  O RISING ACTION tem avg ${risingSeg.avgScore.toFixed(1)}/10 sem micro-revelações.`)
      lines.push(`  → CORREÇÃO: Adicione 2-4 miniClimaxBeats distribuídos a cada 8-12 cenas.`)
      lines.push(`  → Cada um deve ter uma revelação parcial que reativa curiosidade.`)
      lines.push('')
    }
  }

  // ── RESOLUTION ──────────────────────────────────────────────────────
  const resSeg = segmentAnalyses.find(s => s.segment === 'RESOLUTION')
  if (resSeg && resSeg.scenes.length > 0 && resSeg.avgScore < 5) {
    lines.push(`📉 RESOLUÇÃO COM ENERGIA BAIXA (avg ${resSeg.avgScore.toFixed(1)}/10):`)
    lines.push(`  → CORREÇÃO: resolutionPoints precisam ser mais INCISIVOS.`)
    lines.push(`  → Use dados concretos no recap, não resumo genérico.`)
    lines.push('')
  }

  // ── GOOD SEGMENTS (preserve) ────────────────────────────────────────
  const goodSegments = segmentAnalyses.filter(s => s.scenes.length > 0 && s.avgScore >= 7)
  if (goodSegments.length > 0) {
    lines.push(`✅ SEGMENTOS BEM AVALIADOS — PRESERVAR:`)
    for (const seg of goodSegments) {
      lines.push(`  ${seg.segment} (cenas ${seg.sceneStart}-${seg.sceneEnd - 1}, avg ${seg.avgScore.toFixed(1)}/10)`)
    }
    lines.push('')
  }

  // ── FINAL INSTRUCTION ───────────────────────────────────────────────
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  lines.push(`INSTRUÇÃO PARA O ARQUITETO:`)
  lines.push(`Corrija os pontos acima MANTENDO o que funcionou (segmentos com avg >= 7).`)
  lines.push(`Priorize: 1) Hook 2) Beats fracos no RISING 3) Curva de tensão 4) Dead zones`)
  lines.push(`NÃO reescreva o outline inteiro — faça correções CIRÚRGICAS nos pontos problemáticos.`)
  lines.push(`Cada beat corrigido deve ter: dado concreto OU ação específica OU pergunta impossível.`)

  return lines.join('\n')
}
