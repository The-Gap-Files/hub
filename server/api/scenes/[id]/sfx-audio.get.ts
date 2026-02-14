import { prisma } from '../../../utils/prisma'

/**
 * GET /api/scenes/[id]/sfx-audio
 * Retorna o áudio SFX (efeitos sonoros) de uma cena específica
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
      type: 'scene_sfx'
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!audio || !audio.fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Scene SFX audio not found'
    })
  }

  // Definir headers
  setHeader(event, 'Content-Type', audio.mimeType || 'audio/mpeg')
  setHeader(event, 'Content-Length', audio.fileData.length)
  setHeader(event, 'Cache-Control', 'no-cache, must-revalidate')
  setHeader(event, 'Accept-Ranges', 'bytes')

  return audio.fileData
})
