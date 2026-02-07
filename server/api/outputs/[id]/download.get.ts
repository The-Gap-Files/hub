import { prisma } from '../../../utils/prisma'

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
      title: true
    }
  })

  if (!output || !output.outputData) {
    throw createError({ statusCode: 404, message: 'Vídeo não encontrado no banco de dados' })
  }

  // Configurar headers para download
  const fileName = `${output.title || 'video'}.mp4`

  setResponseHeaders(event, {
    'Content-Type': output.outputMimeType || 'video/mp4',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': output.outputData.length.toString()
  })

  return output.outputData
})
