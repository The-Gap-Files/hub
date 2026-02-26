/**
 * GET /api/dossiers/[id]/escritor-chefe-bundle
 *
 * Retorna o EscritorChefeBundleV1 existente do dossier (sem gerar).
 * Usado pela UI para exibir a prosa já gerada ao abrir a aba.
 */

import { prisma } from '../../../utils/prisma'
import { normalizeEscritorChefeBundleV1, formatEscritorChefeBundleV1AsSummary } from '../../../types/escritor-chefe.types'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({ statusCode: 400, message: 'Dossier ID is required' })
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: {
      id: true,
      escritorChefeBundleV1: true,
      escritorChefeBundleV1Hash: true,
      escritorChefeBundleV1UpdatedAt: true,
    },
  })

  if (!dossier) {
    throw createError({ statusCode: 404, message: 'Dossier not found' })
  }

  if (!dossier.escritorChefeBundleV1) {
    return {
      success: true,
      dossierId,
      bundle: null,
      summary: null,
      updatedAt: null,
    }
  }

  try {
    const bundle = normalizeEscritorChefeBundleV1(dossier.escritorChefeBundleV1)
    return {
      success: true,
      dossierId,
      bundle,
      summary: formatEscritorChefeBundleV1AsSummary(bundle),
      updatedAt: dossier.escritorChefeBundleV1UpdatedAt?.toISOString() || null,
    }
  } catch {
    // Bundle corrompido
    return {
      success: true,
      dossierId,
      bundle: null,
      summary: null,
      updatedAt: null,
    }
  }
})
