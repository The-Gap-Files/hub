import { prisma } from '../../utils/prisma'
import { getVisualStyleById } from '../../constants/visual-styles'
import { getScriptStyleById } from '../../constants/script-styles'
import { getClassificationById } from '../../constants/intelligence-classifications'
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
              variantIndex: true,
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
              variantIndex: true,
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
      }
    }
  })

  if (!output) {
    throw createError({
      statusCode: 404,
      message: 'Output not found'
    })
  }

  const thumbnailCandidates = output.thumbnailCandidates as Array<{ base64: string; prompt: string }> | null
  const hasThumbnail = !!output.thumbnailData

  return {
    id: output.id,
    dossierId: output.dossierId,
    outputType: output.outputType,
    format: output.format,
    title: output.title || undefined,
    duration: output.duration || undefined,
    aspectRatio: output.aspectRatio || undefined,
    platform: output.platform || undefined,
    enableMotion: output.enableMotion,
    status: output.status,
    storyOutlineApproved: output.storyOutlineApproved,
    scriptApproved: output.scriptApproved,
    imagesApproved: output.imagesApproved,
    bgmApproved: output.bgmApproved,
    audioApproved: output.audioApproved,
    videosApproved: output.videosApproved,
    renderApproved: output.renderApproved,
    hasBgm: output.audioTracks?.some((a: any) => a.type === 'background_music') || false,
    errorMessage: output.errorMessage || undefined,
    createdAt: output.createdAt,
    updatedAt: output.updatedAt,
    completedAt: output.completedAt || undefined,
    hasVideo: !!output.outputData || !!output.outputPath,
    isStoredOnDisk: !!output.outputPath && !output.outputData,
    outputMimeType: output.outputMimeType || undefined,
    outputSize: output.outputSize || 0,
    hasCaptionedVideo: !!output.captionedVideoData,
    captionedVideoSize: output.captionedVideoSize || 0,
    storyOutline: output.storyOutline || undefined,
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
    thumbnailCandidates: Array.isArray(thumbnailCandidates) ? thumbnailCandidates : null,
    hasThumbnail,
    socialKit: output.socialKit || null
  }
})
