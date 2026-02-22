/**
 * Choreographer Service (Agente Coreógrafo)
 *
 * Segundo agente do pipeline de 3:
 * Fotógrafo → Coreógrafo → Cineasta
 *
 * Gera `motionDescription` (coreografia de câmera) calibrada à duração,
 * com anti-monotonia e vocabulário seguro para WanVideo.
 *
 * Recebe `visualDescription` do Fotógrafo como input fixo para referenciar
 * elementos do cenário no motion.
 */

import { createLlmForTask } from '../llm/llm-factory'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createPipelineLogger } from '../../utils/pipeline-logger'
import type { SceneInput, ProductionContext, ChoreographerOutput } from './filmmaker.types'
import type { StoryOutline } from '../story-architect.service'
import fs from 'node:fs/promises'
import path from 'node:path'

const LOG_STAGE = 'Choreographer'

export class ChoreographerService {

  private async loadSkill(): Promise<string> {
    const skillPath = path.resolve(process.cwd(), 'server/skills/choreographer.md')
    try {
      return await fs.readFile(skillPath, 'utf-8')
    } catch {
      console.warn(`[${LOG_STAGE}] ⚠️ choreographer.md não encontrado, usando fallback.`)
      return 'You are an expert camera movement director for AI video generation. Generate motionDescription calibrated to scene duration. Prohibited: zoom, handheld, wobble, shake, fast, quick, truck.'
    }
  }

  /**
   * Extrai tipo primário de movimento para validação.
   */
  private extractPrimaryMovement(motion: string): string {
    const movements = [
      'static', 'push-in', 'dolly forward', 'dolly in',
      'pull-back', 'dolly backward', 'dolly out',
      'pan left', 'pan right', 'pan',
      'tilt up', 'tilt down', 'tilt',
      'lateral slide', 'rack focus', 'breathing camera',
      'deliberate freeze', 'freeze'
    ]
    for (const m of movements) {
      if (motion.includes(m)) return m
    }
    return 'unknown'
  }

  /**
   * Valida output do coreógrafo: palavras proibidas, monotonia, push-in %.
   */
  private validateOutput(scenes: ChoreographerOutput[]): { warnings: string[] } {
    const warnings: string[] = []
    const forbiddenMotion = ['zoom', 'handheld', 'wobble', 'shake', 'tremor', 'truck', 'fast', 'quick', 'rapid', 'swift']

    let pushInCount = 0
    let consecutiveSameMovement = 1
    let lastMovementType = ''
    const motionSet = new Set<string>()

    for (const scene of scenes) {
      const motion = (scene.motionDescription || '').toLowerCase()

      for (const word of forbiddenMotion) {
        if (motion.includes(word)) {
          warnings.push(`Cena ${scene.order}: motionDescription contém termo proibido "${word}"`)
        }
      }

      if (motion.includes('push-in') || motion.includes('dolly in') || motion.includes('dolly forward')) {
        pushInCount++
      }

      const movementType = this.extractPrimaryMovement(motion)
      if (movementType === lastMovementType && movementType !== '' && movementType !== 'unknown') {
        consecutiveSameMovement++
        if (consecutiveSameMovement > 2) {
          warnings.push(`Cena ${scene.order}: mesmo movimento "${movementType}" por ${consecutiveSameMovement} cenas consecutivas (max 2)`)
        }
      } else {
        consecutiveSameMovement = 1
      }
      lastMovementType = movementType

      const normalizedMotion = motion.replace(/\d+(\.\d+)?/g, 'N').replace(/\s+/g, ' ').trim()
      if (normalizedMotion.length > 20) motionSet.add(normalizedMotion)
    }

    const pushInPercent = scenes.length > 0 ? (pushInCount / scenes.length) * 100 : 0
    if (pushInPercent > 40) {
      warnings.push(`Push-in usado em ${pushInPercent.toFixed(1)}% das cenas (max 40%)`)
    }

    const uniquePercent = scenes.length > 0 ? (motionSet.size / scenes.length) * 100 : 0
    if (uniquePercent < 70) {
      warnings.push(`Apenas ${uniquePercent.toFixed(1)}% de motionDescriptions são únicas (min 70%)`)
    }

    return { warnings }
  }

