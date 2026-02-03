import { prisma } from '../../../utils/prisma'
import { bytesToBuffer } from '../../../utils/compression'

/**
 * GET /api/videos/[id]/download
 * Retorna o vídeo final renderizado
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Video ID is required'
    })
  }

  const video = await prisma.video.findUnique({
    where: { id },
    select: {
      outputData: true,
      outputMimeType: true,
      title: true
    }
  })

  if (!video || !video.outputData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Video not found or not rendered yet'
    })
  }

  // Descomprimir vídeo
  const videoBuffer = await bytesToBuffer(Buffer.from(video.outputData))

  // Definir headers para download
  setHeader(event, 'Content-Type', video.outputMimeType || 'video/mp4')
  setHeader(event, 'Content-Length', videoBuffer.length)
  setHeader(event, 'Content-Disposition', `attachment; filename="${video.title || 'video'}.mp4"`)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000') // Cache por 1 ano

  return videoBuffer
})
