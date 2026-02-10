/**
 * POST /api/dossiers/[id]/intelligence-query
 * 
 * Processa uma consulta de inteligência contra o dossiê (docs) ou via web (conhecimento geral).
 */

import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { intelligenceQuery } from '../../../services/intelligence-query.service'

const QuerySchema = z.object({
  query: z.string().min(3, 'A consulta deve ter pelo menos 3 caracteres'),
  source: z.enum(['docs', 'web', 'both'])
})

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  const body = await readBody(event)
  const { query, source } = QuerySchema.parse(body)

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      sources: { orderBy: { order: 'asc' } },
      notes: { orderBy: { order: 'asc' } }
    }
  })

  if (!dossier) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  const config = useRuntimeConfig()
  const scriptConfig = config.providers?.script

  if (!scriptConfig?.apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Script AI provider not configured. Check your .env file.'
    })
  }

  try {
    const result = await intelligenceQuery(
      {
        query,
        source,
        theme: dossier.theme,
        sources: dossier.sources.map(s => ({
          title: s.title,
          content: s.content,
          sourceType: s.sourceType
        })),
        existingNotes: dossier.notes.map(n => ({
          content: n.content,
          noteType: n.noteType || 'research'
        }))
      },
      {
        name: scriptConfig.name,
        apiKey: scriptConfig.apiKey,
        model: scriptConfig.model
      }
    )

    return {
      content: result.content,
      noteType: result.noteType,
      usage: result.usage,
      provider: result.provider,
      model: result.model
    }
  } catch (error: any) {
    console.error('[IntelligenceQuery] ❌ Erro:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao processar consulta de inteligência'
    })
  }
})
