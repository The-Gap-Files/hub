import { prisma } from '../../../utils/prisma'
import { bytesToBuffer } from '../../../utils/compression'

/**
 * GET /api/videos/[id]/audio
 * Retorna o áudio de narração de um vídeo
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Video ID is required'
    })
  }

  const audioTrack = await prisma.audioTrack.findFirst({
    where: {
      videoId: id,
      type: 'narration'
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!audioTrack) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Audio track not found'
    })
  }

  if (!audioTrack.fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Audio data not found'
    })
  }

  // Descomprimir áudio
  const audioBuffer = await bytesToBuffer(Buffer.from(audioTrack.fileData))

  // Definir headers
  setHeader(event, 'Content-Type', audioTrack.mimeType || 'audio/mpeg')
  setHeader(event, 'Content-Length', audioBuffer.length)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000')

  return audioBuffer
})
