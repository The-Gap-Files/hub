import { prisma } from '../../../utils/prisma'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { sendStream } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID do Output é obrigatório' })
  }

  // Buscar output no banco
  const output = await prisma.output.findUnique({
    where: { id },
    select: {
      outputData: true,
      outputMimeType: true,
      outputPath: true,
      title: true
    }
  })

  if (!output) {
    throw createError({ statusCode: 404, message: 'Output não encontrado' })
  }

  const fileName = `${output.title || 'video'}.mp4`

  // Estratégia híbrida: disco ou banco
  if (output.outputPath) {
    // Vídeo armazenado em disco (arquivo grande)
    try {
      const stats = await fs.stat(output.outputPath)

      setResponseHeaders(event, {
        'Content-Type': output.outputMimeType || 'video/mp4',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': stats.size.toString()
      })

      const stream = createReadStream(output.outputPath)
      return sendStream(event, stream)
    } catch {
      throw createError({ statusCode: 404, message: 'Arquivo de vídeo não encontrado em disco' })
    }
  }

  if (output.outputData) {
    // Vídeo armazenado no PostgreSQL (BYTEA)
    setResponseHeaders(event, {
      'Content-Type': output.outputMimeType || 'video/mp4',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': output.outputData.length.toString()
    })

    return output.outputData
  }

  throw createError({ statusCode: 404, message: 'Vídeo não encontrado (nem em disco nem no banco)' })
})
