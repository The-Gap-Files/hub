import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const styles = await prisma.visualStyle.findMany({
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    return {
      success: true,
      data: styles
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao buscar estilos visuais',
      data: { error: error.message }
    })
  }
})
