import { VideoPipelineService } from '../../../services/pipeline/video-pipeline.service'

export default defineEventHandler(async (event) => {
  const sceneId = getRouterParam(event, 'id')

  if (!sceneId) {
    throw createError({
      statusCode: 400,
      message: 'ID da cena é obrigatório'
    })
  }

  const pipeline = new VideoPipelineService()
  
  try {
    await pipeline.regenerateSceneMotion(sceneId)
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao regenerar motion:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro interno ao regenerar vídeo de movimento'
    })
  }
})
