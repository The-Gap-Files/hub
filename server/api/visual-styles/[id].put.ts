import { prisma } from '../../utils/prisma'
import { z } from 'zod'

const updateStyleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).optional(),
  tags: z.string().min(1).optional(),
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

    // Verificar se existe
    const existing = await prisma.visualStyle.findUnique({
      where: { id }
    })

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Estilo visual não encontrado'
      })
    }

    // Atualizar
    const updated = await prisma.visualStyle.update({
      where: { id },
      data: validated
    })

    return {
      success: true,
      data: updated
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Dados inválidos',
        data: { errors: error.errors }
      })
    }

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao atualizar estilo visual',
      data: { error: error.message }
    })
  }
})
