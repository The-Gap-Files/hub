
import { VideoPipelineService } from '../../../services/pipeline/video-pipeline.service'

const pipelineService = new VideoPipelineService()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID do vídeo não fornecido'
    })
  }

  try {
    const result = await pipelineService.reprocessRender(id)

    return {
      success: result.status === 'completed',
      data: result
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao re-renderizar vídeo'
    })
  }
})
