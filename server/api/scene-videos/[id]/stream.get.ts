import { prisma } from '../../../utils/prisma'

/**
 * GET /api/scene-videos/[id]/stream
 * Retorna o vídeo de uma cena (motion) para preview no player
 * Suporta Range Requests para seek no player de vídeo
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Scene Video ID is required'
    })
  }

  const video = await prisma.sceneVideo.findUnique({
    where: { id },
    select: {
      fileData: true,
      mimeType: true,
      originalSize: true,
      duration: true
    }
  })

  if (!video || !video.fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Scene video not found'
    })
  }

  const fileData = video.fileData as Buffer
  const totalSize = fileData.length
  const mimeType = video.mimeType || 'video/mp4'

  // Suporte a Range Requests (necessário para seek no player de vídeo)
  const rangeHeader = getRequestHeader(event, 'range')

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0] || '0', 10)
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1
    const chunkSize = end - start + 1

    setResponseStatus(event, 206)
    setHeader(event, 'Content-Range', `bytes ${start}-${end}/${totalSize}`)
    setHeader(event, 'Accept-Ranges', 'bytes')
    setHeader(event, 'Content-Length', chunkSize)
    setHeader(event, 'Content-Type', mimeType)
    setHeader(event, 'Cache-Control', 'public, max-age=3600')

    return fileData.subarray(start, end + 1)
  }

  // Resposta completa (sem Range)
  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Length', totalSize)
  setHeader(event, 'Accept-Ranges', 'bytes')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')

  return fileData
})
