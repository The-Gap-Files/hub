import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const styleId = getRouterParam(event, 'styleId')
    if (!styleId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID do estilo visual é obrigatório'
      })
    }

    // Verificar se estilo existe
    const style = await prisma.visualStyle.findUnique({
      where: { id: styleId }
    })

    if (!style) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Estilo visual não encontrado'
      })
    }

    const seeds = await prisma.seed.findMany({
      where: {
        visualStyleId: styleId,
        isActive: true
      },
      include: {
        _count: {
          select: {
            videos: true
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
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao buscar seeds do estilo visual',
      data: { error: error.message }
    })
  }
})
