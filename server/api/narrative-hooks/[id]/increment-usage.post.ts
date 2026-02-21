import { prisma } from '../../../utils/prisma'

// Endpoint para incrementar o contador de uso quando um hook é utilizado
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID não fornecido'
      })
    }

    const hook = await prisma.narrativeHook.update({
      where: { id },
      data: {
        usageCount: {
          increment: 1
        }
      }
    })

    return {
      success: true,
      data: hook
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
      statusMessage: 'Erro ao incrementar contador de uso',
      data: { error: error.message }
    })
  }
})
