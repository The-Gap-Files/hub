/**
 * POST /api/dossiers/[id]/generate-episode-brief-bundle
 *
 * Gera (ou reutiliza) o EpisodeBriefBundleV1 persistido no Dossier, para uso em EPISÓDIOS COMPLETOS (EP1/EP2/EP3).
 *
 * O bundle distribui os fatos do dossiê entre os 3 episódios, definindo:
 * - O que cada EP pode revelar (exclusiveFacts)
 * - O que cada EP deve guardar para os próximos (holdbackFacts)
 * - Os ganchos abertos entre episódios (suggestedOpenLoops)
 * - As resoluções proibidas por episódio (forbiddenResolutions)
 *
 * Body: { force?: boolean }
 */

import { prisma } from '../../../utils/prisma'
import {
  getOrCreateEpisodeBriefBundleV1ForDossier,
} from '../../../services/briefing/episode-briefing.service'
import { GenerateEpisodeBriefBodySchema } from '../../../types/episode-briefing.types'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({ statusCode: 400, message: 'Dossier ID is required' })
  }

  // Guard opcional (ativado via env) — mesma lógica do brief de teasers
  const internalKey = (process.env.INTERNAL_API_KEY || '').trim()
  if (internalKey) {
    const headerKey = String(getHeader(event, 'x-internal-api-key') || '').trim()
    if (!headerKey) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
    if (headerKey !== internalKey) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
  }

  const rawBody = await readBody(event)
  const body = GenerateEpisodeBriefBodySchema.parse(rawBody || {})

  const exists = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { id: true },
  })
  if (!exists) {
    throw createError({ statusCode: 404, message: 'Dossier not found' })
  }

  const result = await getOrCreateEpisodeBriefBundleV1ForDossier(dossierId, { force: body.force })

  return {
    success: true,
    dossierId,
    bundleHash: result.bundleHash,
    updatedAt: result.updatedAt.toISOString(),
    summary: result.summary,
    bundle: result.bundle,
  }
})
