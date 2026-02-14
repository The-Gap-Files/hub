import { prisma } from '../../../utils/prisma'
import type { CloneOutputResponse, OutputResponse } from '../../../types/output.types'

export default defineEventHandler(async (event): Promise<CloneOutputResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID is required'
    })
  }

  const source = await prisma.output.findUnique({
    where: { id },
    include: {
      script: {
        include: {
          backgroundMusicTracks: true
        }
      },
      scenes: {
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!source) {
    throw createError({
      statusCode: 404,
      message: 'Output not found'
    })
  }

  if (!source.script) {
    throw createError({
      statusCode: 422,
      message: 'Output has no script to clone. Approve or generate a script first.'
    })
  }

  const script = source.script

  const newOutput = await prisma.$transaction(async (tx) => {
    const created = await tx.output.create({
      data: {
        dossierId: source.dossierId,
        outputType: source.outputType,
        format: source.format,
        title: source.title ? `${source.title} (cópia)` : undefined,
        duration: source.duration,
        aspectRatio: source.aspectRatio,
        platform: source.platform,
        targetWPM: source.targetWPM,
        language: source.language,
        narrationLanguage: source.narrationLanguage,
        voiceId: source.voiceId,
        enableMotion: source.enableMotion,
        objective: source.objective,
        mustInclude: source.mustInclude,
        mustExclude: source.mustExclude,
        scriptStyleId: source.scriptStyleId,
        visualStyleId: source.visualStyleId,
        seedId: source.seedId,
        status: 'PENDING',
        scriptApproved: true,
        imagesApproved: false,
        bgmApproved: false,
        audioApproved: false,
        videosApproved: false,
        renderApproved: false,
        ...(source.storyOutline != null ? { storyOutline: source.storyOutline } : {})
      }
    })

    await tx.script.create({
      data: {
        outputId: created.id,
        summary: script.summary,
        fullText: script.fullText,
        wordCount: script.wordCount,
        provider: script.provider,
        modelUsed: script.modelUsed,
        promptUsed: script.promptUsed,
        backgroundMusicPrompt: script.backgroundMusicPrompt,
        backgroundMusicVolume: script.backgroundMusicVolume
      }
    })

    const newScript = await tx.script.findUnique({
      where: { outputId: created.id },
      include: { backgroundMusicTracks: true }
    })
    if (!newScript) throw new Error('Script not created')

    for (const track of script.backgroundMusicTracks) {
      await tx.backgroundMusicTrack.create({
        data: {
          scriptId: newScript.id,
          prompt: track.prompt,
          volume: track.volume,
          startScene: track.startScene,
          endScene: track.endScene
        }
      })
    }

    for (const scene of source.scenes) {
      await tx.scene.create({
        data: {
          outputId: created.id,
          order: scene.order,
          narration: scene.narration,
          visualDescription: scene.visualDescription,
          audioDescription: scene.audioDescription,
          audioDescriptionVolume: scene.audioDescriptionVolume,
          sceneEnvironment: scene.sceneEnvironment,
          motionDescription: scene.motionDescription,
          startTime: scene.startTime,
          endTime: scene.endTime,
          estimatedDuration: scene.estimatedDuration
        }
      })
    }

    return created
  })

  const response: OutputResponse = {
    id: newOutput.id,
    dossierId: newOutput.dossierId,
    outputType: newOutput.outputType,
    format: newOutput.format,
    title: newOutput.title ?? undefined,
    duration: newOutput.duration ?? undefined,
    aspectRatio: newOutput.aspectRatio ?? undefined,
    platform: newOutput.platform ?? undefined,
    status: newOutput.status,
    scriptApproved: newOutput.scriptApproved,
    imagesApproved: newOutput.imagesApproved,
    bgmApproved: newOutput.bgmApproved,
    audioApproved: newOutput.audioApproved,
    videosApproved: newOutput.videosApproved,
    renderApproved: newOutput.renderApproved,
    hasBgm: false,
    enableMotion: newOutput.enableMotion,
    createdAt: newOutput.createdAt,
    updatedAt: newOutput.updatedAt,
    completedAt: newOutput.completedAt ?? undefined
  }

  return { output: response }
})
