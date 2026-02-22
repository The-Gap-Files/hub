/**
 * Photographer Service (Agente Fotógrafo)
 *
 * Primeiro agente do pipeline de 3:
 * Fotógrafo → Coreógrafo → Cineasta
 *
 * Gera `visualDescription` (start image prompt) com qualidade fotográfica:
 * lente, DOF, iluminação, texturas, coerência temporal, progressão narrativa.
 */

import { createLlmForTask } from '../llm/llm-factory'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createPipelineLogger } from '../../utils/pipeline-logger'
import type { SceneInput, ProductionContext, PhotographerOutput } from './filmmaker.types'
import type { StoryOutline } from '../story-architect.service'
import fs from 'node:fs/promises'
import path from 'node:path'

const LOG_STAGE = 'Photographer'

export class PhotographerService {

  private async loadSkill(): Promise<string> {
    const skillPath = path.resolve(process.cwd(), 'server/skills/photographer.md')
    try {
      return await fs.readFile(skillPath, 'utf-8')
    } catch {
      console.warn(`[${LOG_STAGE}] ⚠️ photographer.md não encontrado, usando fallback.`)
      return 'You are an expert still photographer for cinematic AI image generation. Generate rich visualDescription prompts (50-120 words) with lens, DOF, lighting, textures.'
    }
  }

  /**
   * Extrai pistas temporais (década, ano, período) do tema do dossiê.
   */
  private extractTemporalHint(theme: string): string | undefined {
    const patterns = [
      /anos\s*(\d{4})/i,
      /década\s*de\s*(\d{2,4})/i,
      /(\d{4})\s*[-–a]\s*(\d{4})/,
      /(\d{4})s/,
      /in\s+the\s+(\d{4})s/i,
      /(?:year|ano)\s+(\d{4})/i,
      /século\s+(X{0,3}(?:IX|IV|V?I{0,3}))/i,
      /(\d{4})/,
    ]
    for (const pattern of patterns) {
      const match = theme.match(pattern)
      if (match) {
        const raw = match[0]
        const yearMatch = raw.match(/(\d{4})/)
        if (yearMatch) {
          const year = parseInt(yearMatch[1]!)
          if (year >= 1800 && year <= 2030) {
            const decade = Math.floor(year / 10) * 10
            return `década de ${decade} (${raw})`
          }
        }
        const shortDecade = raw.match(/(\d{2})/)
        if (shortDecade) {
          const dec = parseInt(shortDecade[1]!)
          if (dec >= 50 && dec <= 99) return `década de 19${dec} (${raw})`
          if (dec >= 0 && dec <= 30) return `década de 20${String(dec).padStart(2, '0')} (${raw})`
        }
        return raw
      }
    }
    return undefined
  }

  /**
   * Monta Production Awareness para o system prompt do Fotógrafo.
   * Inclui: contexto temporal, style anchor, visual identity, narrative awareness.
   */
  private buildProductionAwareness(production?: ProductionContext): string {
    if (!production) return ''

    const sections: string[] = []

    if (production.theme) {
      const temporalHint = this.extractTemporalHint(production.theme)
      sections.push(`[TEMPORAL CONTEXT — época e cenário do assunto]
Tema: "${production.theme}"${temporalHint ? `\nPeríodo detectado: ${temporalHint}` : ''}
→ TODOS os elementos visuais DEVEM ser period-accurate para esta época/contexto.
→ Checklist: veículos, tecnologia, vestuário, arquitetura, sinalização, mobiliário, iluminação.
→ Se o tema menciona uma década/ano, NENHUM elemento visual pode ser de época posterior.`)
    }

    if (production.styleAnchorTags) {
      sections.push(`[STYLE ANCHOR — já aplicado pelo pipeline ao prompt final de imagem]
"${production.styleAnchorTags}"
→ NÃO repita essas tags no visualDescription. Elas já serão injetadas como prefixo.
→ Foque em parâmetros COMPLEMENTARES: lente, distância focal, DOF, origem da luz, texturas.`)
    }

    if (production.visualIdentity) {
      sections.push(`[VISUAL IDENTITY — diretrizes do universo/dossiê]
"${production.visualIdentity}"
→ Incorpore organicamente nas descrições visuais (período, materialidade, paleta).`)
    }

    const narrativeBlock = production.storyOutline
      ? this.buildNarrativeAwareness(production.storyOutline)
      : ''

    if (sections.length === 0 && !narrativeBlock) return ''

    return `\n───────────────────────────────────────────
PRODUCTION AWARENESS (contexto do pipeline):
${sections.join('\n\n')}
───────────────────────────────────────────${narrativeBlock}`
  }

