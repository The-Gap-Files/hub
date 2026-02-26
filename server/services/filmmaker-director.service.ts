/**
 * Filmmaker Director Service — Orchestrator
 *
 * Orquestra os 3 agentes especializados em sequência:
 * 1. Fotógrafo  → visualDescription (start image)
 * 2. Coreógrafo → motionDescription (camera movement)
 * 3. Cineasta   → endVisualDescription + weight (end keyframe)
 *
 * A interface pública (refineScript) é idêntica à versão anterior.
 * Nenhum caller externo precisa mudar.
 */

import { PhotographerService } from './filmmaker/photographer.service'
import { ChoreographerService } from './filmmaker/choreographer.service'
import { createPipelineLogger } from '../utils/pipeline-logger'

// Re-export types for backwards compatibility
export type { ProductionContext, SceneInput, RefinedScene } from './filmmaker/filmmaker.types'
import type { SceneInput, ProductionContext, RefinedScene } from './filmmaker/filmmaker.types'

export class FilmmakerDirectorService {
  private photographer = new PhotographerService()
  private choreographer = new ChoreographerService()

  /**
   * Refina as cenas aplicando os 3 agentes em sequência.
   * Interface idêntica à versão anterior — drop-in replacement.
   */
  async refineScript(
    scenes: SceneInput[],
    baseStyle: string,
    _context?: string,
    production?: ProductionContext
  ): Promise<RefinedScene[]> {
    const log = createPipelineLogger({ stage: 'Filmmaker', outputId: 'director' })

    if (!scenes || scenes.length === 0) return []

    log.info(`🎬 Pipeline de 2 agentes para ${scenes.length} cenas (Cineasta desativado)...`)

    // ── 1. Fotógrafo → visualDescription ──────────────────────────
    log.info(`📸 [1/3] Fotógrafo...`)
    const photoResults = await this.photographer.refine(scenes, baseStyle, production)

    // Merge photo results into working copy
    const workingScenes = scenes.map((s, i) => {
      const photo = photoResults.find(p => p.order === i) || photoResults[i]
      return {
        ...s,
        visualDescription: photo?.visualDescription || s.currentVisual || '',
        sceneEnvironment: photo?.sceneEnvironment || s.currentEnvironment,
      }
    })

    log.info(`📸 [1/3] Fotógrafo: ${photoResults.length} visuais gerados.`)

    // ── 2. Coreógrafo → motionDescription ─────────────────────────
    log.info(`🎬 [2/3] Coreógrafo...`)
    const choreResults = await this.choreographer.refine(
      workingScenes.map(s => ({
        order: s.order,
        narration: s.narration,
        currentVisual: s.visualDescription,
        currentMotion: s.currentMotion,
        currentEnvironment: s.sceneEnvironment,
        estimatedDuration: s.estimatedDuration,
        visualDescription: s.visualDescription,
      })),
      baseStyle,
      production
    )

    // Merge motion results
    for (let i = 0; i < workingScenes.length; i++) {
      const chore = choreResults.find(c => c.order === i) || choreResults[i]
      if (chore) {
        (workingScenes[i] as any).motionDescription = chore.motionDescription
      }
    }

    log.info(`🎬 [2/2] Coreógrafo: ${choreResults.length} movimentos gerados.`)

    // ── 3. Combinar resultados finais ─────────────────────────────
    const combined: RefinedScene[] = workingScenes.map((s) => ({
      order: s.order,
      visualDescription: s.visualDescription,
      motionDescription: (s as any).motionDescription || 'Static cinematic shot.',
      sceneEnvironment: s.sceneEnvironment,
    }))

    log.info(`✅ Pipeline completo: ${combined.length} cenas refinadas por 2 agentes (Fotógrafo + Coreógrafo).`)

    return combined
  }
}

export const filmmakerDirector = new FilmmakerDirectorService()
