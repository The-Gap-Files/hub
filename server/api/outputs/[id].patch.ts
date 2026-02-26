import { prisma } from '../../utils/prisma'
import { outputPipelineService } from '../../services/pipeline/output-pipeline.service'
import type { PipelineStage, StageStatus } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Output ID is required' })
  }

  // Verificar existência
  const existing = await prisma.output.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Output not found' })
  }

  console.log(`[API] Updating Output ${id}:`, body)

  // Map legacy status values
  const statusMap: Record<string, string> = {
    'PROCESSING': 'IN_PROGRESS',
    'PENDING_REVIEW': 'IN_PROGRESS',
    'GENERATING': 'IN_PROGRESS',
    'PENDING': 'DRAFT',
  }

  const data: any = {}
  if (body.status) {
    data.status = statusMap[body.status] || body.status
    if (data.status === 'IN_PROGRESS' || data.status === 'DRAFT') {
      data.errorMessage = null
    }
  }

  // Handle stage approvals via StageGate if provided
  const stageApprovals: { stage: PipelineStage; approved: boolean }[] = []
  if (body.scriptApproved !== undefined) stageApprovals.push({ stage: 'SCRIPT', approved: body.scriptApproved })
  if (body.imagesApproved !== undefined) stageApprovals.push({ stage: 'IMAGES', approved: body.imagesApproved })
  if (body.videosApproved !== undefined) stageApprovals.push({ stage: 'MOTION', approved: body.videosApproved })

  for (const { stage, approved } of stageApprovals) {
    const status: StageStatus = approved ? 'APPROVED' : 'REJECTED'
    await prisma.stageGate.upsert({
      where: { outputId_stage: { outputId: id, stage } },
      create: { outputId: id, stage, status, reviewedAt: new Date() },
      update: { status, reviewedAt: new Date() },
    })
  }

  const updated = Object.keys(data).length > 0
    ? await prisma.output.update({ where: { id }, data })
    : await prisma.output.findUnique({ where: { id } })

  // Se aprovou algo ou reiniciou, disparar pipeline
  const hasApproval = stageApprovals.some(s => s.approved)
  if (hasApproval || body.status === 'IN_PROGRESS') {
    console.log(`[API] Triggering pipeline for Output ${id} after update`)
    // Fire-and-forget
    outputPipelineService.execute(id).catch((err) => {
      console.error(`[API] Async pipeline trigger failed for ${id}:`, err)
    })
  }

  return updated
})
