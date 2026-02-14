/**
 * POST /api/dossiers/[id]/suggest-monetization
 * 
 * Analisa o dossiê via IA e gera um plano de monetização Document-First:
 * 1 Full Video (YouTube) + N Teasers (TikTok/Shorts/Reels)
 * 
 * V2: Pipeline por etapas (Blueprint → Full Video → Gateway → Deep-Dives → Hook-Only → Schedule)
 * Cada etapa é focada, com validação programática no blueprint.
 * 
 * O plano é retornado para aprovação manual — NÃO cria outputs automaticamente.
 */

import { prisma } from '../../../utils/prisma'
import { generateMonetizationPlanV2 } from '../../../services/monetization-planner-v2.service'
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

  // Validar body
  const rawBody = await readBody(event)
  const teaserDuration = Number(rawBody?.teaserDuration)
  const fullVideoDuration = Number(rawBody?.fullVideoDuration)
  const teaserCount = rawBody?.teaserCount ? Number(rawBody.teaserCount) : 6

  if (![35, 55, 115].includes(teaserDuration)) {
    throw createError({
      statusCode: 400,
      message: 'teaserDuration deve ser 35, 55 ou 115 (segundos)'
    })
  }

  if (![300, 600, 900].includes(fullVideoDuration)) {
    throw createError({
      statusCode: 400,
      message: 'fullVideoDuration deve ser 300, 600 ou 900 (segundos = 5, 10 ou 15 minutos)'
    })
  }

  if (teaserCount < 4 || teaserCount > 15) {
    throw createError({
      statusCode: 400,
      message: 'teaserCount deve ser entre 4 e 15'
    })
  }

  // Buscar dossiê com relações
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      sources: { orderBy: { order: 'asc' } },
      images: { orderBy: { order: 'asc' } },
      notes: { orderBy: { order: 'asc' } },
      persons: { orderBy: { order: 'asc' } }
    }
  })

  if (!dossier) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  try {
    console.log(`[SuggestMonetization] 🚀 Iniciando pipeline V2 para dossiê ${dossierId}`)

    const result = await generateMonetizationPlanV2({
      theme: dossier.theme,
      title: dossier.title,
      visualIdentityContext: dossier.visualIdentityContext || undefined,
      sources: dossier.sources.map(s => ({
        title: s.title,
        content: s.content,
        sourceType: s.sourceType,
        weight: s.weight ?? 1.0
      })),
      notes: dossier.notes.map(n => ({
        content: n.content,
        noteType: n.noteType || 'insight'
      })),
      images: dossier.images.map(i => ({
        description: i.description
      })),
      persons: dossier.persons?.map(p => ({
        name: p.name,
        role: p.role || '',
        description: p.description || '',
        visualDescription: p.visualDescription || undefined,
        relevance: p.relevance || undefined
      })) || [],
      researchData: dossier.researchData || undefined,
      teaserDuration: teaserDuration as 35 | 55 | 115,
      fullVideoDuration: fullVideoDuration as 300 | 600 | 900,
      teaserCount,
      creativeDirection: rawBody?.creativeDirection
    })

    // Calcular custo real
    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const cost = calculateLLMCost(result.model, inputTokens, outputTokens)

    console.log(`[SuggestMonetization] 💵 Custo total: $${cost.toFixed(6)}`)

    // Desativar planos anteriores deste dossiê
    await prisma.monetizationPlan.updateMany({
      where: { dossierId, isActive: true },
      data: { isActive: false }
    })

    // Persistir plano no banco
    const savedPlan = await prisma.monetizationPlan.create({
      data: {
        dossierId,
        planData: result.plan as any,
        teaserDuration,
        fullVideoDuration,
        teaserCount: result.plan.teasers?.length ?? 0,
        provider: result.provider,
        model: result.model,
        inputTokens,
        outputTokens,
        cost,
        isActive: true
      }
    })

    console.log(`[SuggestMonetization] 💾 Plano salvo: ${savedPlan.id}`)

    // Registrar custo (fire-and-forget)
    costLogService.log({
      dossierId,
      resource: 'insights',
      action: 'create',
      provider: result.provider,
      model: result.model,
      cost,
      metadata: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        stage_timings: result.stageTimings
      },
      detail: 'Plano de monetização V2 (pipeline por etapas)'
    }).catch(err => console.error('[SuggestMonetization] CostLog:', err))

    return {
      success: true,
      planId: savedPlan.id,
      plan: result.plan,
      usage: result.usage,
      cost,
      provider: result.provider,
      model: result.model,
      config: {
        teaserDuration,
        fullVideoDuration,
        teaserCount
      },
      stageTimings: result.stageTimings,
      createdAt: savedPlan.createdAt
    }
  } catch (error: any) {
    console.error('[SuggestMonetization] ❌ Erro:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao gerar plano de monetização'
    })
  }
})

