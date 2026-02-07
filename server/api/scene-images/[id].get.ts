import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Image ID required' })

  const image = await prisma.sceneImage.findUnique({
    where: { id }
  })

  if (!image || !image.fileData) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }

  setHeader(event, 'Content-Type', image.mimeType || 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000') // Cache agressivo pois ID muda se regenerar

  return image.fileData
})
