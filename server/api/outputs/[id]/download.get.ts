import { prisma } from '../../../utils/prisma'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { sendStream } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID do Output é obrigatório' })
  }

  // Get title for filename
  const output = await prisma.output.findUnique({
    where: { id },
    select: { title: true }
  })

  if (!output) {
    throw createError({ statusCode: 404, message: 'Output não encontrado' })
  }

  // Read from RenderProduct
  const renderProduct = await prisma.renderProduct.findUnique({
    where: { outputId: id },
    select: {
      videoData: true,
      videoStoragePath: true,
      mimeType: true,
    }
  })

  if (!renderProduct) {
    throw createError({ statusCode: 404, message: 'Vídeo não encontrado' })
  }

  const fileName = `${output.title || 'video'}.mp4`

  // Estratégia híbrida: disco ou banco
  if (renderProduct.videoStoragePath) {
    try {
      const stats = await fs.stat(renderProduct.videoStoragePath)

      setResponseHeaders(event, {
        'Content-Type': renderProduct.mimeType || 'video/mp4',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': stats.size.toString()
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
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': renderProduct.videoData.length.toString()
    })

    return renderProduct.videoData
  }

  throw createError({ statusCode: 404, message: 'Vídeo não encontrado (nem em disco nem no banco)' })
})
