import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID não fornecido'
      })
    }

    await prisma.narrativeHook.delete({
      where: { id }
    })

    return {
      success: true
    }
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Hook não encontrado'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao deletar hook',
      data: { error: error.message }
    })
  }
})
