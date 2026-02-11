/**
 * POST /api/dossiers/[id]/suggest-creative-direction
 * 
 * Analisa o dossiê via IA e recomenda a direção criativa ideal:
 * - Estilo de Roteiro (scriptStyle)
 * - Estilo Visual (visualStyle) 
 * - Objetivo Editorial (editorialObjective)
 * 
 * Se nenhuma constant existente servir, sugere novas para criação manual.
 * O resultado é retornado para o frontend — não modifica dados automaticamente.
 */

import { prisma } from '../../../utils/prisma'
import { generateCreativeDirection } from '../../../services/creative-direction-advisor.service'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Buscar dossiê com relações
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

  const result = await generateCreativeDirection(
    {
      theme: dossier.theme,
      title: dossier.title,
      sources: dossier.sources.map(s => ({
        title: s.title,
        content: s.content,
        sourceType: s.sourceType
      })),
      notes: dossier.notes.map(n => ({
        content: n.content,
        noteType: n.noteType || 'insight'
      }))
    }
  )

  console.log(`[SuggestCreativeDirection] ✅ Direção criativa gerada para dossiê ${dossierId}`)

  // Calcular custo real
  const inputTokens = result.usage?.inputTokens ?? 0
  const outputTokens = result.usage?.outputTokens ?? 0
  const cost = calculateLLMCost(result.model, inputTokens, outputTokens)

  console.log(`[SuggestCreativeDirection] 💵 Custo: $${cost.toFixed(6)}`)

  // Registrar custo (fire-and-forget)
  costLogService.log({
    dossierId,
    resource: 'insights',
    action: 'create',
    provider: result.provider,
    model: result.model,
    cost,
    metadata: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
    detail: 'Creative Direction Advisor — Análise de direção criativa'
  }).catch(err => console.error('[SuggestCreativeDirection] CostLog:', err))

  return {
    success: true,
    direction: result.direction,
    usage: result.usage,
    cost,
    provider: result.provider,
    model: result.model
  }
})
