import { outputPipelineService } from '~/server/services/pipeline/output-pipeline.service'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')

  if (!outputId) {
    throw createError({
      statusCode: 400,
      message: 'Output ID is required'
    })
  }

  // Verificar se output existe
  const output = await prisma.output.findUnique({
    where: { id: outputId }
  })

  if (!output) {
    throw createError({
      statusCode: 404,
      message: 'Output not found'
    })
  }

  // Disparar pipeline em background (não bloqueia request)
  outputPipelineService.execute(outputId).catch((error) => {
    console.error(`[OutputPipeline] Error processing ${outputId}:`, error)
  })

  return {
    success: true,
    message: 'Pipeline iniciado',
    outputId
  }
})
