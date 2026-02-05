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
        visualStyle: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        outputs: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            thumbnailPath: true
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
        statusMessage: 'Seed não encontrada'
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
      statusMessage: 'Erro ao buscar seed',
      data: { error: error.message }
    })
  }
})
