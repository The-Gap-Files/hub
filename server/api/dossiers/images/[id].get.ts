import { prisma } from '../../../utils/prisma'
import { decompressBuffer } from '../../../utils/compression'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required'
    })
  }

  const image = await prisma.dossierImage.findUnique({
    where: { id }
  })

  if (!image || !image.imageData) {
    throw createError({
      statusCode: 404,
      message: 'Image not found'
    })
  }

  // Descomprimir se necessário (o utils/compression cuida disso se usarmos logicamente,
  // mas aqui o prisma retorna o Byte[])
  let data: any = Buffer.from(image.imageData)

  try {
    // Tentar descomprimir (pode estar em gzip)
    data = await decompressBuffer(data)
  } catch (e) {
    // Se falhar, assume que já está puro (ou não é gzip)
    // data já é o Buffer original
  }

  setResponseHeader(event, 'Content-Type', image.mimeType || 'image/jpeg')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  return data
})
