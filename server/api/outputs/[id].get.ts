import { prisma } from '../../utils/prisma'
import { getVisualStyleById } from '../../constants/cinematography/visual-styles'
import { getScriptStyleById } from '../../constants/storytelling/script-styles'
import { getClassificationById } from '../../constants/content/intelligence-classifications'
import { getEditorialObjectiveById } from '../../constants/content/editorial-objectives'
import type { OutputWithRelationsResponse } from '../../types/output.types'

export default defineEventHandler(async (event): Promise<OutputWithRelationsResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID is required'
    })
  }

  const output: any = await prisma.output.findUnique({
    where: { id },
    include: {
      dossier: {
        select: {
          id: true,
          title: true,
          theme: true
        }
      },
      // Stage gates (replaces 9 approval booleans)
      stageGates: {
        select: {
          stage: true,
          status: true,
          feedback: true,
          executedAt: true,
          reviewedAt: true
        }
      },
      // Product tables
      storyOutlineData: {
        select: {
          outlineData: true,
          provider: true,
          model: true
        }
      },
      retentionQAData: {
        select: {
          overallScore: true,
          summary: true,
          analysisData: true,
          provider: true,
          model: true
        }
      },
      monetizationData: {
        select: {
          contextData: true
        }
      },
      socialKitData: {
        select: {
          kitData: true
        }
      },
      thumbnailProduct: {
        select: {
          candidates: true,
          selectedStoragePath: true,
          selectedAt: true
        }
      },
      renderProduct: {
        select: {
          videoStoragePath: true,
          mimeType: true,
          fileSize: true,
          captionedStoragePath: true,
          captionedFileSize: true,
          renderOptions: true,
          renderedAt: true
        }
      },
      // Content
      script: {
        include: {
          backgroundMusicTracks: true
        }
      },
      audioTracks: {
        select: {
          id: true,
          type: true,
          provider: true,
          voiceId: true,
          mimeType: true,
          originalSize: true,
          duration: true,
          offsetMs: true,
          createdAt: true
        }
      },
      scenes: {
        orderBy: { order: 'asc' },
        include: {
          images: {
            select: {
              id: true,
              provider: true,
              promptUsed: true,
              mimeType: true,
              originalSize: true,
              width: true,
              height: true,
              isSelected: true,
              role: true,
              createdAt: true
            }
          },
          videos: {
            select: {
              id: true,
              provider: true,
              promptUsed: true,
              mimeType: true,
              originalSize: true,
              duration: true,
              isSelected: true,
              createdAt: true
            }
          },
          audioTracks: {
            select: {
              id: true,
              type: true,
              provider: true,
              voiceId: true,
              mimeType: true,
              originalSize: true,
              duration: true,
              createdAt: true
            }
          }
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
      },
      seed: {
        select: {
          id: true,
          value: true
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

  // Derive editorialObjective from monetizationData
  const monetizationContext = output.monetizationData?.contextData
  const editorialObjectiveId = typeof monetizationContext?.editorialObjectiveId === 'string'
    ? monetizationContext.editorialObjectiveId
    : undefined
  const editorialObjective = editorialObjectiveId ? getEditorialObjectiveById(editorialObjectiveId) : undefined

  return {
    id: output.id,
    dossierId: output.dossierId,
    outputType: output.outputType,
    format: output.format,
    title: output.title || undefined,
    duration: output.duration || undefined,
    aspectRatio: output.aspectRatio || undefined,
    platform: output.platform || undefined,
    targetWPM: output.targetWPM,
    language: output.language,
    narrationLanguage: output.narrationLanguage,
    voiceId: output.voiceId || undefined,
    speechConfiguredAt: output.speechConfiguredAt || undefined,
    ttsProvider: output.ttsProvider || undefined,
    enableMotion: output.enableMotion,
    status: output.status,
    hasBgm: output.audioTracks?.some((a: any) => a.type === 'background_music') || false,
    errorMessage: output.errorMessage || undefined,
    createdAt: output.createdAt,
    updatedAt: output.updatedAt,
    completedAt: output.completedAt || undefined,
    objective: output.objective || undefined,
    mustInclude: output.mustInclude || undefined,
    mustExclude: output.mustExclude || undefined,
    classificationId: output.classificationId || undefined,
    scriptStyleId: output.scriptStyleId || undefined,
    visualStyleId: output.visualStyleId || undefined,
    seedId: output.seedId || undefined,
    seedValue: output.seed?.value ?? undefined,
    editorialObjectiveId,
    editorialObjective: editorialObjective ? { id: editorialObjective.id, name: editorialObjective.name, category: editorialObjective.category } : undefined,

    // Stage gates
    stageGates: output.stageGates || [],

    // Product tables
    storyOutlineData: output.storyOutlineData || null,
    retentionQAData: output.retentionQAData || null,
    monetizationData: output.monetizationData || null,
    socialKitData: output.socialKitData || null,
    thumbnailProduct: output.thumbnailProduct || null,
    renderProduct: output.renderProduct || null,

    // Relations
    dossier: output.dossier,
    scriptStyle: output.scriptStyleId ? getScriptStyleById(output.scriptStyleId) : undefined,
    visualStyle: output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined,
    classification: output.classificationId ? (() => {
      const c = getClassificationById(output.classificationId)
      return c ? { id: c.id, label: c.label } : undefined
    })() : undefined,
    script: output.script || undefined,
    audioTracks: output.audioTracks || [],
    scenes: output.scenes || [],
    relatedOutputs: output.relationsFrom?.map((rel: any) => ({
      id: rel.relatedOutput.id,
      outputType: rel.relatedOutput.outputType,
      relationType: rel.relationType
    })) || [],
  }
})
