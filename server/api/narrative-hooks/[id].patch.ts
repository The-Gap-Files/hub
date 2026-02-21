import { prisma } from '../../utils/prisma'
import { z } from 'zod'

const updateHookSchema = z.object({
  type: z.string().optional(),
  sourceType: z.string().optional(),
  sourceTitle: z.string().optional(),
  genres: z.array(z.string()).optional(),
  hookText: z.string().optional(),
  duration: z.string().optional(),
  emotionalTemperature: z.string().optional(),
  tags: z.array(z.string()).optional(),
  structuralPattern: z.string().nullable().optional(),
  structuralElements: z.array(z.string()).optional(),
  pacing: z.string().nullable().optional(),
  whyItWorks: z.string().nullable().optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID não fornecido'
      })
    }

    const body = await readBody(event)
    const validated = updateHookSchema.parse(body)

    const hook = await prisma.narrativeHook.update({
      where: { id },
      data: validated
    })

    return {
      success: true,
      data: hook
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Dados inválidos',
        data: { errors: error.errors }
      })
    }

    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Hook não encontrado'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao atualizar hook',
      data: { error: error.message }
    })
  }
})