  private buildNarrativeAwareness(outline: StoryOutline): string {
    const lines: string[] = [
      ``,
      `───────────────────────────────────────────`,
      `NARRATIVE AWARENESS:`,
      `[ARCO EMOCIONAL]    : ${outline.emotionalArc || 'Não definido'}`,
      `[PROGRESSÃO DE TOM] : ${outline.toneProgression || 'Não definido'}`,
      `[FÓRMULA DO CLÍMAX] : ${outline.climaxFormula || 'Não definido'}`,
      `[MOMENTO DE CLÍMAX] : ${(outline.climaxMoment || 'Revelação central').slice(0, 100)}`,
      `[RESOLUÇÃO]         : ${outline.resolutionLevel || 'full'}`,
      ``,
      `Guia de Intensidade Visual por Segmento:`,
      `  HOOK       → Alta intensidade. Ruptura visual imediata.`,
      `  CONTEXT    → Baixa-média. Planos abertos, luz natural.`,
      `  RISING     → Progressão. Siga a tensão cena a cena.`,
      `  CLIMAX     → PICO ABSOLUTO. Máximo contraste.`,
      `  RESOLUTION → Redução gradual. Aterramento emocional.`,
      `  CTA        → Mínima. Limpa. Não distrai.`,
    ]

    if (outline.tensionCurve && outline.tensionCurve.length > 0) {
      lines.push(``)
      lines.push(`Tension Curve (seção RISING):`)
      lines.push(outline.tensionCurve.map((level, i) => `  Beat ${i + 1}: ${level.toUpperCase()}`).join('\n'))
    }

    lines.push(`───────────────────────────────────────────`)
    return lines.join('\n')
  }

  /**
   * Anotações narrativas por cena (segmento, tensão, contexto do beat).
   */
  private buildSceneNarrativeAnnotations(
    outline: StoryOutline,
    totalScenes: number
  ): Array<{ segment: string; tensionLevel: string; note: string }> {
    const dist = outline.segmentDistribution
    if (!dist) return []

    const segments = [
      { name: 'HOOK', count: dist.hook, defaultTension: 'high' },
      { name: 'CONTEXT', count: dist.context, defaultTension: 'low' },
      { name: 'RISING', count: dist.rising, defaultTension: 'medium' },
      { name: 'CLIMAX', count: dist.climax, defaultTension: 'peak' },
      { name: 'RESOLUTION', count: dist.resolution, defaultTension: 'medium' },
      { name: 'CTA', count: dist.cta, defaultTension: 'low' }
    ]

    const annotations: Array<{ segment: string; tensionLevel: string; note: string }> = []
    const tensionCurve = outline.tensionCurve || []
    const risingBeats = outline.risingBeats || []
    const risingCount = dist.rising

    for (const seg of segments) {
      for (let i = 0; i < seg.count; i++) {
        if (annotations.length >= totalScenes) break
        let tension = seg.defaultTension
        let note = seg.name

        if (seg.name === 'HOOK') {
          note = `HOOK — ${(outline.hookStrategy || 'Opening impact').slice(0, 80)}`
        } else if (seg.name === 'RISING' && risingCount > 0) {
          const beatIdx = tensionCurve.length > 0
            ? Math.min(Math.floor((i / risingCount) * tensionCurve.length), tensionCurve.length - 1)
            : -1
          if (beatIdx >= 0 && tensionCurve[beatIdx]) tension = tensionCurve[beatIdx]
          const beat = risingBeats[Math.min(beatIdx >= 0 ? beatIdx : 0, risingBeats.length - 1)]
          note = beat
            ? `RISING beat ${beat.order}: "${beat.revelation.slice(0, 70)}"`
            : `RISING — scene ${i + 1}/${risingCount}`
        } else if (seg.name === 'CLIMAX') {
          note = `CLIMAX (${outline.climaxFormula || 'peak'}) — ${(outline.climaxMoment || 'Central revelation').slice(0, 80)}`
        } else if (seg.name === 'RESOLUTION') {
          const rl = outline.resolutionLevel
          note = `RESOLUTION — ${rl === 'none' ? 'ZERO resolution' : rl === 'partial' ? 'Partial resolution' : 'Full resolution'}`
        } else if (seg.name === 'CTA') {
          note = `CTA — ${(outline.ctaApproach || 'Closing').slice(0, 60)}`
        }
        annotations.push({ segment: seg.name, tensionLevel: tension, note })
      }
    }

    while (annotations.length < totalScenes) {
      annotations.push({ segment: 'EXTRA', tensionLevel: 'low', note: 'Overflow scene — treat as CTA/closing' })
    }

    return annotations
  }

