/**
 * outline-generation.service.ts
 *
 * Shared logic for generating (or regenerating) a Story Architect outline.
 * Extracted from generate-outline.post.ts to allow reuse in:
 * - generate-outline.post.ts (original endpoint)
 * - refine-outline.post.ts (QA-driven refinement)
 * - regenerate-script.post.ts (inline outline refinement before script regen)
 */

import { prisma } from '../utils/prisma'
import { generateStoryOutline, type StoryOutline } from './story-architect.service'
import { costLogService } from './cost-log.service'
import { calculateLLMCost } from '../constants/pricing'
import { mapPersonsFromPrisma, mapNeuralInsightsFromNotes } from '../utils/format-intelligence-context'
import { TeaserMicroBriefV1Schema, formatTeaserMicroBriefV1ForPrompt } from '../types/briefing.types'
import { getOrCreateEpisodeBriefBundleV1ForDossier } from './briefing/episode-briefing.service'
import { formatEpisodeBriefForPrompt } from '../types/episode-briefing.types'
import { normalizeEscritorChefeBundleV1, formatEpisodeProseForPrompt } from '../types/escritor-chefe.types'

// ─── Types ────────────────────────────────────────────────────────────

export interface MonetizationContextInput {
  itemType: 'teaser' | 'fullVideo'
  title: string
  hook: string
  angle: string
  angleCategory: string
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
  sceneCount?: number
  microBriefV1?: any
}

export interface ExecuteOutlineGenerationOpts {
  outputId: string
  feedback?: string
  /** When omitted, uses stored MonetizationProduct.contextData */
  monetizationContext?: MonetizationContextInput
}

