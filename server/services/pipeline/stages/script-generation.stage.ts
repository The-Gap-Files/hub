/**
 * Script Generation Stage
 * ─────────────────────────────────────────────────────────────────────
 * Estágio isolado de geração de roteiros. Recebe promptContext pré-montado
 * pelo caller (pipeline ou endpoint) e executa:
 *
 * 1. Enriquecimento com monetization meta (narrativeRole, editorial, avoidPatterns)
 * 2. Carregamento de custom scenes (imagens de referência do criador)
 * 3. Filtragem de fontes (teaser: limpa dossier; fullVideo: brief only)
 * 4. Resolução de provider (hook-only vs genérico)
 * 5. Geração + validação + retry loop (max 10)
 * 6. Pós-processamento Cineasta (filmmaker batched)
 * 7. Persistência no DB (generate ou regenerate mode)
 *
 * Elimina a duplicação entre output-pipeline.service.ts e regenerate-script.post.ts.
 */

import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../providers'
import { costLogService } from '../../cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'
import { validateScript } from '../../script-validator.service'
import { getScriptStyleById } from '../../../constants/storytelling/script-styles'
import { validatorsEnabled } from '../../../utils/validators'
import { buildProductionContext, type VisualStyleLike } from './_shared/build-production-context'
import { runFilmmakerBatched } from './_shared/run-filmmaker-batched'
import { callWriter } from './_shared/call-writer'
import type { ScriptGenerationRequest } from '../../../types/ai-providers'
import type { StoryOutline } from '../../story-architect.service'
import { formatEpisodeBriefForPrompt } from '../../../types/episode-briefing.types'
import { normalizeEpisodeBriefBundleV1 } from '../../../types/episode-briefing.types'

const LOG = '[ScriptStage]'

// ─── INTERFACES ──────────────────────────────────────────────────────

export interface ScriptStageInput {
  outputId: string

  /** promptContext pré-montado pelo caller (pipeline ou endpoint) */
  promptContext: ScriptGenerationRequest

  /** Outline aprovado (com _monetizationMeta e _customScenes opcionais) */
  outlineData: StoryOutline & {
    _monetizationMeta?: any
    _customScenes?: Array<{
      order: number
      narration: string
      referenceImageId?: string | null
      imagePrompt?: string | null
    }>
    _selectedHookLevel?: string
  }

  /** Visual style (constantes ou DB) */
  visualStyle?: VisualStyleLike | null

  /** Visual identity do dossier */
  visualIdentityContext?: string | null

  /** Duração do output (fallback para targetDuration) */
  outputDuration?: number | null

  /** 'generate' = primeiro roteiro; 'regenerate' = refazer com feedback */
  mode: 'generate' | 'regenerate'
}

export interface ScriptStageResult {
  scriptId: string
  sceneCount: number
  wordCount: number
  validation?: {
    approved: boolean
    violations?: string[]
    corrections?: string
    overResolution?: boolean
  }
  providerName: string
}

// ─── STAGE ───────────────────────────────────────────────────────────

class ScriptGenerationStage {

  async execute(input: ScriptStageInput): Promise<ScriptStageResult> {
    const { outputId, promptContext, outlineData, mode } = input

    // 1. Enriquecer promptContext com monetization meta
    this.enrichFromMonetizationMeta(promptContext, outlineData)

    // 2. Custom scenes: carregar imagens de referência do criador
    const customSceneRefDescriptions = await this.loadCustomSceneImages(promptContext, outlineData)

    // 3. Filtrar fontes (teaser: limpa dossier; fullVideo: brief only + injetar Episode Brief)
    await this.applySourceFiltering(promptContext, outlineData, outputId)

    // 4. Writer → Screenwriter (pipeline de duas etapas)
    //    Hook-only pula o Writer (são apenas 4-5 cenas, sem risco de reinício narrativo)
    const isHookOnly = promptContext.narrativeRole === 'hook-only'
    if (!isHookOnly) {
      await this.runWriterStage(promptContext, outputId)
    }

    // 5. Resolver script provider (hook-only vs genérico)
    const scriptProvider = await this.resolveProvider(promptContext)
    const providerName = scriptProvider.getName()

    // 6. Gerar + validar + retry (Screenwriter quando writerProse presente)
    const { scriptResponse, validation } = await this.generateWithValidation(
      scriptProvider, promptContext, outlineData, outputId, input.outputDuration ?? null, mode
    )

    // 7. Filmmaker Director (Cineasta) — pós-processamento
    await this.applyFilmmaker(scriptResponse, input, outlineData, customSceneRefDescriptions)

    // 8. Persistir no DB
    const scriptId = mode === 'generate'
      ? await this.persistGenerate(outputId, scriptResponse, providerName, promptContext)
      : await this.persistRegenerate(outputId, scriptResponse, providerName, promptContext)

    return {
      scriptId,
      sceneCount: scriptResponse.scenes?.length || 0,
      wordCount: scriptResponse.wordCount || 0,
      validation,
      providerName,
    }
  }

