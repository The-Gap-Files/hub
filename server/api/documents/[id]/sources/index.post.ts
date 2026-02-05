import { z } from 'zod'
import { prisma } from '../../../utils/prisma'

const CreateSourceSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  sourceType: z.enum(['article', 'paper', 'quote', 'transcript']),
  url: z.string().url().optional(),
  author: z.string().max(255).optional(),
  order: z.number().int().min(0).optional().default(0)
})

export default defineEventHandler(async (event) => {
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      message: 'Document ID is required'
    })
  }

  // Verificar se document existe
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      message: 'Document not found'
    })
  }

  // Validar body
  const body = await readBody(event)
  const data = CreateSourceSchema.parse(body)

  // Criar source
  const source = await prisma.documentSource.create({
    data: {
      documentId,
      ...data
    }
  })

  return source
})
