/**
 * POST /api/dossiers/[id]/generate-brief-bundle
 *
 * Gera (ou reutiliza) o BriefBundleV1 persistido no Dossier, para uso em TEASERS.
 *
 * Body: { force?: boolean }
 *
 * Observação: por padrão, a rota é aberta. Se `INTERNAL_API_KEY` estiver definido,
 * exige header `x-internal-api-key`:
 * - ausente → 401
 * - diferente → 403
 */

import { prisma } from '../../../utils/prisma'
import {
  getOrCreateBriefBundleV1ForDossier,
  GenerateBriefBodySchema
} from '../../../services/briefing/briefing.service'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({ statusCode: 400, message: 'Dossier ID is required' })
  }

  // Guard opcional (ativado via env) — útil para testes 401/403 sem impor auth no dev.
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

  // Validar body
  const rawBody = await readBody(event)
  const body = GenerateBriefBodySchema.parse(rawBody || {})

  // Business: dossiê precisa existir e ter fontes (regra tratada no service)
  const exists = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { id: true }
  })
  if (!exists) {
    throw createError({ statusCode: 404, message: 'Dossier not found' })
  }

  const result = await getOrCreateBriefBundleV1ForDossier(dossierId, { force: body.force })

  return {
    success: true,
    dossierId,
    bundleHash: result.bundleHash,
    updatedAt: result.updatedAt.toISOString(),
    bundle: result.bundle
  }
})

