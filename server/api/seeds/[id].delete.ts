import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID é obrigatório'
      })
    }

    // Verificar se existe
    const existing = await prisma.seed.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            outputs: true
          }
        }
      }
    })

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Seed não encontrada'
      })
    }

    // Se tem outputs vinculados, fazer soft delete
    if (existing._count.outputs > 0) {
      const updated = await prisma.seed.update({
        where: { id },
        data: {
          isActive: false
        }
      })

      return {
        success: true,
        message: `Seed desativada (${existing._count.outputs} outputs vinculados)`,
        data: updated
      }
    }

    // Se não tem outputs, deletar permanentemente
    await prisma.seed.delete({
      where: { id }
    })

    return {
      success: true,
      message: 'Seed deletada permanentemente'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao deletar seed',
      data: { error: error.message }
    })
  }
})
