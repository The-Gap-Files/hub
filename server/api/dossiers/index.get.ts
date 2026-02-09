import { prisma } from '../../utils/prisma'
import type { DossierListResponse } from '../../types/dossier.types'

export default defineEventHandler(async (event): Promise<DossierListResponse> => {
  // Query params
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 20

  // Get dossiers with counts (filtro por category removido: classificação está no output)
  const [dossiers, total] = await Promise.all([
    prisma.dossier.findMany({
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
    prisma.dossier.count()
  ])

  const dossierIds = dossiers.map((d: any) => d.id)
  const [outputsWithCosts, dossierLevelLogs] = await Promise.all([
    prisma.output.findMany({
      where: { dossierId: { in: dossierIds } },
      select: {
        dossierId: true,
        costLogs: { select: { cost: true } }
      }
    }),
    prisma.costLog.findMany({
      where: { dossierId: { in: dossierIds } },
      select: { dossierId: true, cost: true }
    })
  ])
  const costByDossierId: Record<string, number> = {}
  for (const output of outputsWithCosts) {
    const sum = output.costLogs.reduce((s, l) => s + l.cost, 0)
    costByDossierId[output.dossierId] = (costByDossierId[output.dossierId] ?? 0) + sum
  }
  for (const log of dossierLevelLogs) {
    if (log.dossierId) {
      costByDossierId[log.dossierId] = (costByDossierId[log.dossierId] ?? 0) + log.cost
    }
  }

  return {
    dossiers: dossiers.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      sourceText: doc.sourceText,
      theme: doc.theme,
      researchData: doc.researchData,
      tags: doc.tags,
      isProcessed: doc.isProcessed,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      sourcesCount: doc._count.sources,
      imagesCount: doc._count.images,
      notesCount: doc._count.notes,
      outputsCount: doc._count.outputs,
      totalOutputsCost: costByDossierId[doc.id] ?? 0
    })),
    total,
    page,
    pageSize
  }
})

