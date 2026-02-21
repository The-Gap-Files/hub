import { prisma } from '../../utils/prisma'
import { z } from 'zod'

const createHookSchema = z.object({
  type: z.string().min(1),
  sourceType: z.string().min(1),
  sourceTitle: z.string().min(1),
  genres: z.array(z.string()).default([]),
  hookText: z.string().min(1),
  duration: z.string().min(1),
  emotionalTemperature: z.string().min(1),
  tags: z.array(z.string()).default([]),
  structuralPattern: z.string().optional(),
  structuralElements: z.array(z.string()).default([]),
  pacing: z.string().optional(),
  whyItWorks: z.string().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const validated = createHookSchema.parse(body)

    const hook = await prisma.narrativeHook.create({
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

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao criar hook narrativo',
      data: { error: error.message }
    })
  }
})
