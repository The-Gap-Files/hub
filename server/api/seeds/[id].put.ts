import { prisma } from '../../utils/prisma'
import { z } from 'zod'

const updateSeedSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  value: z.number().int().min(0).optional(),
  category: z.string().max(50).optional(),
  tags: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  previewUrl: z.string().url().optional().or(z.literal(''))
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
    const validated = updateSeedSchema.parse(body)

    // Verificar se existe
    const existing = await prisma.seed.findUnique({
      where: { id }
    })

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Seed não encontrada'
      })
    }

    // Se mudando valor, verificar duplicidade
    if (validated.value !== undefined && validated.value !== existing.value) {
      const duplicate = await prisma.seed.findFirst({
        where: {
          visualStyleId: existing.visualStyleId,
          value: validated.value,
          id: { not: id }
        }
      })

      if (duplicate) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Já existe uma seed com este valor para este estilo visual'
        })
      }
    }

    // Se isDefault = true, remover default de outras seeds do mesmo estilo
    if (validated.isDefault) {
      await prisma.seed.updateMany({
        where: {
          visualStyleId: existing.visualStyleId,
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      })
    }

    // Atualizar
    const updated = await prisma.seed.update({
      where: { id },
      data: {
        ...validated,
        previewUrl: validated.previewUrl === '' ? null : validated.previewUrl
      },
      include: {
        visualStyle: {
          select: {
            id: true,
            name: true
          }
        }
      }
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
      statusMessage: 'Erro ao atualizar seed',
      data: { error: error.message }
    })
  }
})
