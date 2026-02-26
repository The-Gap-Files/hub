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

    const seed = await prisma.seed.findUnique({
      where: { id },
      include: {
        outputs: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    })

    if (!seed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'DNA não encontrado'
      })
    }

    return {
      success: true,
      data: seed
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao buscar DNA',
      data: { error: error.message }
    })
  }
})