  /**
   * Monta anotações narrativas mínimas (segmento + tensão) para o Coreógrafo.
   */
  private buildSceneAnnotations(
    outline: StoryOutline,
    totalScenes: number
  ): Array<{ segment: string; tensionLevel: string }> {
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

    const annotations: Array<{ segment: string; tensionLevel: string }> = []
    const tensionCurve = outline.tensionCurve || []
    const risingCount = dist.rising

    for (const seg of segments) {
      for (let i = 0; i < seg.count; i++) {
        if (annotations.length >= totalScenes) break
        let tension = seg.defaultTension
        if (seg.name === 'RISING' && risingCount > 0 && tensionCurve.length > 0) {
          const beatIdx = Math.min(Math.floor((i / risingCount) * tensionCurve.length), tensionCurve.length - 1)
          if (tensionCurve[beatIdx]) tension = tensionCurve[beatIdx]
        }
        annotations.push({ segment: seg.name, tensionLevel: tension })
      }
    }

    while (annotations.length < totalScenes) {
      annotations.push({ segment: 'EXTRA', tensionLevel: 'low' })
    }

    return annotations
  }

  /**
   * Gera motionDescription para cada cena via LLM.
   * Recebe scenes com `visualDescription` já preenchido pelo Fotógrafo.
   */
  async refine(
    scenes: Array<SceneInput & { visualDescription?: string }>,
    baseStyle: string,
    production?: ProductionContext
  ): Promise<ChoreographerOutput[]> {
    const log = createPipelineLogger({ stage: LOG_STAGE, outputId: 'choreographer' })

    const skillContent = await this.loadSkill()

    const systemPrompt = `${skillContent}

───────────────────────────────────────────
ESTILO VISUAL BASE DO PROJETO:
"${baseStyle}"
───────────────────────────────────────────`

    const annotations = production?.storyOutline
      ? this.buildSceneAnnotations(production.storyOutline, scenes.length)
      : null

    const userPrompt = `CENAS PARA COREOGRAFAR (visualDescription já definido pelo Fotógrafo — é FIXO):

${JSON.stringify(
  scenes.map((s, i) => {
    const ann = annotations?.[i]
    return {
      order: i,
      ...(ann ? { narrativeSegment: ann.segment, tensionLevel: ann.tensionLevel } : {}),
      narration: s.narration,
      visualDescription: s.visualDescription || s.currentVisual || '',
      durationSeconds: s.estimatedDuration
    }
  }),
  null,
  2
)}

TAREFA:
Para CADA cena, escreva o motionDescription — a coreografia de câmera calibrada à duração.

REGRAS CRÍTICAS:
- Referencie elementos ESPECÍFICOS do visualDescription no motion (ex: "push-in toward the payphone visible in foreground")
- NÃO altere o visualDescription — ele é fixo.
- Calibre à duração: 3-4s = static/breathing; 5-6s = push-in curto; 7-7.5s = dolly completo.

Retorne APENAS um JSON válido:
{
  "scenes": [
    { "order": 0, "motionDescription": "..." }
  ]
}`

    log.info(`🎬 Chamando LLM para coreografar ${scenes.length} cenas...`)
    const llm = await createLlmForTask('choreographer', { temperature: 0.4, maxTokens: 25000 })

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ])

    const rawText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    try {
      const cleanJson = rawText.replace(/```json\n?|```/g, '').trim()
      const parsed = JSON.parse(cleanJson) as { scenes: ChoreographerOutput[] }

      if (!Array.isArray(parsed.scenes)) {
        throw new Error('Formato inválido: "scenes" não é array.')
      }

      // Validação
      const validation = this.validateOutput(parsed.scenes)
      if (validation.warnings.length > 0) {
        log.warn(`⚠️ Validação: ${validation.warnings.length} problemas:`)
        validation.warnings.forEach(w => log.warn(`  - ${w}`))
      }

      log.info(`✅ Coreógrafo retornou ${parsed.scenes.length} cenas.`)
      return parsed.scenes
    } catch (error) {
      console.error(`[${LOG_STAGE}] Falha ao parsear JSON:`, error)
      console.error(`[${LOG_STAGE}] Raw (500 chars):`, rawText.slice(0, 500))

      return scenes.map((s, i) => ({
        order: i,
        motionDescription: s.currentMotion || 'Static cinematic shot.'
      }))
    }
  }
}

export const choreographer = new ChoreographerService()
