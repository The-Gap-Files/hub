import { prisma } from '../../../utils/prisma'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { sendStream } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID é obrigatório'
    })
  }

  // Read from RenderProduct
  const renderProduct = await prisma.renderProduct.findUnique({
    where: { outputId: id },
    select: {
      captionedVideoData: true,
      captionedStoragePath: true,
      mimeType: true,
    }
  })

  if (!renderProduct) {
    throw createError({ statusCode: 404, message: 'Vídeo com legendas não encontrado' })
  }

  // Disk path first
  if (renderProduct.captionedStoragePath) {
    try {
      const stats = await fs.stat(renderProduct.captionedStoragePath)

      setResponseHeaders(event, {
        'Content-Type': renderProduct.mimeType || 'video/mp4',
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': 'inline'
      })

      const stream = createReadStream(renderProduct.captionedStoragePath)
      return sendStream(event, stream)
    } catch {
      throw createError({ statusCode: 404, message: 'Arquivo de vídeo legendado não encontrado em disco' })
    }
  }

  if (renderProduct.captionedVideoData) {
    setResponseHeaders(event, {
      'Content-Type': renderProduct.mimeType || 'video/mp4',
      'Content-Length': renderProduct.captionedVideoData.length.toString(),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline'
    })

    return renderProduct.captionedVideoData
  }

  throw createError({ statusCode: 404, message: 'Vídeo com legendas não encontrado' })
})