export interface ExecuteOutlineGenerationResult {
  outline: StoryOutline
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// ─── Main function ────────────────────────────────────────────────────

export async function executeOutlineGeneration(
  opts: ExecuteOutlineGenerationOpts
): Promise<ExecuteOutlineGenerationResult> {
  const { outputId, feedback, monetizationContext: bodyMonetizationContext } = opts

  // 1. Load output + dossier
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

  // 2. Voice/WPM guard
  if (!output.voiceId || !output.speechConfiguredAt) {
    throw createError({
      statusCode: 400,
      message: 'Antes de gerar o plano narrativo, selecione o narrador (voz) e a velocidade da fala (WPM) no output.'
    })
  }

  const dossier = output.dossier

  // 3. Resolve monetization context (body vs stored in MonetizationProduct, bound check)
  const monetizationProduct = await prisma.monetizationProduct.findUnique({
    where: { outputId },
    select: { contextData: true }
  })
  const storedMonetizationContext = (monetizationProduct?.contextData as unknown as MonetizationContextInput) || undefined

  const isBoundToStoredMonetization =
    !!storedMonetizationContext?.itemType &&
    (output.format === 'teaser-youtube-shorts' || output.format === 'full-youtube')

  const effectiveMonetizationContext = isBoundToStoredMonetization
    ? storedMonetizationContext
    : (bodyMonetizationContext || storedMonetizationContext || undefined)

  console.log(`[OutlineGeneration] Generating outline for Output ${outputId}${feedback ? ` with feedback` : ''}${effectiveMonetizationContext ? ` from monetization (${effectiveMonetizationContext.itemType}: ${effectiveMonetizationContext.angleCategory})` : ''}`)

  // 4. Build userNotes (feedback + episode context)
  const userNotes: string[] = []
  if (feedback) userNotes.push(`⚠️ FEEDBACK DO USUÁRIO PARA O PLANO NARRATIVO: ${feedback}`)

  // EP2/EP3 enrichment: add previous episodes context
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
      // Best-effort: don't fail outline generation if plan loading fails
    }
  }

  // 5. Resolve scene count / target duration
  const sceneCount = effectiveMonetizationContext?.sceneCount
  const targetDuration = sceneCount ? sceneCount * 5 : (output.duration || 300)
  const targetSceneCount = sceneCount ? sceneCount : undefined

  // 6. Load briefs (episode brief or teaser micro-brief)
  const isFullVideo = effectiveMonetizationContext?.itemType === 'fullVideo'
  const episodeNumber = (effectiveMonetizationContext as any)?.episodeNumber as 1 | 2 | 3 | undefined

  const microBriefParsed = effectiveMonetizationContext?.itemType === 'teaser'
    ? TeaserMicroBriefV1Schema.safeParse((effectiveMonetizationContext as any)?.microBriefV1)
    : { success: false as const }

  let episodeBriefSource: { title: string; content: string; type: string; weight: number } | null = null
  if (isFullVideo && episodeNumber) {
    // Prioridade: Escritor Chefe (prosa) > Episode Brief (facts estruturados)
    try {
      const dossierData = await prisma.dossier.findUnique({
        where: { id: dossier.id },
        select: { escritorChefeBundleV1: true, episodeBriefBundleV1: true },
      })

      if (dossierData?.escritorChefeBundleV1) {
        // Escritor Chefe disponível — usar prosa como fonte da verdade
        const escritorBundle = normalizeEscritorChefeBundleV1(dossierData.escritorChefeBundleV1)
        const proseContent = formatEpisodeProseForPrompt(escritorBundle, episodeNumber)
        episodeBriefSource = {
          title: `Prosa EP${episodeNumber} — Escritor Chefe (fonte da verdade)`,
          content: proseContent,
          type: 'brief',
          weight: 2.0,
        }
        console.log(`[OutlineGeneration] ✅ Using EscritorChefe prose EP${episodeNumber} for output ${outputId}`)
      } else {
        // Fallback: Episode Brief (facts estruturados)
        const episodeBriefResult = await getOrCreateEpisodeBriefBundleV1ForDossier(dossier.id)
        const briefContent = formatEpisodeBriefForPrompt(episodeBriefResult.bundle, episodeNumber)
        episodeBriefSource = {
          title: `Brief EP${episodeNumber} (fonte da verdade — episodeBriefBundleV1)`,
          content: briefContent,
          type: 'brief',
          weight: 2.0,
        }
        console.log(`[OutlineGeneration] ✅ Using EpisodeBriefBundle EP${episodeNumber} (fallback) for output ${outputId}`)
      }
    } catch (err) {
      console.error(`[OutlineGeneration] ❌ Brief/Prose loading failed for EP${episodeNumber}. Error: ${err}`)
      throw createError({
        statusCode: 500,
        message: `Falha ao carregar Brief/Prosa para EP${episodeNumber}. Gere o Escritor Chefe ou Episode Brief antes de gerar o outline.`
      })
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

  // 7. Guard: Architect NEVER receives raw dossier
  const useBrief = !!episodeBriefSource || microBriefParsed.success
  if (!useBrief) {
    throw createError({
      statusCode: 400,
      message:
        'O Story Architect requer um brief curado para gerar o plano narrativo. ' +
        'Para full videos: vincule este output a um episódio (EP1/EP2/EP3) via Plano de Monetização. ' +
        'Para teasers: gere o Plano de Monetização com micro-briefs antes de gerar o outline. ' +
        'O dossiê bruto não é mais aceito como fonte do Arquiteto.'
    })
  }

  // 8. Call generateStoryOutline()
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

  // 9. Save outline + _monetizationMeta to DB
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

  // Save outline to StoryOutlineProduct
  await prisma.storyOutlineProduct.upsert({
    where: { outputId },
    create: { outputId, outlineData: outlineToSave as any, provider: 'outline-generation' },
    update: { outlineData: outlineToSave as any },
  })

  // Save monetization to MonetizationProduct if present
  if (effectiveMonetizationContext) {
    await prisma.monetizationProduct.upsert({
      where: { outputId },
      create: { outputId, contextData: effectiveMonetizationContext as any },
      update: { contextData: effectiveMonetizationContext as any },
    })
  }

  // Set StageGates: STORY_OUTLINE → PENDING_REVIEW, SCRIPT → NOT_STARTED (outline changed)
  await Promise.all([
    prisma.stageGate.upsert({
      where: { outputId_stage: { outputId, stage: 'STORY_OUTLINE' } },
      create: { outputId, stage: 'STORY_OUTLINE', status: 'PENDING_REVIEW', executedAt: new Date() },
      update: { status: 'PENDING_REVIEW', feedback: null, reviewedAt: null, executedAt: new Date() },
    }),
    prisma.stageGate.upsert({
      where: { outputId_stage: { outputId, stage: 'SCRIPT' } },
      create: { outputId, stage: 'SCRIPT', status: 'NOT_STARTED' },
      update: { status: 'NOT_STARTED', feedback: null, reviewedAt: null },
    }),
  ])

  // 10. Log cost (fire-and-forget)
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
    outline: result.outline,
    usage: result.usage,
    provider: result.provider,
    model: result.model,
  }
}
