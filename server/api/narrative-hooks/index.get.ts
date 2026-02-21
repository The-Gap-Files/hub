import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { type, emotionalTemperature, sourceType, search, isActive = 'true' } = query

    const where: any = {
      isActive: isActive === 'true'
    }

    if (type) where.type = type as string
    if (emotionalTemperature) where.emotionalTemperature = emotionalTemperature as string
    if (sourceType) where.sourceType = sourceType as string

    if (search) {
      where.OR = [
        { hookText: { contains: search as string, mode: 'insensitive' } },
        { sourceTitle: { contains: search as string, mode: 'insensitive' } },
        { tags: { has: search as string } }
      ]
    }

    const hooks = await prisma.narrativeHook.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return {
      success: true,
      data: hooks
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao buscar hooks narrativos',
      data: { error: error.message }
    })
  }
})
