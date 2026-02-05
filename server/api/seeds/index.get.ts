import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const visualStyleId = query.visualStyleId as string | undefined
    const isActive = query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined
    const isDefault = query.isDefault === 'true' ? true : undefined

    const seeds = await prisma.seed.findMany({
      where: {
        ...(visualStyleId && { visualStyleId }),
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault })
      },
      include: {
        visualStyle: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            outputs: true
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
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
