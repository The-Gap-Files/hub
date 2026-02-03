import { prisma } from '../../../utils/prisma'
import { bytesToBuffer } from '../../../utils/compression'

/**
 * GET /api/scenes/[id]/video
 * Retorna o vídeo com motion de uma cena
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Scene ID is required'
    })
  }

  const scene = await prisma.scene.findUnique({
    where: { id },
    include: {
      videos: {
        where: { isSelected: true },
        take: 1
      }
    }
  })

  if (!scene || !scene.videos[0] || !scene.videos[0].fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Scene video not found'
    })
  }

  const video = scene.videos[0]

  if (!video || !video.fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Scene video not found'
    })
  }

  // Descomprimir vídeo
  const videoBuffer = await bytesToBuffer(Buffer.from(video.fileData))

  // Definir headers
  setHeader(event, 'Content-Type', video.mimeType || 'video/mp4')
  setHeader(event, 'Content-Length', videoBuffer.length)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000')

  return videoBuffer
})
