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

    await prisma.scriptStyle.delete({
      where: { id }
    })

    return {
      success: true,
      message: 'Estilo de roteiro deletado com sucesso'
    }
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Estilo de roteiro não encontrado'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao deletar estilo de roteiro',
      data: { error: error.message }
    })
  }
})
