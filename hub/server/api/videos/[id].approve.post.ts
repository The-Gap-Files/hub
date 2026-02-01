import { VideoPipelineService } from '../../../services/pipeline/video-pipeline.service'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID do vídeo é obrigatório'
    })
  }

  // 1. Marcar vídeo como aprovado
  await prisma.video.update({
    where: { id },
    data: { imagesApproved: true }
  })

  // 2. Disparar pipeline para as fases finais
  const pipeline = new VideoPipelineService()
  
  // Buscar opções originais para continuar o processamento
  const video = await prisma.video.findUnique({ where: { id } })
  if (!video) throw createError({ statusCode: 404, message: 'Vídeo não encontrado' })

  const options = {
    theme: video.theme,
    language: video.language,
    targetDuration: video.duration ?? 185,
    style: video.style as any,
    voiceId: video.voiceId ?? undefined,
    imageStyle: video.imageStyle as any,
    visualStyle: video.visualStyle ?? undefined,
    aspectRatio: video.aspectRatio as any,
    enableMotion: video.enableMotion
  }

  // Rodar em background
  setTimeout(async () => {
    try {
      await pipeline.execute(options, id)
    } catch (error) {
      console.error('Pipeline error after approval:', error)
    }
  })

  return {
    success: true,
    message: 'Imagens aprovadas. Pipeline de áudio e vídeo iniciado.'
  }
})
