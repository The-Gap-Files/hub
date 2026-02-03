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
    select: {
      id: true,
      title: true,
      theme: true,
      status: true,
      duration: true,
      language: true,
      style: true,
      voiceId: true,
      imageStyle: true,
      visualStyle: true,
      aspectRatio: true,
      enableMotion: true,
      scriptApproved: true,
      imagesApproved: true,
      videosApproved: true,
      seedId: true,
      thumbnailPath: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      outputMimeType: true,
      outputSize: true,
      script: {
        select: {
          id: true,
          fullText: true,
          wordCount: true,
          provider: true,
          modelUsed: true,
          createdAt: true
        }
      },
      scenes: {
        select: {
          id: true,
          order: true,
          narration: true,
          visualDescription: true,
          startTime: true,
          endTime: true,
          images: {
            where: { isSelected: true },
            select: {
              id: true,
              promptUsed: true,
              isSelected: true,
              variantIndex: true,
              mimeType: true,
              originalSize: true,
              width: true,
              height: true,
              createdAt: true
            }
          },
          videos: {
            where: { isSelected: true },
            select: {
              id: true,
              promptUsed: true,
              isSelected: true,
              variantIndex: true,
              mimeType: true,
              originalSize: true,
              duration: true,
              createdAt: true
            }
          }
        },
        orderBy: { order: 'asc' }
      },
      audioTracks: {
        select: {
          id: true,
          type: true,
          provider: true,
          voiceId: true,
          mimeType: true,
          originalSize: true,
          duration: true,
          createdAt: true
        }
      }
    }
  })

  if (!video) {
    throw createError({
      statusCode: 404,
      message: 'Vídeo não encontrado'
    })
  }

  // Buscar logs do pipeline - limitar campos para evitar JSON pesado
  const pipelineLogs = await prisma.pipelineExecution.findMany({
    where: { videoId: id },
    select: {
      id: true,
      step: true,
      status: true,
      message: true,
      durationMs: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 50 // Limitar quantidade de logs
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
