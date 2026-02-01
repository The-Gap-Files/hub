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

  // 1. Marcar vídeos de movimento como aprovados
  await prisma.video.update({
    where: { id },
    data: { videosApproved: true }
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
      console.error('Erro ao processar pipeline após aprovação do motion:', error)
    }
  })

  return {
    success: true,
    message: 'Vídeos aprovados. Pipeline de Renderização iniciado.'
  }
})
