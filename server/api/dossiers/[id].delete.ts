import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Verificar se dossier existe e contar relações
  const existing = await prisma.dossier.findUnique({
    where: { id },
    include: {
      _count: {
        select: { sources: true, outputs: true }
      }
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  // Regra de negócio: só pode deletar se NÃO houver fontes
  if (existing._count.sources > 0) {
    throw createError({
      statusCode: 422,
      message: `Não é possível deletar este dossiê: ele possui ${existing._count.sources} fonte(s) vinculada(s). Remova todas as fontes antes de deletar.`
    })
  }

  // Loga warning se tem outputs (serão deletados em cascata)
  if (existing._count.outputs > 0) {
    console.warn(`[DELETE] Deleting dossier ${id} with ${existing._count.outputs} outputs (cascade)`)
  }

  // Deletar dossier (cascade deleta outputs, images, notes, etc.)
  await prisma.dossier.delete({
    where: { id }
  })

  return {
    success: true,
    message: 'Dossier deleted successfully'
  }
})
