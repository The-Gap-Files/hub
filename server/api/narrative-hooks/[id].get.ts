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

    const hook = await prisma.narrativeHook.findUnique({
      where: { id }
    })

    if (!hook) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Hook não encontrado'
      })
    }

    return {
      success: true,
      data: hook
    }
  } catch (error: any) {
    if (error.statusCode) throw error

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao buscar hook',
      data: { error: error.message }
    })
  }
})
