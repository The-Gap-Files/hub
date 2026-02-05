import { prisma } from '../../utils/prisma'
import type { OutputWithRelationsResponse } from '../../types/output.types'

export default defineEventHandler(async (event): Promise<OutputWithRelationsResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID is required'
    })
  }

  // Buscar output com relações
  const output = await prisma.output.findUnique({
    where: { id },
    include: {
      dossier: {
        select: {
          id: true,
          title: true,
          theme: true
        }
      },
      scriptStyle: {
        select: {
          id: true,
          name: true
        }
      },
      visualStyle: {
        select: {
          id: true,
          name: true
        }
      },
      relationsFrom: {
        include: {
          relatedOutput: {
            select: {
              id: true,
              outputType: true
            }
          }
        }
      }
    }
  })

  if (!output) {
    throw createError({
      statusCode: 404,
      message: 'Output not found'
    })
  }

  return {
    id: output.id,
    dossierId: output.dossierId,
    outputType: output.outputType,
    format: output.format,
    title: output.title || undefined,
    duration: output.duration || undefined,
    aspectRatio: output.aspectRatio || undefined,
    platform: output.platform || undefined,
    status: output.status,
    scriptApproved: output.scriptApproved,
    imagesApproved: output.imagesApproved,
    videosApproved: output.videosApproved,
    errorMessage: output.errorMessage || undefined,
    createdAt: output.createdAt,
    updatedAt: output.updatedAt,
    completedAt: output.completedAt || undefined,
    dossier: output.dossier,
    scriptStyle: output.scriptStyle || undefined,
    visualStyle: output.visualStyle || undefined,
    relatedOutputs: output.relationsFrom?.map((rel: any) => ({
      id: rel.relatedOutput.id,
      outputType: rel.relatedOutput.outputType,
      relationType: rel.relationType
    })) || []
  }
})
