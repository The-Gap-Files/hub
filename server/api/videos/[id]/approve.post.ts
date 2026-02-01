import { prisma } from '../../../utils/prisma'
import { VideoPipelineService } from '../../../services/pipeline/video-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID do vídeo é obrigatório'
    })
  }

  // 1. Marcar imagens como aprovadas
  await prisma.video.update({
    where: { id },
    data: { imagesApproved: true }
  })

  // 2. Continuar o pipeline em background
  const pipeline = new VideoPipelineService()
  
  // Usamos setTimeout para não segurar a requisição HTTP
  setTimeout(async () => {
    try {
      // O pipeline.execute agora sabe carregar o resto do banco de dados
      // já que passamos o videoId existente.
      await pipeline.execute({ theme: '' }, id)
    } catch (error) {
      console.error('Erro ao processar pipeline após aprovação:', error)
    }
  })

  return {
    success: true,
    message: 'Imagens aprovadas. Pipeline de Áudio e Motion iniciado.'
  }
})
