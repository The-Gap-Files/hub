import { prisma } from '../../utils/prisma'
import type { DocumentListResponse } from '../../types/document.types'

export default defineEventHandler(async (event): Promise<DocumentListResponse> => {
  // Query params
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 20
  const category = query.category as string | undefined

  // Build where clause
  const where: any = {}
  if (category) {
    where.category = category
  }

  // Get documents with counts
  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: {
            sources: true,
            images: true,
            notes: true,
            outputs: true
          }
        }
      }
    }),
    prisma.document.count({ where })
  ])

  return {
    documents: documents.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      sourceText: doc.sourceText,
      theme: doc.theme,
      researchData: doc.researchData,
      tags: doc.tags,
      category: doc.category || undefined,
      isProcessed: doc.isProcessed,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      sourcesCount: doc._count.sources,
      imagesCount: doc._count.images,
      notesCount: doc._count.notes,
      outputsCount: doc._count.outputs
    })),
    total,
    page,
    pageSize
  }
})
