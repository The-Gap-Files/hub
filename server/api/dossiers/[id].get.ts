import { prisma } from '../../utils/prisma'
import { costLogService } from '../../services/cost-log.service'
import type { DossierWithRelationsResponse } from '../../types/dossier.types'

export default defineEventHandler(async (event): Promise<DossierWithRelationsResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Buscar dossier com todas as relações
  const dossier = await prisma.dossier.findUnique({
    where: { id },
    include: {
      channel: { select: { id: true, name: true, handle: true } },
      sources: {
        orderBy: { order: 'asc' }
      },
      images: {
        orderBy: { order: 'asc' }
      },
      notes: {
        orderBy: { order: 'asc' }
      },
      persons: {
        orderBy: [{ relevance: 'asc' }, { order: 'asc' }]
      },
      _count: {
        select: {
          outputs: true
        }
      }
    }
  })

  if (!dossier) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  const costs = await costLogService.getDossierCost(id)

  return {
    id: dossier.id,
    title: dossier.title,
    sourceText: dossier.sourceText,
    theme: dossier.theme,
    researchData: dossier.researchData,
    tags: dossier.tags,
    visualIdentityContext: dossier.visualIdentityContext,
    preferredVisualStyleId: dossier.preferredVisualStyleId,
    preferredSeedId: dossier.preferredSeedId,
    isProcessed: dossier.isProcessed,
    channelId: dossier.channelId,
    channelName: dossier.channel?.name ?? null,
    channelHandle: dossier.channel?.handle ?? null,
    createdAt: dossier.createdAt,
    updatedAt: dossier.updatedAt,
    outputsCount: dossier._count.outputs,
    totalOutputsCost: costs.grandTotal,
    sources: dossier.sources,
    images: dossier.images,
    notes: dossier.notes,
    persons: dossier.persons
  }
})
