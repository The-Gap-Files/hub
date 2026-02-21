import { prisma } from '../../utils/prisma'
import { costLogService } from '../../services/cost-log.service'
import type { DossierWithRelationsResponse } from '../../types/dossier.types'

async function addHasReferenceImage(persons: any[]) {
  if (!persons.length) return persons
  const withImage = await prisma.dossierPerson.findMany({
    where: { id: { in: persons.map(p => p.id) }, referenceImage: { not: null } },
    select: { id: true }
  })
  const imageSet = new Set(withImage.map(p => p.id))
  return persons.map(p => ({ ...p, hasReferenceImage: imageSet.has(p.id) }))
}

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
        select: {
          id: true, dossierId: true, name: true, role: true,
          description: true, visualDescription: true, aliases: true,
          relevance: true, order: true, createdAt: true, updatedAt: true
          // referenceImage omitido — Buffer pesado
        },
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
    persons: await addHasReferenceImage(dossier.persons)
  }
})
