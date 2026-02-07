import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  try {
    const seeds = await prisma.seed.findMany({
      include: {
        _count: {
          select: {
            outputs: true
          }
        }
      },
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return {
      success: true,
      data: seeds
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao buscar seeds',
      data: { error: error.message }
    })
  }
})
