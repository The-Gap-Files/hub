import { prisma } from '../../../utils/prisma'
import type { PipelineStage } from '@prisma/client'

/**
 * Pipeline stage order — used for cascade reset.
 * When a stage is rejected, all downstream stages are reset to NOT_STARTED.
 */
const STAGE_SEQUENCE: PipelineStage[] = [
  'STORY_OUTLINE',
  'WRITER',
  'SCRIPT',
  'RETENTION_QA',
  'IMAGES',
  'BGM',
  'SFX',
  'AUDIO',
  'MUSIC_EVENTS',
  'MOTION',
  'RENDER',
]

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const { stage, status, feedback } = body as {
    stage: PipelineStage
    status: 'APPROVED' | 'REJECTED'
    feedback?: string
  }

  if (!stage || !status || !['APPROVED', 'REJECTED'].includes(status)) {
    throw createError({ statusCode: 400, message: 'stage (PipelineStage) e status (APPROVED|REJECTED) são obrigatórios' })
  }

  if (!STAGE_SEQUENCE.includes(stage)) {
    throw createError({ statusCode: 400, message: `Stage inválido: ${stage}` })
  }

  const now = new Date()

  // Upsert the StageGate for this stage
  await prisma.stageGate.upsert({
    where: { outputId_stage: { outputId: id, stage } },
    create: {
      outputId: id,
      stage,
      status,
      feedback: feedback || null,
      reviewedAt: now,
    },
    update: {
      status,
      feedback: feedback || null,
      reviewedAt: now,
    },
  })

  // STORY_OUTLINE special case: save selectedHookLevel/customScenes in StoryOutlineProduct
  if (stage === 'STORY_OUTLINE' && status === 'APPROVED') {
    if (body.selectedHookLevel) {
      const existing = await prisma.storyOutlineProduct.findUnique({
        where: { outputId: id },
        select: { outlineData: true },
      })
      if (existing?.outlineData && typeof existing.outlineData === 'object') {
        const updatedOutline = {
          ...(existing.outlineData as any),
          _selectedHookLevel: body.selectedHookLevel,
          ...(body.selectedHookLevel === 'custom' && body.customHook ? { _customHook: body.customHook } : {}),
          ...(Array.isArray(body.customScenes) && body.customScenes.length > 0
            ? {
                _customScenes: body.customScenes.slice(0, 5).map((s: any, i: number) => ({
                  order: s.order || i + 1,
                  narration: String(s.narration || '').trim(),
                  referenceImageId: s.referenceImageId || null,
                  imagePrompt: s.imagePrompt ? String(s.imagePrompt).trim() : null,
                })).filter((s: any) => s.narration),
              }
            : {}),
        }
        await prisma.storyOutlineProduct.update({
          where: { outputId: id },
          data: { outlineData: updatedOutline },
        })
      }
    }
  }

  // RENDER approved → mark Output as COMPLETED
  if (stage === 'RENDER' && status === 'APPROVED') {
    await prisma.output.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: now },
    })
  }

  // Clear stuck IN_PROGRESS status on approval of non-RENDER stages
  if (stage !== 'RENDER' && status === 'APPROVED') {
    const current = await prisma.output.findUnique({ where: { id }, select: { status: true } })
    if (current?.status === 'IN_PROGRESS') {
      await prisma.output.update({
        where: { id },
        data: { status: 'DRAFT', errorMessage: null },
      })
    }
  }

  // Cascade reset: on REJECTED, reset all downstream stages to NOT_STARTED
  if (status === 'REJECTED') {
    const stageIndex = STAGE_SEQUENCE.indexOf(stage)
    const downstreamStages = STAGE_SEQUENCE.slice(stageIndex + 1)

    if (downstreamStages.length > 0) {
      await prisma.stageGate.updateMany({
        where: {
          outputId: id,
          stage: { in: downstreamStages },
        },
        data: {
          status: 'NOT_STARTED',
          feedback: null,
          reviewedAt: null,
        },
      })
    }
  }

  // Return current state
  const stageGates = await prisma.stageGate.findMany({
    where: { outputId: id },
    select: { stage: true, status: true, feedback: true, executedAt: true, reviewedAt: true },
  })

  return { success: true, stageGates }
})
