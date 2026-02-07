import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID is required'
    })
  }

  // Verificar se output existe
  const output = await prisma.output.findUnique({
    where: { id }
  })

  if (!output) {
    throw createError({
      statusCode: 404,
      message: 'Output not found'
    })
  }

  // Deletar output (cascade cuidará das relações se configurado, ou deletar manualmente)
  // O schema tem onDelete: Cascade nas relações principais (Scene, AudioTrack, etc.)
  await prisma.output.delete({
    where: { id }
  })

  return {
    success: true,
    message: 'Output abortado e removido'
  }
})