  // ─── PRIVATE: Writer Stage (Etapa 1) ───────────────────────────

  /**
   * Executa o Writer para gerar prosa narrativa a partir do dossiê/outline.
   * Injeta a prosa no promptContext.writerProse, o que faz o buildSystemPrompt/
   * buildUserPrompt delegarem automaticamente para os prompts do Screenwriter.
   *
   * Também limpa imagens do promptContext (o Writer já as consumiu —
   * o Screenwriter não precisa de imagens raw do dossiê).
   */
  private async runWriterStage(
    promptContext: ScriptGenerationRequest,
    outputId: string
  ): Promise<void> {
    console.log(`${LOG} ──────────────────────────────────────────`)
    console.log(`${LOG} 📝 ETAPA 1/2: ESCRITOR (Writer)`)
    console.log(`${LOG} ──────────────────────────────────────────`)

    const writerResult = await callWriter(promptContext, outputId)

    // Injetar prosa no context — isso ativa o modo Screenwriter nos prompts
    promptContext.writerProse = writerResult.prose

    // Limpar imagens: o Writer já as consumiu para contexto narrativo.
    // O Screenwriter não precisa de imagens raw — ele trabalha com a prosa.
    promptContext.images = []

    console.log(`${LOG} ──────────────────────────────────────────`)
    console.log(`${LOG} 🎬 ETAPA 2/2: ROTEIRISTA (Screenwriter)`)
    console.log(`${LOG} ──────────────────────────────────────────`)
  }

  // ─── PRIVATE: Monetization Meta ──────────────────────────────────

  private enrichFromMonetizationMeta(
    promptContext: ScriptGenerationRequest,
    outlineData: ScriptStageInput['outlineData']
  ): void {
    const meta = outlineData._monetizationMeta
    if (!meta) return

    promptContext.narrativeRole = meta.narrativeRole || undefined
    promptContext.shortFormatType = meta.shortFormatType || undefined
    promptContext.strategicNotes = meta.strategicNotes || undefined

    // Episódio da série
    if (meta.episodeNumber) {
      promptContext.episodeNumber = meta.episodeNumber
      promptContext.totalEpisodes = 3
      console.log(`${LOG} 📺 Série: EP${meta.episodeNumber}/3`)
    }

    // Script style override
    if (meta.scriptStyleId) {
      const monetizationStyle = getScriptStyleById(meta.scriptStyleId)
      if (monetizationStyle) {
        promptContext.scriptStyleDescription = monetizationStyle.description
        promptContext.scriptStyleInstructions = monetizationStyle.instructions
        console.log(`${LOG} 🎭 Estilo sobrescrito pelo monetizador: ${meta.scriptStyleId}`)
      }
    }

    // Editorial objective override
    if (meta.editorialObjectiveId && meta.editorialObjectiveName) {
      promptContext.additionalContext = `🎯 OBJETIVO EDITORIAL (CRÍTICO - GOVERNA TODA A NARRATIVA):\n${meta.editorialObjectiveName}`
        + (promptContext.additionalContext ? `\n\n${promptContext.additionalContext}` : '')
      console.log(`${LOG} 🎯 Editorial sobrescrito: ${meta.editorialObjectiveId}`)
    }

    // Anti-padrões
    if (meta.avoidPatterns && meta.avoidPatterns.length > 0) {
      promptContext.avoidPatterns = meta.avoidPatterns
      console.log(`${LOG} ⛔ ${meta.avoidPatterns.length} anti-padrões injetados`)
    }
  }

  // ─── PRIVATE: Custom Scenes ──────────────────────────────────────

