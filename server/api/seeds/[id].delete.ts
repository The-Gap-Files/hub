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

    // Deletar permanentemente
    // Prisma cuidará das referências (SetNull) conforme configurado no schema
    await prisma.seed.delete({
      where: { id }
    })

    return {
      success: true,
      message: 'DNA removido permanentemente do repositório'
    }
  } catch (error: any) {
    if (error.code === 'P2025') { // Prisma Record not found
      throw createError({
        statusCode: 404,
        statusMessage: 'DNA não encontrado no repositório'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao remover DNA',
      data: { error: error.message }
    })
  }
})
