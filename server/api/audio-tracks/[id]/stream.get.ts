import { prisma } from '../../../utils/prisma'

/**
 * GET /api/audio-tracks/[id]/stream
 * Retorna o áudio binário de um AudioTrack pelo ID
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'AudioTrack ID is required'
    })
  }

  const audio = await prisma.audioTrack.findUnique({
    where: { id },
    select: {
      fileData: true,
      mimeType: true
    }
  })

  if (!audio || !audio.fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Audio track not found'
    })
  }

  setHeader(event, 'Content-Type', audio.mimeType || 'audio/mpeg')
  setHeader(event, 'Content-Length', audio.fileData.length)
  setHeader(event, 'Cache-Control', 'no-cache, must-revalidate')
  setHeader(event, 'Accept-Ranges', 'bytes')

  return audio.fileData
})
