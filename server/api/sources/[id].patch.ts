import { z } from 'zod'
import { prisma } from '../../utils/prisma'

const UpdateSourceSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  url: z.union([z.string().url(), z.literal('')]).optional().transform(v => v || undefined),
  author: z.string().max(255).optional()
})

export default defineEventHandler(async (event) => {
  const sourceId = getRouterParam(event, 'id')

  if (!sourceId) {
    throw createError({
      statusCode: 400,
      message: 'Source ID is required'
    })
  }

  const source = await prisma.dossierSource.findUnique({
    where: { id: sourceId }
  })

  if (!source) {
    throw createError({
      statusCode: 404,
      message: 'Source not found'
    })
  }

  const body = await readBody(event)
  const data = UpdateSourceSchema.parse(body)

  const updated = await prisma.dossierSource.update({
    where: { id: sourceId },
    data
  })

  return updated
})
