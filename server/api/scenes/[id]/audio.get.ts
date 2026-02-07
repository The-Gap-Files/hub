import { prisma } from '../../../utils/prisma'

/**
 * GET /api/scenes/[id]/audio
 * Retorna a narração de uma cena específica
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Scene ID is required'
    })
  }

  const audio = await prisma.audioTrack.findFirst({
    where: {
      sceneId: id,
      type: 'scene_narration'
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!audio || !audio.fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Scene narration audio not found'
    })
  }

  // Definir headers
  setHeader(event, 'Content-Type', audio.mimeType || 'audio/mpeg')
  setHeader(event, 'Content-Length', audio.fileData.length)
  setHeader(event, 'Cache-Control', 'no-cache, must-revalidate')
  setHeader(event, 'Accept-Ranges', 'bytes')

  return audio.fileData
})
