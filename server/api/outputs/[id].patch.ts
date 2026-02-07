import { prisma } from '../../utils/prisma'
import { outputPipelineService } from '../../services/pipeline/output-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Output ID is required' })
  }

  // Verificar existência
  const existing = await prisma.output.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Output not found' })
  }

  console.log(`[API] Updating Output ${id}:`, body)

  // Update
  const updated = await prisma.output.update({
    where: { id },
    data: {
      scriptApproved: body.scriptApproved,
      imagesApproved: body.imagesApproved,
      videosApproved: body.videosApproved,
      status: body.status === 'PROCESSING' || body.status === 'PENDING_REVIEW' ? 'GENERATING' : body.status, // Mapear status de UI para DB
      errorMessage: body.status === 'PROCESSING' || body.status === 'GENERATING' || body.status === 'PENDING_REVIEW' ? null : undefined
    }
  })

  // Se aprovou algo ou reiniciou, disparar pipeline
  if (body.scriptApproved || body.imagesApproved || body.videosApproved || body.status === 'PROCESSING') {
    console.log(`[API] Triggering pipeline for Output ${id} after update`)
    // Fire-and-forget
    outputPipelineService.execute(id).catch((err) => {
      console.error(`[API] Async pipeline trigger failed for ${id}:`, err)
    })
  }

  return updated
})
