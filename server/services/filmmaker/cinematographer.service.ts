/**
 * Cinematographer Service (Agente Cineasta — End Keyframe)
 *
 * Terceiro agente do pipeline de 3:
 * Fotógrafo → Coreógrafo → Cineasta
 *
 * Gera `endVisualDescription` (keyframe final) e `endImageReferenceWeight`,
 * derivados do start (visualDescription) + motion (motionDescription).
 *
 * Este agente NÃO inventa cenários — apenas descreve o que a câmera VÊ
 * ao final do movimento descrito, forçando coerência por design.
 */

import { createLlmForTask } from '../llm/llm-factory'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createPipelineLogger } from '../../utils/pipeline-logger'
import type { CinematographerOutput } from './filmmaker.types'
import fs from 'node:fs/promises'
import path from 'node:path'

const LOG_STAGE = 'Cinematographer'

export class CinematographerService {

  private async loadSkill(): Promise<string> {
    const skillPath = path.resolve(process.cwd(), 'server/skills/cinematographer.md')
    try {
      return await fs.readFile(skillPath, 'utf-8')
    } catch {
      console.warn(`[${LOG_STAGE}] ⚠️ cinematographer.md não encontrado, usando fallback.`)
      return 'You are a transition coherence specialist. Generate endVisualDescription derived from start image + motion. Never invent new scenes — derive the end from the start.'
    }
  }

  /**
   * Valida coerência start↔end. Detecta problemas comuns.
   */
  private validateOutput(
    scenes: CinematographerOutput[],
    inputScenes: Array<{ visualDescription: string; motionDescription: string; estimatedDuration: number }>
  ): { warnings: string[] } {
    const warnings: string[] = []

    const interiorKeywords = ['indoor', 'room', 'corridor', 'hallway', 'office', 'basement', 'interior', 'kitchen', 'bedroom', 'bathroom', 'lab', 'warehouse']
    const exteriorKeywords = ['outdoor', 'street', 'sky', 'exterior', 'sidewalk', 'parking', 'alley', 'highway', 'field', 'forest', 'beach']
    const dayKeywords = ['daylight', 'sunlight', 'morning', 'afternoon', 'sunny', 'overcast daylight']
    const nightKeywords = ['night', 'moonlight', 'sodium vapor', 'neon', 'streetlight', 'darkness']

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]!
      const input = inputScenes[i]
      if (!input || !scene.endVisualDescription) continue

      const startLower = input.visualDescription.toLowerCase()
      const endLower = scene.endVisualDescription.toLowerCase()
      const motionLower = input.motionDescription.toLowerCase()

      // Interior/exterior mismatch
      const startInterior = interiorKeywords.some(k => startLower.includes(k))
      const startExterior = exteriorKeywords.some(k => startLower.includes(k))
      const endInterior = interiorKeywords.some(k => endLower.includes(k))
      const endExterior = exteriorKeywords.some(k => endLower.includes(k))

      if (startInterior && !startExterior && endExterior && !endInterior) {
        warnings.push(`Cena ${scene.order}: interior→exterior detectado (start interior, end exterior)`)
      }
      if (startExterior && !startInterior && endInterior && !endExterior) {
        warnings.push(`Cena ${scene.order}: exterior→interior detectado (start exterior, end interior)`)
      }

      // Day/night mismatch
      const startDay = dayKeywords.some(k => startLower.includes(k))
      const startNight = nightKeywords.some(k => startLower.includes(k))
      const endDay = dayKeywords.some(k => endLower.includes(k))
      const endNight = nightKeywords.some(k => endLower.includes(k))

      if (startDay && !startNight && endNight && !endDay) {
        warnings.push(`Cena ${scene.order}: dia→noite detectado`)
      }
      if (startNight && !startDay && endDay && !endNight) {
        warnings.push(`Cena ${scene.order}: noite→dia detectado`)
      }

      // Weight vs duration
      const duration = input.estimatedDuration
      if (scene.endImageReferenceWeight !== null) {
        if (duration <= 4 && scene.endImageReferenceWeight < 0.85) {
          warnings.push(`Cena ${scene.order}: duração ${duration}s com weight ${scene.endImageReferenceWeight} (mín 0.85 para 3-4s)`)
        }
        if (duration <= 6 && duration > 4 && scene.endImageReferenceWeight < 0.65) {
          warnings.push(`Cena ${scene.order}: duração ${duration}s com weight ${scene.endImageReferenceWeight} (mín 0.65 para 5-6s)`)
        }
      }

