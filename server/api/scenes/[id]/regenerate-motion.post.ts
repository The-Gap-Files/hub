import { prisma } from '../../../utils/prisma'
import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'
import { validateReplicatePricing, PricingNotConfiguredError } from '../../../constants/pricing'

export default defineEventHandler(async (event) => {
  const sceneId = getRouterParam(event, 'id')

  if (!sceneId) throw createError({ statusCode: 400, message: 'Scene ID required' })

  // 1. Verificar se a cena existe e tem imagem
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: {
      images: { where: { isSelected: true } },
      output: true
    }
  })

  if (!scene) throw createError({ statusCode: 404, message: 'Cena não encontrada' })
  if (!scene.images[0]?.fileData) {
    throw createError({ statusCode: 422, message: 'Cena não possui imagem selecionada. Gere ou regenere a imagem primeiro.' })
  }

  console.log(`[API] 🎞️ Regenerating motion for Scene ${sceneId} (Output: ${scene.outputId})`)

  try {
    const newVideo = await outputPipelineService.regenerateSceneMotion(sceneId)
    return { success: true, video: { id: newVideo.id, duration: newVideo.duration, provider: newVideo.provider } }
  } catch (err: any) {
    if (err instanceof PricingNotConfiguredError) {
      throw createError({
        statusCode: 422,
        data: { code: 'PRICING_NOT_CONFIGURED', model: err.model, provider: err.provider, configUrl: err.configUrl },
        message: err.message
      })
    }
    console.error(`[API] Erro ao regenerar motion da cena ${sceneId}:`, err)
    throw createError({ statusCode: 500, message: err.message || 'Erro interno ao regenerar motion' })
  }
})