  private async loadCustomSceneImages(
    promptContext: ScriptGenerationRequest,
    outlineData: ScriptStageInput['outlineData']
  ): Promise<Array<{ sceneOrder: number; description: string; mimeType: string; imagePrompt?: string | null }>> {
    const customScenesDef = outlineData._customScenes
    const refDescriptions: Array<{ sceneOrder: number; description: string; mimeType: string; imagePrompt?: string | null }> = []

    if (!customScenesDef || customScenesDef.length === 0) return refDescriptions

    console.log(`${LOG} 🎬 ${customScenesDef.length} cena(s) personalizada(s) detectada(s).`)

    const imageIds = customScenesDef
      .filter(s => s.referenceImageId)
      .map(s => ({ sceneOrder: s.order, imageId: s.referenceImageId! }))

    if (imageIds.length === 0) return refDescriptions

    const refImages = await prisma.dossierImage.findMany({
      where: { id: { in: imageIds.map(i => i.imageId) } },
      select: { id: true, imageData: true, mimeType: true, description: true },
    })

    for (const { sceneOrder, imageId } of imageIds) {
      const img = refImages.find(i => i.id === imageId)
      const sceneDef = customScenesDef.find(s => s.order === sceneOrder)
      if (img?.imageData) {
        const buf = Buffer.from(img.imageData)
        const mime = img.mimeType || 'image/jpeg'
        const desc = img.description || 'Referência visual do criador'

        refDescriptions.push({ sceneOrder, description: desc, mimeType: mime, imagePrompt: sceneDef?.imagePrompt })

        // Inject into scriptwriter's multimodal images
        promptContext.images = [
          ...(promptContext.images || []),
          { data: buf, mimeType: mime, title: `[CENA PERSONALIZADA ${sceneOrder}] ${desc}` },
        ]
      }
    }

    if (refDescriptions.length > 0) {
      console.log(`${LOG} 🎬 ${refDescriptions.length} imagem(ns) de referência carregada(s).`)
    }

    return refDescriptions
  }

  // ─── PRIVATE: Source Filtering ───────────────────────────────────

  private async applySourceFiltering(
    promptContext: ScriptGenerationRequest,
    outlineData: ScriptStageInput['outlineData'],
    outputId: string
  ): Promise<void> {
    const meta = outlineData._monetizationMeta

    // Teasers: roteiro depende apenas do outline aprovado (sem dossier)
    if (meta?.itemType === 'teaser') {
      promptContext.sources = []
      promptContext.additionalSources = []
      promptContext.userNotes = []
      promptContext.visualReferences = []
      promptContext.researchData = undefined
      promptContext.persons = []
      promptContext.neuralInsights = []
      console.log(`${LOG} 🧼 Teaser: contexto do dossier removido`)
    }

    // Full Video: roteirista recebe apenas o brief curado (não o dossier bruto)
    if (meta?.itemType === 'fullVideo') {
      const episodeNumber = promptContext.episodeNumber || meta?.episodeNumber
      let briefSource: { title: string; content: string; type: string; weight: number } | null = null

      // Injetar Episode Brief como source para o Writer ter substância factual
      if (episodeNumber) {
        try {
          const output = await prisma.output.findUnique({
            where: { id: outputId },
            select: { dossierId: true },
          })
          if (output?.dossierId) {
            const dossier = await prisma.dossier.findUnique({
              where: { id: output.dossierId },
              select: { episodeBriefBundleV1: true },
            })
            if (dossier?.episodeBriefBundleV1) {
              const bundle = normalizeEpisodeBriefBundleV1(dossier.episodeBriefBundleV1)
              const briefContent = formatEpisodeBriefForPrompt(bundle, episodeNumber)
              briefSource = {
                title: `Brief EP${episodeNumber} (fonte da verdade — episodeBriefBundleV1)`,
                content: briefContent,
                type: 'brief',
                weight: 2.0,
              }
              console.log(`${LOG} 📋 Episode Brief EP${episodeNumber} injetado como source para Writer`)
            }
          }
        } catch (err) {
          console.warn(`${LOG} ⚠️ Falha ao carregar Episode Brief para injeção no Writer:`, err)
        }
      }

      // Filtrar sources: manter apenas briefs (inclui o que acabamos de injetar)
      const allSources = [...(promptContext.sources || []), ...(briefSource ? [briefSource] : [])]
      promptContext.sources = allSources.filter((s: any) => s.type === 'brief')
      console.log(`${LOG} 📺 Full Video: fontes filtradas para brief only (${promptContext.sources.length}/${allSources.length})`)
    }
  }

  // ─── PRIVATE: Provider Resolution ────────────────────────────────

