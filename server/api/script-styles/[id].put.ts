import { prisma } from '../../utils/prisma'
import { z } from 'zod'

const updateStyleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).optional(),
  instructions: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID é obrigatório'
      })
    }

    const body = await readBody(event)
    const validated = updateStyleSchema.parse(body)

    // Atualizar estilo
    const style = await prisma.scriptStyle.update({
      where: { id },
      data: validated
    })

    return {
      success: true,
      data: style
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Dados inválidos',
        data: error.errors
      })
    }

    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Estilo de roteiro não encontrado'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao atualizar estilo de roteiro',
      data: { error: error.message }
    })
  }
})
