/**
 * GET /api/dossiers/:id/costs
 * 
 * Retorna o custo total de um dossier,
 * com breakdown por output (incluindo abortados/cancelados).
 */

import { costLogService } from '../../../services/cost-log.service'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({ statusCode: 400, message: 'Dossier ID required' })
  }

  const costs = await costLogService.getDossierCost(dossierId)

  return costs
})
