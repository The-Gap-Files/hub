import { prisma } from '../../../utils/prisma'

/**
 * GET /api/outputs/[id]/audio
 * Retorna a narração completa de um output
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Output ID is required'
    })
  }

  const audio = await prisma.audioTrack.findFirst({
    where: {
      outputId: id,
      type: 'narration'
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!audio || !audio.fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Narration audio not found'
    })
  }

  // Definir headers
  setHeader(event, 'Content-Type', audio.mimeType || 'audio/mpeg')
  setHeader(event, 'Content-Length', audio.fileData.length)
  setHeader(event, 'Cache-Control', 'no-cache, must-revalidate')
  setHeader(event, 'Accept-Ranges', 'bytes')

  return audio.fileData
})
