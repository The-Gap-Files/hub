import { prisma } from '../../../utils/prisma'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { sendStream } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID do Output é obrigatório' })
  }

  // Read from RenderProduct
  const renderProduct = await prisma.renderProduct.findUnique({
    where: { outputId: id },
    select: {
      videoData: true,
      videoStoragePath: true,
      mimeType: true,
      fileSize: true,
    }
  })

  if (!renderProduct) {
    throw createError({ statusCode: 404, message: 'Vídeo não encontrado' })
  }

  // Estratégia híbrida: disco ou banco
  if (renderProduct.videoStoragePath) {
    try {
      const stats = await fs.stat(renderProduct.videoStoragePath)

      setResponseHeaders(event, {
        'Content-Type': renderProduct.mimeType || 'video/mp4',
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes'
      })

      const stream = createReadStream(renderProduct.videoStoragePath)
      return sendStream(event, stream)
    } catch {
      throw createError({ statusCode: 404, message: 'Arquivo de vídeo não encontrado em disco' })
    }
  }

  if (renderProduct.videoData) {
    setResponseHeaders(event, {
      'Content-Type': renderProduct.mimeType || 'video/mp4',
      'Content-Length': renderProduct.videoData.length.toString(),
      'Accept-Ranges': 'bytes'
    })

    return renderProduct.videoData
  }

  throw createError({ statusCode: 404, message: 'Vídeo não encontrado (nem em disco nem no banco)' })
})
