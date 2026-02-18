/**
 * POST /api/outputs/:id/generate-outline
 * 
 * Etapa isolada: gera (ou regenera) o plano narrativo via Story Architect (Sonnet).
 * O outline é salvo em Output.storyOutline e fica pendente de aprovação (storyOutlineApproved).
 * Só após aprovar o plano (approve-stage STORY_OUTLINE) o usuário pode gerar o roteiro (generate-script).
 * 
 * Body opcional: { feedback?: string } para regeneração com direção
 */

import { prisma } from '../../../utils/prisma'
import { generateStoryOutline } from '../../../services/story-architect.service'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'
import { getScriptStyleById } from '../../../constants/script-styles'
import { mapPersonsFromPrisma, mapNeuralInsightsFromNotes } from '../../../utils/format-intelligence-context'
import { TeaserMicroBriefV1Schema, formatTeaserMicroBriefV1ForPrompt } from '../../../types/briefing.types'
import { getOrCreateEpisodeBriefBundleV1ForDossier } from '../../../services/briefing/episode-briefing.service'
import { formatEpisodeBriefForPrompt } from '../../../types/episode-briefing.types'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })

  const body = await readBody(event).catch(() => ({}))
  const feedback = body?.feedback as string | undefined
  const monetizationContext = body?.monetizationContext as {
    itemType: 'teaser' | 'fullVideo'
    title: string
    hook: string
    angle: string
    angleCategory: string
    // Série de episódios (opcional; usado para enriquecer contexto do Story Architect)
    planId?: string
    episodeNumber?: 1 | 2 | 3
    narrativeRole?: string
    shortFormatType?: string
    scriptOutline?: string
    cta?: string
    strategicNotes?: string
    scriptStyleId?: string
    scriptStyleName?: string
    editorialObjectiveId?: string
    editorialObjectiveName?: string
    avoidPatterns?: string[]
    /** Fonte da verdade: quantidade alvo de cenas. Quando presente, prevalece sobre duração. */
    sceneCount?: number
  } | undefined

  // 1. Buscar Output com Dossier (antes de tudo — precisamos do monetizationContext salvo)
  const output = await prisma.output.findUnique({
    where: { id: outputId },
    include: {
      dossier: {
        include: {
          sources: true,
          notes: true,
          images: true,
          persons: { orderBy: { order: 'asc' } }
        }
      }
    }
  })

  if (!output || !output.dossier) {
    throw createError({ statusCode: 404, message: 'Output or Dossier not found' })
  }

  // Pré-requisito: voz + velocidade configuradas antes do Story Architect
  if (!output.voiceId || !output.speechConfiguredAt) {
    throw createError({
      statusCode: 400,
      message: 'Antes de gerar o plano narrativo, selecione o narrador (voz) e a velocidade da fala (WPM) no output.'
    })
  }

  const storedMonetizationContext = (output.monetizationContext as unknown as typeof monetizationContext) || undefined

  // Se o output já nasceu vinculado a um item do monetizador (ex: pacote YouTube),
  // NÃO permitir sobrescrever via body (evita duplicação/deriva do blueprint).
  const isBoundToStoredMonetization =
    !!storedMonetizationContext?.itemType &&
    (output.format === 'teaser-youtube-shorts' || output.format === 'full-youtube')

  const effectiveMonetizationContext = isBoundToStoredMonetization
    ? storedMonetizationContext
    : (monetizationContext || storedMonetizationContext || undefined)

  console.log(`[API] Generating story outline for Output ${outputId}${feedback ? ` with feedback: "${feedback}"` : ''}${effectiveMonetizationContext ? ` from monetization (${effectiveMonetizationContext.itemType}: ${effectiveMonetizationContext.angleCategory})` : ''}`)

  const dossier = output.dossier

  // 3. Montar request
  const userNotes: string[] = []
  if (feedback) userNotes.push(`⚠️ FEEDBACK DO USUÁRIO PARA O PLANO NARRATIVO: ${feedback}`)

  // Se este output é um EP2/EP3 vinculado a um MonetizationPlan, enriquecer o contexto com
  // os territórios já cobertos para reduzir repetição entre episódios (sem depender de validadores).
  const effectiveEpisodeNumber = (effectiveMonetizationContext as any)?.episodeNumber as 1 | 2 | 3 | undefined
  const effectivePlanId = (effectiveMonetizationContext as any)?.planId as string | undefined
  if (
    effectiveMonetizationContext?.itemType === 'fullVideo' &&
    effectivePlanId &&
    effectiveEpisodeNumber &&
    effectiveEpisodeNumber > 1
  ) {
    try {
      const plan = await prisma.monetizationPlan.findUnique({
        where: { id: effectivePlanId },
        select: { planData: true }
      })

      const planData = plan?.planData as any
      const episodes = Array.isArray(planData?.fullVideos) ? planData.fullVideos : []
      const previous = episodes.slice(0, effectiveEpisodeNumber - 1)

      if (previous.length > 0) {
        const previousEpisodesBlock = [
          `⛔ EPISÓDIOS ANTERIORES (NÃO REPETIR ASSUNTOS / HOOKS / KEY POINTS)`,
          ...previous.map((ep: any, idx: number) => {
            const n = idx + 1
            const title = ep?.title || '(sem título)'
            const hook = ep?.hook || '(sem hook)'
            const angle = ep?.angle || '(sem ângulo)'
            const keyPoints = Array.isArray(ep?.keyPoints) ? ep.keyPoints.filter(Boolean) : []
            const keyPointsLine = keyPoints.length > 0 ? ` keyPoints=[${keyPoints.join(' | ')}]` : ''
            return `${n}. title="${title}" | angle="${angle}" | hook="${hook}"${keyPointsLine}`
          })
        ].join('\n')

        userNotes.push(previousEpisodesBlock)
        userNotes.push(
          `✅ REGRA: Este outline (EP${effectiveEpisodeNumber}) deve explorar um TERRITÓRIO NOVO e complementar, mantendo coerência com o arco da série.`
        )
      }
    } catch {
      // Best-effort: não falhar geração de outline por não conseguir carregar o plano
    }
  }

  // Fonte da verdade: quantidade de cenas. Quando sceneCount existe, prevalece sobre targetDuration.
  const sceneCount = effectiveMonetizationContext?.sceneCount
  const targetDuration = sceneCount ? sceneCount * 5 : (output.duration || 300)
  const targetSceneCount = sceneCount ? sceneCount : undefined

  try {
    const isFullVideo = effectiveMonetizationContext?.itemType === 'fullVideo'
    const episodeNumber = (effectiveMonetizationContext as any)?.episodeNumber as 1 | 2 | 3 | undefined

    const microBriefParsed = effectiveMonetizationContext?.itemType === 'teaser'
      ? TeaserMicroBriefV1Schema.safeParse((effectiveMonetizationContext as any)?.microBriefV1)
      : { success: false as const }

    // Para fullVideo com episodeNumber definido: usa o EpisodeBriefBundle como fonte da verdade.
    // Isso substitui o dossier bruto, prevenindo alucinação e choque de assuntos entre episódios.
    let episodeBriefSource: { title: string; content: string; type: string; weight: number } | null = null
    if (isFullVideo && episodeNumber) {
      try {
        const episodeBriefResult = await getOrCreateEpisodeBriefBundleV1ForDossier(dossier.id)
        const briefContent = formatEpisodeBriefForPrompt(episodeBriefResult.bundle, episodeNumber)
        episodeBriefSource = {
          title: `Brief EP${episodeNumber} (fonte da verdade — episodeBriefBundleV1)`,
          content: briefContent,
          type: 'brief',
          weight: 2.0,
        }
        console.log(`[API] ✅ Usando EpisodeBriefBundle EP${episodeNumber} para output ${outputId}`)
      } catch (err) {
        // Best-effort: se o brief falhar, cai no fallback do dossier bruto com aviso
        console.warn(`[API] ⚠️ EpisodeBriefBundle indisponível para EP${episodeNumber} — usando dossier bruto. Erro: ${err}`)
      }
    }

    const sources = episodeBriefSource
      ? [episodeBriefSource]
      : microBriefParsed.success
        ? [{
          title: 'Micro-brief do teaser (fonte da verdade)',
          content: formatTeaserMicroBriefV1ForPrompt(microBriefParsed.data),
          type: 'brief',
          weight: 2.0
        }]
        : (dossier.sources?.map((s: any) => ({
          title: s.title,
          content: s.content,
          type: s.sourceType,
          weight: s.weight ?? 1.0
        })) || [])

    // Quando o episode brief está ativo, limpa o contexto bruto para evitar contaminação
    const useEpisodeBrief = !!episodeBriefSource
    const result = await generateStoryOutline({
      theme: dossier.theme,
      visualIdentityContext: dossier.visualIdentityContext || undefined,
      sources,
      userNotes,
      persons: (useEpisodeBrief || microBriefParsed.success) ? [] : mapPersonsFromPrisma(dossier.persons),
      neuralInsights: (useEpisodeBrief || microBriefParsed.success) ? [] : mapNeuralInsightsFromNotes(dossier.notes),
      imageDescriptions: (useEpisodeBrief || microBriefParsed.success) ? [] : (dossier.images?.map((i: any) => i.description).filter(Boolean) || []),
      researchData: (useEpisodeBrief || microBriefParsed.success) ? undefined : (dossier.researchData || undefined),
      editorialObjective: output.objective || undefined,
      scriptStyleId: output.scriptStyleId || undefined,
      dossierCategory: output.classificationId || undefined,
      targetDuration,
      targetSceneCount,
      language: output.language || 'pt-BR',
      mustInclude: output.mustInclude || undefined,
      mustExclude: output.mustExclude || undefined,
      monetizationContext: effectiveMonetizationContext
    })

    // 4. Salvar outline + monetizationContext no banco
    // Injetar _monetizationMeta no outline para que o pipeline downstream
    // (script generator, script validator) encontre narrativeRole, avoidPatterns, etc.
    const outlineToSave = effectiveMonetizationContext
      ? {
        ...result.outline,
        _monetizationMeta: {
          itemType: effectiveMonetizationContext.itemType,
          narrativeRole: effectiveMonetizationContext.narrativeRole,
          shortFormatType: effectiveMonetizationContext.shortFormatType,
          angleCategory: effectiveMonetizationContext.angleCategory,
          angle: effectiveMonetizationContext.angle,
          strategicNotes: effectiveMonetizationContext.strategicNotes,
          scriptStyleId: effectiveMonetizationContext.scriptStyleId,
          scriptStyleName: effectiveMonetizationContext.scriptStyleName,
          editorialObjectiveId: effectiveMonetizationContext.editorialObjectiveId,
          editorialObjectiveName: effectiveMonetizationContext.editorialObjectiveName,
          avoidPatterns: effectiveMonetizationContext.avoidPatterns,
          episodeNumber: effectiveMonetizationContext.episodeNumber,
          planId: effectiveMonetizationContext.planId
        }
      }
      : result.outline

    const updateData: any = {
      storyOutline: outlineToSave as any,
      storyOutlineApproved: false
    }
    // Persistir monetizationContext no campo dedicado (primeira vez ou atualização)
    if (effectiveMonetizationContext) {
      updateData.monetizationContext = effectiveMonetizationContext as any
    }
    await prisma.output.update({
      where: { id: outputId },
      data: updateData
    })

    // 5. Registrar custo do plano (fire-and-forget) — resource 'outline', não 'script'
    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const cost = calculateLLMCost(result.model, inputTokens, outputTokens)

    costLogService.log({
      outputId,
      resource: 'outline',
      action: feedback ? 'recreate' : 'create',
      provider: result.provider,
      model: result.model,
      cost,
      metadata: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
      detail: `Story Architect - ${result.outline.risingBeats.length} beats narrativos`
    }).catch(() => { })

    return {
      success: true,
      outline: result.outline,
      usage: result.usage,
      model: result.model
    }
  } catch (error: any) {
    console.error('[API] Story Architect failed:', error)
    throw createError({ statusCode: 500, message: error.message || 'Failed to generate story outline' })
  }
})
