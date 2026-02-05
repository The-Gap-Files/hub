import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Verificar se dossier existe
  const existing = await prisma.dossier.findUnique({
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
      message: 'Dossier not found'
    })
  }

  // Verificar se tem outputs (aviso)
  if (existing._count.outputs > 0) {
    // Ainda permite deletar (cascade), mas loga warning
    console.warn(`Deleting dossier ${id} with ${existing._count.outputs} outputs`)
  }

  // Deletar dossier (cascade deleta outputs, sources, images, notes)
  await prisma.dossier.delete({
    where: { id }
  })

  return {
    success: true,
    message: 'Dossier deleted successfully'
  }
})