      // Static/breathing com end não-null
      const isStatic = motionLower.includes('static') || motionLower.includes('locked-off')
      const isBreathing = motionLower.includes('breathing') && !motionLower.includes('push') && !motionLower.includes('dolly')
      if ((isStatic || isBreathing) && scene.endVisualDescription) {
        warnings.push(`Cena ${scene.order}: motion é ${isStatic ? 'static' : 'breathing'} mas endVisualDescription não é null`)
      }
    }

    return { warnings }
  }

  /**
   * Gera endVisualDescription + weight para cada cena via LLM.
   * Recebe scenes com `visualDescription` e `motionDescription` já preenchidos.
   */
  async refine(
    scenes: Array<{
      order: number
      narration: string
      visualDescription: string
      motionDescription: string
      estimatedDuration: number
    }>
  ): Promise<CinematographerOutput[]> {
    const log = createPipelineLogger({ stage: LOG_STAGE, outputId: 'cinematographer' })

    const skillContent = await this.loadSkill()

    const systemPrompt = skillContent

    const userPrompt = `CENAS COM visualDescription E motionDescription JÁ DEFINIDOS (ambos são FIXOS — NÃO altere):

${JSON.stringify(
  scenes.map(s => ({
    order: s.order,
    narration: s.narration,
    visualDescription: s.visualDescription,
    motionDescription: s.motionDescription,
    durationSeconds: s.estimatedDuration
  })),
  null,
  2
)}

TAREFA:
Para CADA cena, determine:
1. Se precisa de endVisualDescription (keyframe final) — consulte a tabela na seção 1
2. Se SIM: descreva O QUE A CÂMERA VÊ ao final do movimento descrito na motionDescription
3. Se NÃO: use null

⚠️ SELF-CHECK OBRIGATÓRIO PARA CADA CENA:
Antes de escrever o endVisualDescription, responda mentalmente:
- "O start e o end são do MESMO cenário?" — Se não → null
- "O motion explica como a câmera chega do start ao end?" — Se não → null
- "A duração permite essa amplitude de mudança?" — Se não → reduza ou null
- "Um travelling real contínuo do frame A ao frame B seria fisicamente possível?" — Se não → null

Retorne APENAS um JSON válido:
{
  "scenes": [
    { "order": 0, "endVisualDescription": "..." | null, "endImageReferenceWeight": 0.7 | null }
  ]
}`

    log.info(`🎥 Chamando LLM para gerar keyframes finais de ${scenes.length} cenas...`)
    const llm = await createLlmForTask('cinematographer', { temperature: 0.3, maxTokens: 20000 })

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ])

    const rawText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    try {
      const cleanJson = rawText.replace(/```json\n?|```/g, '').trim()
      const parsed = JSON.parse(cleanJson) as { scenes: CinematographerOutput[] }

      if (!Array.isArray(parsed.scenes)) {
        throw new Error('Formato inválido: "scenes" não é array.')
      }

      // Validação de coerência
      const validation = this.validateOutput(
        parsed.scenes,
        scenes.map(s => ({
          visualDescription: s.visualDescription,
          motionDescription: s.motionDescription,
          estimatedDuration: s.estimatedDuration
        }))
      )
      if (validation.warnings.length > 0) {
        log.warn(`⚠️ Validação de coerência: ${validation.warnings.length} problemas:`)
        validation.warnings.forEach(w => log.warn(`  - ${w}`))
      }

      log.info(`✅ Cineasta retornou ${parsed.scenes.length} cenas.`)
      return parsed.scenes
    } catch (error) {
      console.error(`[${LOG_STAGE}] Falha ao parsear JSON:`, error)
      console.error(`[${LOG_STAGE}] Raw (500 chars):`, rawText.slice(0, 500))

      // Fallback: sem end keyframes
      return scenes.map(s => ({
        order: s.order,
        endVisualDescription: null,
        endImageReferenceWeight: null
      }))
    }
  }
}

export const cinematographer = new CinematographerService()