  private async resolveProvider(promptContext: ScriptGenerationRequest) {
    const isHookOnly = promptContext.narrativeRole === 'hook-only'
    const provider = isHookOnly
      ? await providerManager.getHookOnlyScriptProvider()
      : await providerManager.getScriptProvider()

    if (isHookOnly) {
      console.log(`${LOG} 💥 HOOK-ONLY: usando provider dedicado (${provider.getName()}).`)
    }

    return provider
  }

  // ─── PRIVATE: Generate + Validate Loop ───────────────────────────

  private async generateWithValidation(
    scriptProvider: any,
    promptContext: ScriptGenerationRequest,
    outlineData: ScriptStageInput['outlineData'],
    outputId: string,
    outputDuration: number | null,
    mode: 'generate' | 'regenerate'
  ): Promise<{
    scriptResponse: any
    validation?: ScriptStageResult['validation']
  }> {
    const MAX_RETRIES = 10
    const costAction = mode === 'generate' ? 'create' : 'recreate'
    let scriptResponse = await scriptProvider.generate(promptContext)
    let scriptValidation: ScriptStageResult['validation'] | undefined

    // Cost log — first generation
    this.logCost(outputId, scriptResponse, costAction,
      `Script ${mode} - ${scriptResponse.wordCount} words, ${scriptResponse.scenes?.length || 0} scenes`)

    // Validation loop (only for teasers with narrativeRole)
    if (!validatorsEnabled()) {
      console.log(`${LOG} ⏭️ Validação DESABILITADA (bypass global).`)
    }

    const meta = outlineData._monetizationMeta
    if (validatorsEnabled() && promptContext.narrativeRole && meta?.itemType === 'teaser') {
      const validationHistory: string[] = []

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          scriptValidation = await validateScript(
            scriptResponse.scenes || [],
            {
              itemType: 'teaser',
              narrativeRole: promptContext.narrativeRole,
              angleCategory: meta?.angleCategory,
              shortFormatType: promptContext.shortFormatType,
              targetDuration: promptContext.targetDuration || outputDuration || undefined,
              avoidPatterns: promptContext.avoidPatterns,
              selectedHookLevel: outlineData._selectedHookLevel || undefined,
              plannedOpenLoops: outlineData.openLoops?.filter((l: any) => l.closedAtBeat === null),
            }
          )

          if (scriptValidation.approved) {
            console.log(`${LOG} ✅ Script APROVADO${attempt > 0 ? ` (após ${attempt} retry)` : ''}.`)
            break
          }

          console.warn(`${LOG} ⚠️ Script REPROVADO (tentativa ${attempt + 1}/${MAX_RETRIES + 1}): ${scriptValidation.violations?.join('; ')}`)

          if (attempt < MAX_RETRIES) {
            const currentFeedback = [
              `⚠️ CORREÇÃO OBRIGATÓRIA (VALIDADOR REPROVOU O ROTEIRO — TENTATIVA ${attempt + 1}):`,
              ...(scriptValidation.violations || []).map(v => `- VIOLAÇÃO: ${v}`),
              scriptValidation.corrections ? `\nINSTRUÇÕES DE CORREÇÃO: ${scriptValidation.corrections}` : '',
              scriptValidation.overResolution ? `\n🚨 O roteiro RESOLVE DEMAIS para a role "${promptContext.narrativeRole}". Reduza explicações, remova conclusões e deixe loops abertos.` : '',
            ].filter(Boolean).join('\n')

            validationHistory.push(currentFeedback)

            const fullValidationFeedback = validationHistory.length > 1
              ? `📋 HISTÓRICO DE CORREÇÕES (${validationHistory.length} tentativas reprovadas):\n${'─'.repeat(50)}\n${validationHistory.map((f, i) => `[Tentativa ${i + 1}]\n${f}`).join('\n\n')}\n${'─'.repeat(50)}\n\n🚨 NÃO repita NENHUM erro listado acima.`
              : currentFeedback

            const retryContext = {
              ...promptContext,
              additionalContext: [promptContext.additionalContext || '', fullValidationFeedback].filter(Boolean).join('\n\n'),
            }

            console.log(`${LOG} 🔄 Retry ${attempt + 1} com feedback do validador (histórico: ${validationHistory.length})...`)
            scriptResponse = await scriptProvider.generate(retryContext)

            this.logCost(outputId, scriptResponse, 'recreate',
              `Script retry ${attempt + 1} (validator feedback) - ${scriptResponse.wordCount} words`)
          }
        } catch (e: any) {
          console.warn(`${LOG} ⚠️ Erro na validação (não-bloqueante): ${e?.message || e}`)
          break
        }
      }
    }

    return { scriptResponse, validation: scriptValidation }
  }

  // ─── PRIVATE: Filmmaker (Cineasta) ───────────────────────────────

  private async applyFilmmaker(
    scriptResponse: any,
    input: ScriptStageInput,
    outlineData: ScriptStageInput['outlineData'],
    customSceneRefDescriptions: Array<{ sceneOrder: number; description: string; mimeType: string; imagePrompt?: string | null }>
  ): Promise<void> {
    if (!scriptResponse.scenes || scriptResponse.scenes.length === 0) return

    try {
      const baseStyle = input.promptContext.visualBaseStyle ||
        input.visualStyle?.baseStyle ||
        'Cinematic 35mm photography, hyperrealistic dark mystery style'

      const productionCtx = buildProductionContext({
        visualStyle: input.visualStyle,
        visualIdentity: input.visualIdentityContext,
        storyOutline: outlineData,
        customSceneReferences: customSceneRefDescriptions.length > 0 ? customSceneRefDescriptions : undefined,
        theme: input.promptContext.theme,
      })

      await runFilmmakerBatched(scriptResponse.scenes, baseStyle, productionCtx)
    } catch (err) {
      console.error(`${LOG} ❌ Erro no Cineasta (salvando roteiro bruto):`, err)
    }
  }

  // ─── PRIVATE: Persist (generate mode) ────────────────────────────

  private async persistGenerate(
    outputId: string,
    scriptResponse: any,
    providerName: string,
    promptContext: ScriptGenerationRequest
  ): Promise<string> {
    const script = await prisma.script.create({
      data: {
        outputId,
        summary: scriptResponse.summary || '',
        fullText: scriptResponse.fullText,
        wordCount: scriptResponse.wordCount,
        provider: providerName as any,
        modelUsed: scriptResponse.model,
        promptUsed: JSON.stringify(promptContext),
        backgroundMusicPrompt: scriptResponse.backgroundMusic?.prompt || null,
        backgroundMusicVolume: scriptResponse.backgroundMusic?.volume || null,
      },
    })

    // Update output title if AI generated one
    if (scriptResponse.title) {
      await prisma.output.update({
        where: { id: outputId },
        data: { title: scriptResponse.title.replace(/^"|"$/g, '') },
      })
    }

    // Create scenes
    if (scriptResponse.scenes) {
      await prisma.scene.createMany({
        data: scriptResponse.scenes.map((scene: any, index: number) => ({
          outputId,
          order: index,
          narration: scene.narration?.trim(),
          visualDescription: scene.visualDescription?.trim(),
          endVisualDescription: scene.endVisualDescription?.trim() || null,
          endImageReferenceWeight: scene.endImageReferenceWeight ?? null,
          sceneEnvironment: scene.sceneEnvironment?.trim() || null,
          motionDescription: scene.motionDescription?.trim() || null,
          audioDescription: scene.audioDescription?.trim() || null,
          audioDescriptionVolume: scene.audioDescriptionVolume ?? null,
          characterRef: scene.characterRef?.trim() || null,
          estimatedDuration: scene.estimatedDuration || 5,
        })),
      })
    }

    // Create background music tracks
    if (scriptResponse.backgroundMusicTracks && scriptResponse.backgroundMusicTracks.length > 0) {
      await prisma.backgroundMusicTrack.createMany({
        data: scriptResponse.backgroundMusicTracks.map((track: any) => ({
          scriptId: script.id,
          prompt: track.prompt,
          volume: track.volume,
          startScene: track.startScene,
          endScene: track.endScene,
        })),
      })
    }

    return script.id
  }

  // ─── PRIVATE: Persist (regenerate mode) ──────────────────────────

  private async persistRegenerate(
    outputId: string,
    scriptResponse: any,
    providerName: string,
    promptContext: ScriptGenerationRequest
  ): Promise<string> {
    let scriptId = ''

    // Transaction with extended timeout for large scripts (100+ scenes)
    await prisma.$transaction(async (tx: any) => {
      const existingScript = await tx.script.findUnique({ where: { outputId } })

      if (existingScript) {
        await tx.script.update({
          where: { id: existingScript.id },
          data: {
            summary: scriptResponse.summary || '',
            fullText: scriptResponse.fullText,
            wordCount: scriptResponse.wordCount,
            provider: providerName as any,
            modelUsed: scriptResponse.model,
            promptUsed: JSON.stringify(promptContext),
            backgroundMusicPrompt: scriptResponse.backgroundMusic?.prompt || null,
            backgroundMusicVolume: scriptResponse.backgroundMusic?.volume || null,
            updatedAt: new Date(),
          },
        })
        scriptId = existingScript.id

        // Delete old tracks
        await tx.backgroundMusicTrack.deleteMany({ where: { scriptId: existingScript.id } })
      } else {
        const newScript = await tx.script.create({
          data: {
            outputId,
            summary: scriptResponse.summary || '',
            fullText: scriptResponse.fullText,
            wordCount: scriptResponse.wordCount,
            provider: providerName as any,
            modelUsed: scriptResponse.model,
            promptUsed: JSON.stringify(promptContext),
            backgroundMusicPrompt: scriptResponse.backgroundMusic?.prompt || null,
            backgroundMusicVolume: scriptResponse.backgroundMusic?.volume || null,
          },
        })
        scriptId = newScript.id
      }

      // Delete old scenes
      await tx.scene.deleteMany({ where: { outputId } })

      // Create new scenes (with ALL fields, including endVisualDescription, characterRef)
      if (scriptResponse.scenes) {
        await tx.scene.createMany({
          data: scriptResponse.scenes.map((scene: any, index: number) => ({
            outputId,
            order: index,
            narration: scene.narration?.trim(),
            visualDescription: scene.visualDescription?.trim(),
            endVisualDescription: scene.endVisualDescription?.trim() || null,
            endImageReferenceWeight: scene.endImageReferenceWeight ?? null,
            sceneEnvironment: scene.sceneEnvironment?.trim() || null,
            motionDescription: scene.motionDescription?.trim() || null,
            audioDescription: scene.audioDescription?.trim() || null,
            audioDescriptionVolume: scene.audioDescriptionVolume ?? null,
            characterRef: scene.characterRef?.trim() || null,
            estimatedDuration: scene.estimatedDuration || 5,
          })),
        })
      }

      // Create background music tracks
      if (scriptResponse.backgroundMusicTracks && scriptResponse.backgroundMusicTracks.length > 0) {
        await tx.backgroundMusicTrack.createMany({
          data: scriptResponse.backgroundMusicTracks.map((track: any) => ({
            scriptId,
            prompt: track.prompt,
            volume: track.volume,
            startScene: track.startScene,
            endScene: track.endScene,
          })),
        })
      }

      // Update output title if AI generated one
      if (scriptResponse.title) {
        await tx.output.update({
          where: { id: outputId },
          data: { title: scriptResponse.title.replace(/^"|"$/g, '') },
        })
      }

      // Reset approvals (scenes changed → images/motion need re-generation)
      await tx.output.update({
        where: { id: outputId },
        data: {
          scriptApproved: false,
          imagesApproved: false,
          status: 'GENERATING',
        },
      })
    }, { timeout: 30000 })

    return scriptId
  }

  // ─── PRIVATE: Cost logging helper ────────────────────────────────

  private logCost(outputId: string, scriptResponse: any, action: 'create' | 'recreate', detail: string): void {
    // Use costInfo from provider response if available, otherwise calculate from tokens
    const cost = scriptResponse.costInfo?.cost
      ?? calculateLLMCost(
        scriptResponse.model || 'unknown',
        scriptResponse.usage?.inputTokens ?? 0,
        scriptResponse.usage?.outputTokens ?? 0
      )

    const provider = scriptResponse.costInfo?.provider || scriptResponse.provider || 'UNKNOWN'
    const model = scriptResponse.costInfo?.model || scriptResponse.model || 'unknown'
    const metadata = scriptResponse.costInfo?.metadata || {
      input_tokens: scriptResponse.usage?.inputTokens ?? 0,
      output_tokens: scriptResponse.usage?.outputTokens ?? 0,
      total_tokens: (scriptResponse.usage?.inputTokens ?? 0) + (scriptResponse.usage?.outputTokens ?? 0),
    }

    costLogService.log({
      outputId,
      resource: 'script',
      action,
      provider,
      model,
      cost,
      metadata,
      detail,
    }).catch(() => { })
  }
}

export const scriptGenerationStage = new ScriptGenerationStage()
