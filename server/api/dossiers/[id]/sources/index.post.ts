import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'

const CreateSourceSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  sourceType: z.enum(['url', 'text']),
  url: z.union([z.string().url(), z.literal('')]).optional().transform(v => v || undefined),
  author: z.string().max(255).optional(),
  order: z.number().int().min(0).optional().default(0)
})

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Verificar se dossier existe
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId }
  })

  if (!dossier) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  // Validar body
  const body = await readBody(event)
  const data = CreateSourceSchema.parse(body)

  // Criar source
  const source = await prisma.dossierSource.create({
    data: {
      dossierId,
      ...data
    }
  })

  return source
})
