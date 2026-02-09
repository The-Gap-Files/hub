/**
 * GET /api/dossiers/[id]/monetization-plans
 * 
 * Retorna os planos de monetização salvos para um dossiê.
 * Por padrão retorna apenas o plano ativo (mais recente).
 * Use ?all=true para retornar todos (incluindo inativos).
 */

import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  const query = getQuery(event)
  const showAll = query.all === 'true'

  const plans = await prisma.monetizationPlan.findMany({
    where: {
      dossierId,
      ...(showAll ? {} : { isActive: true })
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      planData: true,
      teaserDuration: true,
      fullVideoDuration: true,
      teaserCount: true,
      provider: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      cost: true,
      isActive: true,
      createdAt: true
    }
  })

  return {
    success: true,
    data: plans,
    count: plans.length
  }
})
