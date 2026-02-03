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
    const existing = await prisma.visualStyle.findUnique({
      where: { id }
    })

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Estilo visual não encontrado'
      })
    }

    // Deletar
    await prisma.visualStyle.delete({
      where: { id }
    })

    return {
      success: true,
      message: 'Estilo visual deletado com sucesso'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao deletar estilo visual',
      data: { error: error.message }
    })
  }
})
