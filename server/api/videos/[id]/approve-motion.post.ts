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

  // 1. Marcar vídeos como aprovados
  await prisma.video.update({
    where: { id },
    data: { videosApproved: true }
  })

  // 2. Continuar o pipeline para renderização final
  const pipeline = new VideoPipelineService()
  
  setTimeout(async () => {
    try {
      // O pipeline.execute sabe carregar o resto do banco de dados
      // já que passamos o videoId existente.
      // O execute vai pular as etapas já concluídas (Script, Images, Audio, Motion)
      // e ir direto para o render final.
      await pipeline.execute({ theme: '' }, id)
    } catch (error) {
      console.error('Erro ao processar pipeline após aprovação de motion:', error)
    }
  })

  return {
    success: true,
    message: 'Vídeos aprovados. Renderização final iniciada.'
  }
})
