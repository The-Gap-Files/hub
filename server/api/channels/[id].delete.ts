import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Channel ID is required'
    })
  }

  const existing = await prisma.channel.findUnique({
    where: { id },
    include: {
      _count: {
        select: { dossiers: true }
      }
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Canal não encontrado'
    })
  }

  // Se tem dossiers vinculados, apenas desativa (soft delete)
  if (existing._count.dossiers > 0) {
    await prisma.channel.update({
      where: { id },
      data: { isActive: false }
    })

    return {
      success: true,
      message: `Canal desativado (${existing._count.dossiers} dossiês vinculados). Use PATCH para reativar.`
    }
  }

  // Sem dossiers: hard delete
  await prisma.channel.delete({
    where: { id }
  })

  return {
    success: true,
    message: 'Canal excluído com sucesso'
  }
})
