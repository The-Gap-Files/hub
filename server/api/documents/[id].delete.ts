import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Document ID is required'
    })
  }

  // Verificar se document existe
  const existing = await prisma.document.findUnique({
    where: { id },
    include: {
      _count: {
        select: { outputs: true }
      }
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Document not found'
    })
  }

  // Verificar se tem outputs (aviso)
  if (existing._count.outputs > 0) {
    // Ainda permite deletar (cascade), mas loga warning
    console.warn(`Deleting document ${id} with ${existing._count.outputs} outputs`)
  }

  // Deletar document (cascade deleta outputs, sources, images, notes)
  await prisma.document.delete({
    where: { id }
  })

  return {
    success: true,
    message: 'Document deleted successfully'
  }
})
