/**
 * POST /api/dossiers/[id]/generate-episode-brief-bundle
 *
 * Gera (ou reutiliza) o EscritorChefeBundleV1 persistido no Dossier.
 * O Escritor Chefe gera prosa narrativa densa por episódio (EP1/EP2/EP3),
 * substituindo o antigo EpisodeBriefBundleV1 (facts estruturados).
 *
 * Geração sequencial: EP1 → EP2 (com contexto EP1) → EP3 (com contexto EP1+EP2)
 * Isso garante controle de holdbacks by design.
 *
 * Body: { force?: boolean }
 */

import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import {
  getOrCreateEscritorChefeBundleV1ForDossier,
} from '../../../services/briefing/escritor-chefe.service'

const BodySchema = z.object({
  force: z.boolean().optional().default(false),
})

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
  const body = BodySchema.parse(rawBody || {})

  const exists = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { id: true },
  })
  if (!exists) {
    throw createError({ statusCode: 404, message: 'Dossier not found' })
  }

  const result = await getOrCreateEscritorChefeBundleV1ForDossier(dossierId, { force: body.force })

  return {
    success: true,
    dossierId,
    bundleHash: result.bundleHash,
    updatedAt: result.updatedAt.toISOString(),
    summary: result.summary,
    bundle: result.bundle,
  }
})
