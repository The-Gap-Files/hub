/**
 * POST /api/dossiers/[id]/suggest-monetization
 * 
 * Analisa o dossiê via IA e gera um plano de monetização Document-First:
 * 3 Full Videos (EP1–EP3, YouTube) + N Teasers (TikTok/Shorts/Reels)
 * 
 * V2: Pipeline por etapas (Blueprint → Full Video → Gateway → Deep-Dives → Hook-Only → Schedule)
 * Cada etapa é focada, com validação programática no blueprint.
 * 
 * O plano é retornado para aprovação manual — NÃO cria outputs automaticamente.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { generateMonetizationPlanV2 } from '../../../services/monetization-planner-v2.service'
import { validateMonetizationPlan } from '../../../services/monetization-validator.service'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'
import { validatorsEnabled } from '../../../utils/validators'
import { getOrCreateBriefBundleV1ForDossier } from '../../../services/briefing/briefing.service'

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
  const confirmRegeneration = !!rawBody?.confirmRegeneration
  const forceBriefRegeneration = !!rawBody?.forceBriefRegeneration
  // 🔒 Monetização agora é orientada por CENAS (não por seleção de tempo na UI).
  // Mantemos duração técnica fixa para compatibilidade do pipeline atual.
  const teaserDuration = 35
  const fullVideoDuration = 900
  const teaserCount = rawBody?.teaserCount ? Number(rawBody.teaserCount) : 12
  const sceneConfig = {
    hookOnly: 4,
    deepDive: 6,
    gateway: 5,
    fullVideo: 150
  } as const

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
    // Se já houver outputs criados a partir do plano ativo, exigir confirmação explícita
    // para desvincular/cancelar conforme regra de negócio.
    const activePlans = await prisma.monetizationPlan.findMany({
      where: { dossierId, isActive: true },
      select: { id: true, planData: true }
    })

    const candidateOutputIds = new Set<string>()
    for (const plan of activePlans) {
      const pkg = (plan.planData as any)?._youtubePackage
      if (pkg?.fullOutputId) candidateOutputIds.add(String(pkg.fullOutputId))
      if (Array.isArray(pkg?.teaserOutputIds)) {
        for (const id of pkg.teaserOutputIds) {
          if (id) candidateOutputIds.add(String(id))
        }
      }
    }

    const outputWhereOr: any[] = []
    if (candidateOutputIds.size > 0) {
      outputWhereOr.push({ id: { in: Array.from(candidateOutputIds) } })
    }
    for (const plan of activePlans) {
      outputWhereOr.push({
        monetizationContext: {
          path: ['planId'],
          equals: plan.id
        }
      })
    }

    const linkedOutputs = outputWhereOr.length > 0
      ? await prisma.output.findMany({
        where: {
          dossierId,
          OR: outputWhereOr
        },
        select: {
          id: true,
          status: true
        }
      })
      : []

    const completedStatuses = new Set(['COMPLETED', 'RENDERED'])
    const completedCount = linkedOutputs.filter(o => completedStatuses.has(o.status)).length
    const pendingCount = linkedOutputs.filter(o => o.status === 'PENDING' || o.status === 'GENERATING').length

    if (linkedOutputs.length > 0 && !confirmRegeneration) {
      throw createError({
        statusCode: 409,
        statusMessage: 'CONFIRM_REGENERATION_REQUIRED',
        message: `Esta regeneração vai desvincular ${linkedOutputs.length} output(s) do monetizador. ${pendingCount} pendente(s) será(ão) cancelado(s) e ${completedCount} concluído(s) ficará(ão) concluído(s), porém sem relação com o plano de monetização.`
      })
    }

    if (linkedOutputs.length > 0 && confirmRegeneration) {
      const linkedIds = linkedOutputs.map(o => o.id)
      await prisma.$transaction([
        prisma.output.updateMany({
          where: {
            id: { in: linkedIds },
            status: { in: ['PENDING', 'GENERATING'] }
          },
          data: {
            status: 'CANCELLED',
            errorMessage: 'Cancelado automaticamente após regeneração da monetização.'
          }
        }),
        prisma.output.updateMany({
          where: {
            id: { in: linkedIds }
          },
          data: {
            monetizationContext: Prisma.DbNull
          }
        }),
        prisma.outputRelation.deleteMany({
          where: {
            OR: [
              { mainOutputId: { in: linkedIds } },
              { relatedOutputId: { in: linkedIds } }
            ]
          }
        })
      ])
    }

    console.log(`[SuggestMonetization] 🚀 Iniciando pipeline V2 para dossiê ${dossierId}`)

    // Brief persistido (contexto reduzido) para TEASERS — Full Video permanece com dossiê completo.
    // TEMPORÁRIO: forceBriefRegeneration=true ao regenerar monetização (brief refeito e sobrescrito).
    const brief = await getOrCreateBriefBundleV1ForDossier(dossierId, { force: forceBriefRegeneration })

    const result = await generateMonetizationPlanV2({
      theme: dossier.theme,
      title: dossier.title,
      visualIdentityContext: dossier.visualIdentityContext || undefined,
      briefBundleV1: brief.bundle,
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
      sceneConfig,
      creativeDirection: rawBody?.creativeDirection
    })

    // Validação LLM do plano completo (diversidade, coerência, funil)
    // TEMPORÁRIO: validadores e loops de repair desativados globalmente.
    const primaryEpisode = result.plan.fullVideos?.[0]
    if (!primaryEpisode) {
      throw new Error('Plano inválido: fullVideos[0] ausente')
    }

    const validationResult = validatorsEnabled()
      ? await validateMonetizationPlan({
        // Validador atual é 1× Full Video. Usamos EP1 como referência do funil.
        fullVideo: {
          title: primaryEpisode.title,
          hook: primaryEpisode.hook,
          angle: primaryEpisode.angle,
          scriptStyleId: primaryEpisode.scriptStyleId,
          keyPoints: primaryEpisode.keyPoints,
          emotionalArc: primaryEpisode.emotionalArc
        },
        teasers: result.plan.teasers.map((t: any) => ({
          title: t.title,
          hook: t.hook,
          angle: t.angle,
          angleCategory: t.angleCategory,
          narrativeRole: t.narrativeRole,
          shortFormatType: t.shortFormatType,
          scriptOutline: t.scriptOutline,
          avoidPatterns: t.avoidPatterns
        }))
      })
      : { approved: true }

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
      validation: validationResult,
      usage: result.usage,
      cost,
      provider: result.provider,
      model: result.model,
      config: {
        teaserDuration,
        fullVideoDuration,
        teaserCount,
        sceneConfig
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

