/**
 * GET /api/outputs/:id/costs
 * 
 * Retorna o breakdown de custos de um output,
 * incluindo total, por recurso, por ação e log detalhado.
 */

import { costLogService } from '../../../services/cost-log.service'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')

  if (!outputId) {
    throw createError({ statusCode: 400, message: 'Output ID required' })
  }

  const costs = await costLogService.getOutputCost(outputId)

  return costs
})
