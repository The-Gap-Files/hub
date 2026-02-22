import { filmmakerDirector } from '../../../filmmaker-director.service'
import type { ProductionContext } from '../../../filmmaker-director.service'

const LOG = '[FilmmakerBatch]'

/**
 * Executa o Filmmaker Director (Cineasta) com batching + merge.
 * Muta `scenes` in-place com os campos refinados.
 *
 * Centraliza a lógica que estava duplicada em:
 * - output-pipeline.service.ts (generateScript)
 * - regenerate-script.post.ts
 */
export async function runFilmmakerBatched(
  scenes: Array<{
    narration?: string
    visualDescription?: string
    sceneEnvironment?: string
    motionDescription?: string
    estimatedDuration?: number
    endVisualDescription?: string | null
    endImageReferenceWeight?: number | null
    [key: string]: any
  }>,
  baseStyle: string,
  productionCtx: ProductionContext,
  batchSize = 50
): Promise<void> {
  if (!scenes || scenes.length === 0) return

  console.log(`${LOG} 🎬 Acionando Cineasta para ${scenes.length} cenas...`)

  const allInputScenes = scenes.map(s => ({
    order: 0,
    narration: s.narration || '',
    currentVisual: s.visualDescription || '',
    currentEnvironment: s.sceneEnvironment || '',
    estimatedDuration: s.estimatedDuration || 5,
  }))

  type FilmmakerResult = Awaited<ReturnType<typeof filmmakerDirector.refineScript>>
  let allRefinedScenes: FilmmakerResult = []

  if (allInputScenes.length <= batchSize) {
    allRefinedScenes = await filmmakerDirector.refineScript(allInputScenes, baseStyle, undefined, productionCtx)
  } else {
    const totalBatches = Math.ceil(allInputScenes.length / batchSize)
    console.log(`${LOG} 🎬 ${allInputScenes.length} cenas → ${totalBatches} lotes de até ${batchSize}.`)
    for (let batchStart = 0; batchStart < allInputScenes.length; batchStart += batchSize) {
      const batch = allInputScenes.slice(batchStart, batchStart + batchSize)
      const batchIndex = Math.floor(batchStart / batchSize) + 1
      console.log(`${LOG} 🎬 Lote ${batchIndex}/${totalBatches} (${batch.length} cenas)...`)
      const batchResult = await filmmakerDirector.refineScript(batch, baseStyle, undefined, productionCtx)
      if (batchResult) {
        allRefinedScenes = [...(allRefinedScenes || []), ...batchResult]
      }
    }
  }

  // Merge refinements back into original scenes (in-place mutation)
  if (allRefinedScenes && allRefinedScenes.length === scenes.length) {
    for (let i = 0; i < scenes.length; i++) {
      const refined = allRefinedScenes[i]
      if (!refined) continue
      const scene = scenes[i]!
      scene.visualDescription = refined.visualDescription || scene.visualDescription
      scene.motionDescription = refined.motionDescription || scene.motionDescription
      scene.sceneEnvironment = refined.sceneEnvironment || scene.sceneEnvironment
      if (refined.endVisualDescription !== undefined) {
        scene.endVisualDescription = refined.endVisualDescription ?? scene.endVisualDescription
      }
      if (refined.endImageReferenceWeight !== undefined) {
        scene.endImageReferenceWeight = refined.endImageReferenceWeight ?? scene.endImageReferenceWeight
      }
    }
    console.log(`${LOG} ✅ Cineasta refinou todas as ${scenes.length} cenas com sucesso.`)
  } else {
    console.warn(`${LOG} ⚠️ Cineasta retornou número incorreto de cenas (${allRefinedScenes?.length} vs ${scenes.length}). Ignorando refinamento.`)
  }
}
