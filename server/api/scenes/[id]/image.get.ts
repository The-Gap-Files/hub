import { prisma } from '../../../utils/prisma'
import { bytesToBuffer } from '../../../utils/compression'

/**
 * GET /api/scenes/[id]/image
 * Retorna a imagem selecionada de uma cena
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
      images: {
        where: { isSelected: true },
        take: 1
      }
    }
  })

  if (!scene || !scene.images[0] || !scene.images[0].fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Scene image not found'
    })
  }

  const image = scene.images[0]

  // Descomprimir imagem
  if (!image.fileData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Image data not found'
    })
  }

  const imageBuffer = await bytesToBuffer(Buffer.from(image.fileData))

  // Definir headers
  setHeader(event, 'Content-Type', image.mimeType || 'image/png')
  setHeader(event, 'Content-Length', imageBuffer.length)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000')

  return imageBuffer
})
