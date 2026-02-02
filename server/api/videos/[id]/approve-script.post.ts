import { VideoPipelineService } from '../../../services/pipeline/video-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID do vídeo é obrigatório'
    })
  }

  const pipeline = new VideoPipelineService()
  
  // Aprovar e continuar
  setTimeout(async () => {
    try {
      await pipeline.approveScript(id)
    } catch (error) {
      console.error('Erro ao aprovar roteiro:', error)
    }
  })

  return {
    success: true,
    message: 'Roteiro aprovado. Iniciando geração de imagens.'
  }
})
