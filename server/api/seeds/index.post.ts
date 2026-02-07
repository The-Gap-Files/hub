import { prisma } from '../../utils/prisma'
import { z } from 'zod'

const createSeedSchema = z.object({
  value: z.number().int().min(0, 'Valor deve ser positivo')
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const validated = createSeedSchema.parse(body)

    // Verificar se já existe seed com esse valor
    const existing = await prisma.seed.findUnique({
      where: {
        value: validated.value
      }
    })

    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe uma seed científica registrada com este valor no repositório global'
      })
    }

    // Criar seed atômica
    const seed = await prisma.seed.create({
      data: {
        value: validated.value,
        usageCount: 0
      }
    })

    return {
      success: true,
      data: seed
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Dados genéticos inválidos',
        data: { errors: error.errors }
      })
    }

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao registrar DNA',
      data: { error: error.message }
    })
  }
})
