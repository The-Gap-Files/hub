import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import type { CreateDocumentDTO, DocumentResponse } from '~/server/types/document.types'

// Schema de validação
const CreateDocumentSchema = z.object({
  title: z.string().min(3).max(255),
  sourceText: z.string().min(10),
  theme: z.string().min(3),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().max(50).optional()
})

export default defineEventHandler(async (event): Promise<DocumentResponse> => {
  // Validar request body
  const body = await readBody(event)
  const data = CreateDocumentSchema.parse(body) as CreateDocumentDTO

  // Criar document
  const document = await prisma.document.create({
    data: {
      title: data.title,
      sourceText: data.sourceText,
      theme: data.theme,
      tags: data.tags || [],
      category: data.category,
      isProcessed: false
    }
  })

  // Retornar response
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
