/**
 * GET /api/videos/:id
 * 
 * Retorna detalhes de um vídeo específico, incluindo status do pipeline.
 */

import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'ID do vídeo é obrigatório'
    })
  }

  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      script: true,
      scenes: {
        include: {
          images: {
            where: { isSelected: true }
          },
          videos: {
            where: { isSelected: true }
          }
        },
        orderBy: { order: 'asc' }
      },
      audioTracks: true
    }
  })

  if (!video) {
    throw createError({
      statusCode: 404,
      message: 'Vídeo não encontrado'
    })
  }

  // Buscar logs do pipeline
  const pipelineLogs = await prisma.pipelineExecution.findMany({
    where: { videoId: id },
    orderBy: { createdAt: 'desc' }
  })

  return {
    success: true,
    data: {
      ...video,
      pipeline: {
        logs: pipelineLogs,
        progress: calculateProgress(video.status)
      }
    }
  }
})

function calculateProgress(status: string): number {
  const progressMap: Record<string, number> = {
    PENDING: 0,
    SCRIPT_GENERATING: 10,
    SCRIPT_READY: 25,
    AUDIO_GENERATING: 35,
    AUDIO_READY: 50,
    IMAGES_GENERATING: 60,
    IMAGES_READY: 70,
    MOTION_GENERATING: 80,
    MOTION_READY: 85,
    RENDERING: 90,
    COMPLETED: 100,
    FAILED: 0,
    CANCELLED: 0
  }
  return progressMap[status] ?? 0
}
