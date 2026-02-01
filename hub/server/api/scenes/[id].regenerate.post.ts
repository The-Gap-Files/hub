import { VideoPipelineService } from '../../../services/pipeline/video-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID da cena é obrigatório'
    })
  }

  const pipeline = new VideoPipelineService()
  
  try {
    await pipeline.regenerateSceneImage(id)
    return {
      success: true,
      message: 'Imagem da cena regenerada com sucesso.'
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao regenerar imagem'
    })
  }
})
