import { prisma } from '../../utils/prisma'
import { z } from 'zod'

const createStyleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  description: z.string().min(1, 'Descrição é obrigatória'),
  baseStyle: z.string().min(1, 'Estilo base é obrigatório'),
  lightingTags: z.string().min(1, 'Tags de iluminação são obrigatórias'),
  atmosphereTags: z.string().min(1, 'Tags de atmosfera são obrigatórias'),
  compositionTags: z.string().min(1, 'Tags de composição são obrigatórias'),
  tags: z.string().min(1, 'Tags gerais são obrigatórias'),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validação
    const validated = createStyleSchema.parse(body)

    // Criar estilo
    const style = await prisma.visualStyle.create({
      data: {
        name: validated.name,
        description: validated.description,
        baseStyle: validated.baseStyle,
        lightingTags: validated.lightingTags,
        atmosphereTags: validated.atmosphereTags,
        compositionTags: validated.compositionTags,
        tags: validated.tags,
        order: validated.order ?? 0,
        isActive: validated.isActive ?? true
      }
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
        data: { errors: error.errors }
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao criar estilo visual',
      data: { error: error.message }
    })
  }
})
