import { prisma } from '../../utils/prisma'
import { z } from 'zod'

const createSeedSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  description: z.string().optional(),
  value: z.number().int().min(0, 'Valor deve ser positivo'),
  visualStyleId: z.string().uuid('ID do estilo visual inválido'),
  category: z.string().max(50).optional(),
  tags: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  previewUrl: z.string().url().optional().or(z.literal(''))
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const validated = createSeedSchema.parse(body)

    // Verificar se estilo visual existe
    const visualStyle = await prisma.visualStyle.findUnique({
      where: { id: validated.visualStyleId }
    })

    if (!visualStyle) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Estilo visual não encontrado'
      })
    }

    // Verificar se já existe seed com esse valor para este estilo
    const existing = await prisma.seed.findFirst({
      where: {
        visualStyleId: validated.visualStyleId,
        value: validated.value
      }
    })

    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe uma seed com este valor para este estilo visual'
      })
    }

    // Se isDefault = true, remover default de outras seeds do mesmo estilo
    if (validated.isDefault) {
      await prisma.seed.updateMany({
        where: {
          visualStyleId: validated.visualStyleId,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    // Criar seed
    const seed = await prisma.seed.create({
      data: {
        name: validated.name,
        description: validated.description,
        value: validated.value,
        visualStyleId: validated.visualStyleId,
        category: validated.category,
        tags: validated.tags,
        isDefault: validated.isDefault ?? false,
        isActive: validated.isActive ?? true,
        previewUrl: validated.previewUrl || null
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
      data: seed
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
      statusMessage: 'Erro ao criar seed',
      data: { error: error.message }
    })
  }
})
