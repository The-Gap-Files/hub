import { VideoPipelineService } from '../../../services/pipeline/video-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID do vídeo é obrigatório'
    })
  }

  if (!body.feedback) {
    throw createError({
      statusCode: 400,
      message: 'O feedback é obrigatório para refinar o roteiro'
    })
  }

  const pipeline = new VideoPipelineService()
  
  // Refinar roteiro em background
  setTimeout(async () => {
    try {
      await pipeline.refineScript(id, body.feedback)
    } catch (error) {
      console.error('Erro ao refinar roteiro:', error)
    }
  })

  return {
    success: true,
    message: 'Refinamento iniciado.'
  }
})