  /**
   * Monta continuidade visual (cenas que compartilham ambiente).
   */
  private buildContinuityContext(scenes: SceneInput[]): string {
    const envGroups = new Map<string, number[]>()
    scenes.forEach((s, i) => {
      if (s.currentEnvironment) {
        const group = envGroups.get(s.currentEnvironment) || []
        group.push(i)
        envGroups.set(s.currentEnvironment, group)
      }
    })

    const sharedEnvs = [...envGroups.entries()].filter(([, indices]) => indices.length > 1)
    if (sharedEnvs.length === 0) return ''

    const envList = sharedEnvs.map(([env, indices]) =>
      `- "${env}": cenas ${indices.join(', ')}`
    ).join('\n')

    return `
CONTINUIDADE VISUAL (cenas no mesmo ambiente):
${envList}
→ Mesmo ambiente = mesma lente, temperatura de cor, materiais, origem de luz.
→ Varie apenas: ângulo, enquadramento, foreground, elementos dinâmicos.`
  }

  /**
   * Refina as cenas gerando visualDescription via LLM.
   */
  async refine(
    scenes: SceneInput[],
    baseStyle: string,
    production?: ProductionContext
  ): Promise<PhotographerOutput[]> {
    const log = createPipelineLogger({ stage: LOG_STAGE, outputId: 'photographer' })

    const skillContent = await this.loadSkill()
    const productionAwareness = this.buildProductionAwareness(production)

    const systemPrompt = `${skillContent}

───────────────────────────────────────────
ESTILO VISUAL BASE (USE COMO PRIMEIRO ELEMENTO):
"${baseStyle}"
───────────────────────────────────────────
${productionAwareness}`

    const narrativeAnnotations = production?.storyOutline
      ? this.buildSceneNarrativeAnnotations(production.storyOutline, scenes.length)
      : null

    const continuityContext = this.buildContinuityContext(scenes)

    const userPrompt = `CENAS DO ROTEIRO PARA FOTOGRAFAR:

${JSON.stringify(
  scenes.map((s, i) => {
    const ann = narrativeAnnotations?.[i]
    return {
      order: i,
      ...(ann ? {
        narrativeSegment: ann.segment,
        tensionLevel: ann.tensionLevel,
        narrativeNote: ann.note
      } : {}),
      narration: s.narration,
      environment: s.currentEnvironment || null,
      durationSeconds: s.estimatedDuration
    }
  }),
  null,
  2
)}
${continuityContext}
${production?.customSceneReferences && production.customSceneReferences.length > 0
  ? `\n🎬 IMAGENS DE REFERÊNCIA DO CRIADOR:
${production.customSceneReferences.map(ref => {
  const promptNote = ref.imagePrompt ? ` | Prompt original: "${ref.imagePrompt}"` : ''
  return `- Cena ${ref.sceneOrder}: "${ref.description}"${promptNote} → Seu visualDescription DEVE incorporar elementos desta referência.`
}).join('\n')}`
  : ''}

TAREFA:
Para CADA cena, escreva o visualDescription — o prompt completo para gerar a imagem INICIAL da cena (em inglês).

Retorne APENAS um JSON válido (sem markdown, sem explicações):
{
  "scenes": [
    { "order": 0, "visualDescription": "...", "sceneEnvironment": "..." }
  ]
}`

    log.info(`📸 Chamando LLM para fotografar ${scenes.length} cenas...`)
    const llm = await createLlmForTask('photographer', { temperature: 0.7, maxTokens: 40000 })

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ])

    const rawText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    try {
      const cleanJson = rawText.replace(/```json\n?|```/g, '').trim()
      const parsed = JSON.parse(cleanJson) as { scenes: PhotographerOutput[] }

      if (!Array.isArray(parsed.scenes)) {
        throw new Error('Formato inválido: "scenes" não é array.')
      }

      log.info(`✅ Fotógrafo retornou ${parsed.scenes.length} cenas.`)
      return parsed.scenes
    } catch (error) {
      console.error(`[${LOG_STAGE}] Falha ao parsear JSON:`, error)
      console.error(`[${LOG_STAGE}] Raw (500 chars):`, rawText.slice(0, 500))

      // Fallback: retorna cenas originais sem alteração
      return scenes.map((s, i) => ({
        order: i,
        visualDescription: s.currentVisual || '',
        sceneEnvironment: s.currentEnvironment
      }))
    }
  }
}

export const photographer = new PhotographerService()
