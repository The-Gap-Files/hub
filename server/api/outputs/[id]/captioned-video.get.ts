import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID é obrigatório'
    })
  }

  // Buscar vídeo legendado
  const output = await prisma.output.findUnique({
    where: { id },
    select: {
      captionedVideoData: true,
      outputMimeType: true
    }
  })

  if (!output || !output.captionedVideoData) {
    throw createError({
      statusCode: 404,
      message: 'Vídeo com legendas não encontrado'
    })
  }

  // Retornar vídeo legendado como stream
  setResponseHeaders(event, {
    'Content-Type': output.outputMimeType || 'video/mp4',
    'Content-Length': output.captionedVideoData.length.toString(),
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline'
  })

  return output.captionedVideoData
})
