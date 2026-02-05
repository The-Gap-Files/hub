import { prisma } from '../../utils/prisma'
import type { DocumentWithRelationsResponse } from '../../types/document.types'

export default defineEventHandler(async (event): Promise<DocumentWithRelationsResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Document ID is required'
    })
  }

  // Buscar document com todas as relações
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      sources: {
        orderBy: { order: 'asc' }
      },
      images: {
        orderBy: { order: 'asc' }
      },
      notes: {
        orderBy: { order: 'asc' }
      },
      _count: {
        select: {
          outputs: true
        }
      }
    }
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      message: 'Document not found'
    })
  }

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
    updatedAt: document.updatedAt,
    outputsCount: document._count.outputs,
    sources: document.sources,
    images: document.images,
    notes: document.notes
  }
})
