import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import type { UpdateDocumentDTO, DocumentResponse } from '~/server/types/document.types'

// Schema de validação
const UpdateDocumentSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  sourceText: z.string().min(10).optional(),
  theme: z.string().min(3).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().max(50).optional(),
  researchData: z.any().optional(),
  isProcessed: z.boolean().optional()
})

export default defineEventHandler(async (event): Promise<DocumentResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Document ID is required'
    })
  }

  // Validar request body
  const body = await readBody(event)
  const data = UpdateDocumentSchema.parse(body) as UpdateDocumentDTO

  // Verificar se document existe
  const existing = await prisma.document.findUnique({
    where: { id }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Document not found'
    })
  }

  // Atualizar document
  const document = await prisma.document.update({
    where: { id },
    data
  })

  return {
    id: document.id,
    title: document.title,
    sourceText: document.sourceText,
    theme: document.theme,
    researchData: document.researchData,
    tags: document.tags,
    category: document.category || undefined,
    isProcessed: document.isProcessed,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  }
})
