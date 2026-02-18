/**
 * POST /api/dossiers/[id]/regenerate-monetization-item
 * 
 * Regenera um teaser ou um episódio (fullVideo) individual com ângulo diferente.
 * Atualiza o plano salvo no banco com o item substituído.
 */

import { prisma } from '../../../utils/prisma'
import { regenerateMonetizationItem } from '../../../services/monetization-planner.service'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({ statusCode: 400, message: 'Dossier ID is required' })
  }

  const body = await readBody(event)
  const { type, index, userSuggestion, episodeNumber, narrativeRole } = body as {
    type: 'teaser' | 'fullVideo'
    index?: number
    userSuggestion?: string
    episodeNumber?: 1 | 2 | 3
    narrativeRole?: string
  }

  if (!type || !['teaser', 'fullVideo'].includes(type)) {
    throw createError({ statusCode: 400, message: 'type deve ser "teaser" ou "fullVideo"' })
  }

  if (type === 'teaser' && (index == null || index < 0)) {
    throw createError({ statusCode: 400, message: 'index é obrigatório para teasers' })
  }

  if (type === 'fullVideo' && episodeNumber != null && ![1, 2, 3].includes(Number(episodeNumber))) {
    throw createError({ statusCode: 400, message: 'episodeNumber deve ser 1, 2 ou 3' })
  }

  // Buscar plano ativo
  const activePlan = await prisma.monetizationPlan.findFirst({
    where: { dossierId, isActive: true },
    orderBy: { createdAt: 'desc' }
  })

  if (!activePlan || !activePlan.planData) {
    throw createError({ statusCode: 404, message: 'Nenhum plano ativo encontrado para este dossiê' })
  }

  const planData = activePlan.planData as any

  if (type === 'teaser' && (index! >= (planData.teasers?.length ?? 0))) {
    throw createError({ statusCode: 400, message: 'Índice de teaser fora do range' })
  }

  const episodeIndex = (type === 'fullVideo' ? (Number(episodeNumber ?? 1) - 1) : 0)
  const selectedEpisode = Array.isArray(planData?.fullVideos) ? planData.fullVideos[episodeIndex] : null
  if (type === 'fullVideo' && !selectedEpisode) {
    throw createError({ statusCode: 400, message: `Plano inválido: fullVideos[${episodeIndex}] ausente` })
  }

  // Buscar dossiê para contexto
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      sources: { orderBy: { order: 'asc' } },
      notes: { orderBy: { order: 'asc' } }
    }
  })

  if (!dossier) {
    throw createError({ statusCode: 404, message: 'Dossier not found' })
  }

  try {
    const currentPlanForRegeneration = {
      ...planData,
      // Compatibilidade: service legado espera currentPlan.fullVideo
      fullVideo: (type === 'fullVideo' ? selectedEpisode : (planData?.fullVideos?.[0] ?? selectedEpisode))
    }

    const result = await regenerateMonetizationItem(
      {
        type,
        index,
        currentPlan: currentPlanForRegeneration,
        dossierContext: {
          theme: dossier.theme,
          title: dossier.title,
          sources: dossier.sources.map(s => ({
            title: s.title,
            content: s.content,
            sourceType: s.sourceType,
            weight: s.weight ?? 1.0
          })),
          notes: dossier.notes.map(n => ({
            content: n.content,
            noteType: n.noteType || 'insight'
          }))
        },
        teaserDuration: (activePlan.teaserDuration ?? 35) as 35 | 55 | 115,
        // Monetização travada: Full sempre no formato longo padrão.
        fullVideoDuration: 900 as 300 | 600 | 900,
        userSuggestion: userSuggestion?.trim() || undefined,
        narrativeRole: narrativeRole?.trim() || undefined,
        // Manter o targetEpisode atual do teaser ao regenerar
        targetEpisode: type === 'teaser' && index != null
          ? (planData.teasers?.[index]?.targetEpisode as 1 | 2 | 3 | undefined)
          : undefined
      }
    )

    // Atualizar plano no banco
    const updatedPlan = { ...planData }
    if (type === 'teaser') {
      updatedPlan.teasers = [...(updatedPlan.teasers || [])]
      const role = result.item?.narrativeRole
      const sceneCount = role === 'gateway' ? 5 : role === 'hook-only' ? 4 : 6
      updatedPlan.teasers[index!] = { ...result.item, sceneCount }
    } else {
      if (!Array.isArray(updatedPlan.fullVideos)) updatedPlan.fullVideos = []
      const n = (episodeIndex + 1) as 1 | 2 | 3
      updatedPlan.fullVideos[episodeIndex] = {
        ...result.item,
        episodeNumber: n,
        angleCategory: `episode-${n}`,
        sceneCount: 150
      }
      updatedPlan.needsReview = true
    }

    // Hard migration: garantir que "fullVideo" não volte a existir no JSON do plano
    if ('fullVideo' in updatedPlan) delete updatedPlan.fullVideo

    // Atualizar cronograma se a IA gerou um novo
    if (result.updatedSchedule && result.updatedSchedule.length > 0) {
      updatedPlan.publicationSchedule = result.updatedSchedule
    }

    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const cost = calculateLLMCost(result.model, inputTokens, outputTokens)

    const updateData: any = {
      planData: updatedPlan,
      inputTokens: activePlan.inputTokens + inputTokens,
      outputTokens: activePlan.outputTokens + outputTokens,
      cost: (activePlan.cost ?? 0) + cost
    }

    await prisma.monetizationPlan.update({
      where: { id: activePlan.id },
      data: updateData
    })

    // Registrar custo
    costLogService.log({
      dossierId,
      resource: 'insights',
      action: 'create',
      provider: result.provider,
      model: result.model,
      cost,
      metadata: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
      detail: `Regeneração de ${type}${type === 'teaser' ? ` #${index! + 1}` : ''}`
    }).catch(err => console.error('[RegenerateItem] CostLog:', err))

    return {
      success: true,
      type,
      index,
      item: result.item,
      updatedSchedule: result.updatedSchedule || null,
      cost,
      usage: result.usage,
      provider: result.provider
    }
  } catch (error: any) {
    console.error('[RegenerateItem] ❌ Erro:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao regenerar item'
    })
  }
})
