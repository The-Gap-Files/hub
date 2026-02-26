/**
 * POST /api/dossiers/[id]/generate-escritor-chefe-episode
 *
 * Gera (ou regenera) a prosa narrativa de UM episódio individual.
 * EP2 requer EP1 existente, EP3 requer EP1+EP2.
 *
 * Body: { episodeNumber: 1|2|3, force?: boolean }
 */

import { z } from 'zod'
import { generateSingleEpisodeProse } from '../../../services/briefing/escritor-chefe.service'

const BodySchema = z.object({
  episodeNumber: z.number().int().min(1).max(3),
  force: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({ statusCode: 400, message: 'Dossier ID is required' })
  }

  const rawBody = await readBody(event)
  const body = BodySchema.parse(rawBody || {})
  const episodeNumber = body.episodeNumber as 1 | 2 | 3

  try {
    const result = await generateSingleEpisodeProse(dossierId, episodeNumber, { force: body.force })

    return {
      success: true,
      dossierId,
      episodeNumber: result.episodeNumber,
      prose: result.prose,
      wordCount: result.wordCount,
      coveredTopics: result.coveredTopics,
      usage: result.usage,
      bundle: result.bundle,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('[GenerateEscritorChefeEpisode] Error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao gerar episódio',
    })
  }
})
