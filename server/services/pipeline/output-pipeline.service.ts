/**
 * Output Pipeline Service
 *
 * Serviço principal que ORQUESTRA todo o processo de geração de conteúdo,
 * delegando cada etapa ao "provider" ativo (abstração de provedor IA).
 *
 * Integra Persons & Neural Insights do Intelligence Center ao pipeline.
 *
 * Suporta:
 * - VIDEO_TEASER (15-60s, vertical, cliffhanger)
 * - VIDEO_FULL (5-20min, horizontal, narrativa completa)
 * - Outros formatos futuros
 */

import type {
  ScriptGenerationRequest,
  TTSRequest,
  ImageGenerationRequest,
  MotionGenerationRequest,
  MusicGenerationRequest
} from '../../types/ai-providers'
import { prisma } from '../../utils/prisma'
import { getVisualStyleById } from '../../constants/visual-styles'
import { getScriptStyleById } from '../../constants/script-styles'
import { providerManager } from '../providers'
import { costLogService } from '../cost-log.service'
import { formatOutlineForPrompt } from '../story-architect.service'
import type { StoryOutline } from '../story-architect.service'
import { validateScript } from '../script-validator.service'
import { getClassificationById } from '../../constants/intelligence-classifications'
import { validateReplicatePricing } from '../../constants/pricing'
import { mapPersonsFromPrisma, mapNeuralInsightsFromNotes } from '../../utils/format-intelligence-context'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import { videoPipelineService } from './video-pipeline.service'
import { createPipelineLogger } from '../../utils/pipeline-logger'
import { validatorsEnabled } from '../../utils/validators'
import {
  appendPauseTagsForV3,
  clamp,
  computeHookOnlySceneBudgetsSeconds,
  computeSpeedForBudget,
  countWords,
  estimateSpeechSeconds,
  resolveHookOnlyTotalDurationSeconds,
  stripInlineAudioTags,
  stripSsmlBreakTags
} from '../../utils/hook-only-audio-timing'
import { filmmakerDirector, type ProductionContext } from '../filmmaker-director.service'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)
import os from 'node:os'
import crypto from 'node:crypto'

export interface OutputPipelineResult {
  outputId: string
  status: 'completed' | 'failed'
  outputPath?: string
  message?: string
  error?: string
}

export class OutputPipelineService {
  /**
   * Executa o pipeline completo para um Output
   */
  async execute(outputId: string): Promise<OutputPipelineResult> {
    const log = createPipelineLogger({ stage: 'Pipeline', outputId })
    log.info('Render solicitado; validando aprovações.')
    try {
      const output = await this.loadOutputContext(outputId)

      log.info('Aprovações', {
        script: output.scriptApproved,
        images: output.imagesApproved,
        audio: output.audioApproved,
        motion: output.videosApproved
      })

      // Validate Approvals
      if (!output.scriptApproved) throw new Error("Aprovação pendente: Roteiro")
      if (!output.imagesApproved) throw new Error("Aprovação pendente: Imagens (Visual)")
      if (!output.audioApproved) throw new Error("Aprovação pendente: Áudio (Narração)")
      // Motion agora é etapa obrigatória (sempre) antes do render.
      if (!output.videosApproved) throw new Error("Aprovação pendente: Motion (Vídeos)")

      // Execute Render
      await this.logExecution(outputId, 'render', 'started', 'Renderizando Master...')
      await this.renderVideo(outputId)

      return { outputId, status: 'completed' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.output.update({
        where: { id: outputId },
        data: { status: 'FAILED', errorMessage }
      })

      await this.logExecution(outputId, 'pipeline', 'failed', errorMessage)

      return { outputId, status: 'failed', error: errorMessage }
    }
  }

  /**
   * Carrega contexto completo do Output
   */
  public async loadOutputContext(outputId: string) {
    const output = await prisma.output.findUnique({
      where: { id: outputId },
      include: {
        dossier: {
          include: {
            sources: { orderBy: { order: 'asc' } },
            images: { orderBy: { order: 'asc' } },
            notes: { orderBy: { order: 'asc' } },
            persons: { orderBy: { order: 'asc' } }
          }
        },
        seed: true
      }
    })

    if (!output) throw new Error('Output não encontrado')

    // Resolver estilos e classificação a partir das constantes (não mais do DB)
    const scriptStyle = output.scriptStyleId ? getScriptStyleById(output.scriptStyleId) : undefined
    const visualStyle = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined
    const classification = output.classificationId ? getClassificationById(output.classificationId) : undefined

    return { ...output, scriptStyle, visualStyle, classification }
  }

  /**
   * Gera roteiro com contexto rico do dossier
   */
  public async generateScript(outputId: string) {
    const output = await this.loadOutputContext(outputId)
    const dossier = output.dossier

    // Construir prompt com TODAS as fontes
    const promptContext: ScriptGenerationRequest = {
      theme: dossier.theme,
      visualIdentityContext: dossier.visualIdentityContext || undefined,
      language: output.language || 'pt-BR',
      narrationLanguage: output.narrationLanguage || 'pt-BR',

      // FONTES UNIFICADAS (arquitetura flat/democratizada)
      sources: dossier.sources?.map((s: any) => ({
        title: s.title,
        content: s.content,
        type: s.sourceType,
        weight: s.weight ?? 1.0
      })) || [],

      // Insights do usuário
      userNotes: dossier.notes?.map((n: any) => n.content) || [],

      // Referências visuais (descrições)
      visualReferences: dossier.images?.map((i: any) => i.description) || [],

      // IMAGENS (MULTIMODAL - NOVO)
      // Enviamos os buffers das imagens para o provedor IA analisar visualmente
      images: dossier.images?.map((i: any) => ({
        data: i.imageData,
        mimeType: i.mimeType || 'image/jpeg',
        title: i.description
      })).filter((img: any) => img.data) || [],

      // Dados estruturados
      researchData: dossier.researchData,

      // Classificação temática (no output) + orientação musical e visual
      dossierCategory: output.classificationId || undefined,
      musicGuidance: output.classificationId ? getClassificationById(output.classificationId)?.musicGuidance : undefined,
      musicMood: output.classificationId ? getClassificationById(output.classificationId)?.musicMood : undefined,
      visualGuidance: output.classificationId ? getClassificationById(output.classificationId)?.visualGuidance : undefined,

      // Configuração de duração e tipo (fonte da verdade: cena; duration derivado quando sceneCount existe)
      targetDuration: (output.monetizationContext as any)?.sceneCount
        ? (output.monetizationContext as any).sceneCount * 5
        : (output.duration || 300),
      targetSceneCount: (output.monetizationContext as any)?.sceneCount,
      targetWPM: output.targetWPM || 150,

      // OUTPUT TYPE ESPECÍFICO
      outputType: output.outputType,
      format: output.format,

      // Estilo de roteiro
      scriptStyleDescription: output.scriptStyle?.description,
      scriptStyleInstructions: output.scriptStyle?.instructions,

      // Estilo visual (resolvido das constantes) — tags completas para o roteiro incorporar no visualDescription
      visualStyleName: output.visualStyle?.name,
      visualStyleDescription: output.visualStyle?.description,
      visualBaseStyle: output.visualStyle?.baseStyle || undefined,
      visualLightingTags: output.visualStyle?.lightingTags || undefined,
      visualAtmosphereTags: output.visualStyle?.atmosphereTags || undefined,
      visualCompositionTags: output.visualStyle?.compositionTags || undefined,
      visualGeneralTags: output.visualStyle?.tags || undefined,

      // Objetivo Editorial (diretriz narrativa prioritária)
      additionalContext: output.objective
        ? `🎯 OBJETIVO EDITORIAL (CRÍTICO - GOVERNA TODA A NARRATIVA):\n${output.objective}`
        : undefined,

      // Diretrizes
      mustInclude: output.mustInclude || undefined,
      mustExclude: output.mustExclude || undefined,

      // Persons & Neural Insights (Intelligence Center)
      persons: mapPersonsFromPrisma(dossier.persons),
      neuralInsights: mapNeuralInsightsFromNotes(dossier.notes)
    }

    // ─── Story Architect: plano narrativo é etapa isolada e deve estar aprovado ───
    if (!output.storyOutline) {
      throw new Error(
        'Plano narrativo não gerado. Gere o plano (Story Architect) na etapa anterior e valide antes de criar o roteiro.'
      )
    }
    if (!output.storyOutlineApproved) {
      throw new Error(
        'Plano narrativo pendente de aprovação. Aprove o plano narrativo antes de gerar o roteiro.'
      )
    }

    const outlineData = output.storyOutline as StoryOutline & { _monetizationMeta?: any }
    promptContext.storyOutline = formatOutlineForPrompt(outlineData)
    const scriptLog = createPipelineLogger({ stage: 'Outline', outputId })
    scriptLog.info(`Plano narrativo aprovado: ${outlineData.risingBeats?.length || 0} beats.`)

    // Extrair metadados de monetização do outline (narrativeRole, strategicNotes, creative direction)
    if (outlineData._monetizationMeta) {
      const meta = outlineData._monetizationMeta
      promptContext.narrativeRole = meta.narrativeRole || undefined
      promptContext.shortFormatType = meta.shortFormatType || undefined
      promptContext.strategicNotes = meta.strategicNotes || undefined

      // Episódio da série (governa transições e teasers entre EPs)
      if (meta.episodeNumber) {
        promptContext.episodeNumber = meta.episodeNumber
        promptContext.totalEpisodes = 3 // série fixa de 3 episódios
        scriptLog.info(`📺 Série: EP${meta.episodeNumber}/3`)
      }

      // Sobrescrever estilo de roteiro se o monetizador sugeriu um específico para este teaser
      if (meta.scriptStyleId) {
        const monetizationStyle = getScriptStyleById(meta.scriptStyleId)
        if (monetizationStyle) {
          promptContext.scriptStyleDescription = monetizationStyle.description
          promptContext.scriptStyleInstructions = monetizationStyle.instructions
          scriptLog.info(`🎭 Estilo de roteiro sobrescrito pelo monetizador: ${meta.scriptStyleId} (${meta.scriptStyleName || monetizationStyle.name})`)
        }
      }

      // Sobrescrever objetivo editorial se o monetizador sugeriu um específico
      if (meta.editorialObjectiveId && meta.editorialObjectiveName) {
        promptContext.additionalContext = `🎯 OBJETIVO EDITORIAL (CRÍTICO - GOVERNA TODA A NARRATIVA):\n${meta.editorialObjectiveName}`
        scriptLog.info(`🎯 Objetivo editorial sobrescrito pelo monetizador: ${meta.editorialObjectiveId} (${meta.editorialObjectiveName})`)
      }

      // Anti-padrões do monetizador (instruções de "O que NÃO fazer")
      if (meta.avoidPatterns && meta.avoidPatterns.length > 0) {
        promptContext.avoidPatterns = meta.avoidPatterns
        scriptLog.info(`⛔ ${meta.avoidPatterns.length} anti-padrões do monetizador injetados`)
      }

      scriptLog.info(`💰 Monetization meta: role=${meta.narrativeRole || 'none'}, style=${meta.scriptStyleId || 'default'}, editorial=${meta.editorialObjectiveId || 'default'}, avoidPatterns=${meta.avoidPatterns?.length || 0}, notes=${meta.strategicNotes ? 'yes' : 'no'}`)
    }

    // ── Teasers: depender do outline aprovado (sem dossiê/brief global) ─────────
    if (outlineData._monetizationMeta?.itemType === 'teaser') {
      promptContext.sources = []
      promptContext.additionalSources = []
      promptContext.userNotes = []
      promptContext.visualReferences = []
      promptContext.researchData = undefined
      promptContext.persons = []
      promptContext.neuralInsights = []
      scriptLog.info('🧼 Teaser: contexto do dossiê removido (roteiro depende do outline aprovado)')
    }

    // ── Resolver Script Provider (ROTEAMENTO SOLID) ────────
    // Hook-only usa provider dedicado com prompts cirúrgicos (~130 linhas, sem ruído).
    // Outros roles usam o provider genérico (~270 linhas, regras completas).
    const isHookOnly = promptContext.narrativeRole === 'hook-only'
    const scriptProvider = isHookOnly
      ? await providerManager.getHookOnlyScriptProvider()
      : await providerManager.getScriptProvider()

    if (isHookOnly) {
      scriptLog.info(`💥 HOOK-ONLY: usando provider dedicado (${scriptProvider.getName()}) com prompts cirúrgicos.`)
    }

    // ── Gerar roteiro com loop de validação (máx 1 retry) ────────
    const MAX_SCRIPT_RETRIES = 10
    let scriptResponse = await scriptProvider.generate(promptContext)
    let scriptValidation: { approved: boolean; violations?: string[]; corrections?: string; overResolution?: boolean } | undefined

    // Registrar custo da primeira geração
    costLogService.log({
      outputId,
      resource: 'script',
      action: 'create',
      provider: scriptResponse.costInfo.provider,
      model: scriptResponse.costInfo.model,
      cost: scriptResponse.costInfo.cost,
      metadata: scriptResponse.costInfo.metadata,
      detail: `Script generation - ${scriptResponse.wordCount} words, ${scriptResponse.scenes?.length || 0} scenes`
    }).catch(() => { })

    // Validar e retry se reprovado (apenas para teasers com narrativeRole)
    // TEMPORÁRIO: validadores e loops de retry desativados globalmente.
    if (!validatorsEnabled()) {
      scriptLog.info('⏭️ Validação DESABILITADA temporariamente (bypass global).')
    }
    if (validatorsEnabled() && promptContext.narrativeRole && outlineData._monetizationMeta?.itemType === 'teaser') {
      // Histórico acumulativo de feedbacks — garante que erros corrigidos não voltem
      const validationHistory: string[] = []

      for (let attempt = 0; attempt <= MAX_SCRIPT_RETRIES; attempt++) {
        try {
          scriptValidation = await validateScript(
            scriptResponse.scenes || [],
            {
              itemType: 'teaser',
              narrativeRole: promptContext.narrativeRole,
              angleCategory: outlineData._monetizationMeta?.angleCategory,
              shortFormatType: promptContext.shortFormatType,
              targetDuration: promptContext.targetDuration || output.duration || undefined,
              avoidPatterns: promptContext.avoidPatterns,
              selectedHookLevel: (outlineData as any)._selectedHookLevel || undefined,
              plannedOpenLoops: outlineData.openLoops?.filter((l: any) => l.closedAtBeat === null)
            }
          )

          if (scriptValidation.approved) {
            scriptLog.info(`✅ Script APROVADO pelo validador${attempt > 0 ? ` (após ${attempt} retry)` : ''}.`)
            break
          }

          // Reprovado — tentar regenerar com feedback das violações
          scriptLog.warn(`⚠️ Script REPROVADO (tentativa ${attempt + 1}/${MAX_SCRIPT_RETRIES + 1}): ${scriptValidation.violations?.join('; ')}`)
          if (scriptValidation.overResolution) {
            scriptLog.warn(`🚨 OVER-RESOLUTION: roteiro resolve demais para role "${promptContext.narrativeRole}"`)
          }

          if (attempt < MAX_SCRIPT_RETRIES) {
            // Montar feedback desta tentativa
            const currentFeedback = [
              `⚠️ CORREÇÃO OBRIGATÓRIA (VALIDADOR REPROVOU O ROTEIRO — TENTATIVA ${attempt + 1}):`,
              ...(scriptValidation.violations || []).map(v => `- VIOLAÇÃO: ${v}`),
              scriptValidation.corrections ? `\nINSTRUÇÕES DE CORREÇÃO: ${scriptValidation.corrections}` : '',
              scriptValidation.overResolution ? `\n🚨 O roteiro RESOLVE DEMAIS para a role "${promptContext.narrativeRole}". Reduza explicações, remova conclusões e deixe loops abertos.` : ''
            ].filter(Boolean).join('\n')

            // Acumular no histórico — o roteirista vê TODOS os feedbacks anteriores
            validationHistory.push(currentFeedback)

            const fullValidationFeedback = validationHistory.length > 1
              ? `📋 HISTÓRICO DE CORREÇÕES (${validationHistory.length} tentativas reprovadas):\n${'─'.repeat(50)}\n${validationHistory.map((f, i) => `[Tentativa ${i + 1}]\n${f}`).join('\n\n')}\n${'─'.repeat(50)}\n\n🚨 NÃO repita NENHUM erro listado acima. Cada violação já corrigida que reaparecer é uma falha crítica.`
              : currentFeedback

            const retryContext = {
              ...promptContext,
              additionalContext: [promptContext.additionalContext || '', fullValidationFeedback].filter(Boolean).join('\n\n')
            }

            scriptLog.info(`🔄 Regenerando script com feedback do validador (histórico: ${validationHistory.length} tentativas)...`)
            scriptResponse = await scriptProvider.generate(retryContext)

            // Registrar custo do retry
            costLogService.log({
              outputId,
              resource: 'script',
              action: 'recreate',
              provider: scriptResponse.costInfo.provider,
              model: scriptResponse.costInfo.model,
              cost: scriptResponse.costInfo.cost,
              metadata: scriptResponse.costInfo.metadata,
              detail: `Script retry (validator feedback) - ${scriptResponse.wordCount} words, ${scriptResponse.scenes?.length || 0} scenes`
            }).catch(() => { })
          }
        } catch (validationError: any) {
          scriptLog.warn(`⚠️ Erro na validação do script (não-bloqueante): ${validationError?.message || validationError}`)
          break // Se a validação falhar, não tenta retry
        }
      }
    }

    // ─── AGENTE CINEASTA (FILMMAKER DIRECTOR) — PÓS-PROCESSAMENTO ───
    // Entra aqui para polir a "Visão" do roteiro.
    // Transforma descrições genéricas em prompts técnicos de cinema.
    // Recebe Production Awareness (Style Anchor + Visual Identity) para evitar redundância
    // e manter continuidade visual semântica entre cenas do mesmo ambiente.
    if (scriptResponse.scenes && scriptResponse.scenes.length > 0) {
      try {
        scriptLog.info('🎬 Acionando o Agente Cineasta para direção de fotografia e movimento...')

        // Determinar estilo base para o Cineasta
        const baseStyleForDirector = promptContext.visualBaseStyle ||
          "Cinematic 35mm photography, hyperrealistic dark mystery style"

        // Montar Production Context para o filmmaker ter consciência do pipeline
        const vs = output.visualStyle
        const anchorParts: string[] = []
        if (vs) {
          if (vs.baseStyle) anchorParts.push(vs.baseStyle)
          if (vs.lightingTags) anchorParts.push(vs.lightingTags)
          if (vs.atmosphereTags) anchorParts.push(vs.atmosphereTags)
          if (vs.compositionTags) anchorParts.push(vs.compositionTags)
          if (vs.tags) anchorParts.push(vs.tags)
        }

        const productionCtx: ProductionContext = {
          styleAnchorTags: anchorParts.length > 0 ? anchorParts.join(', ') : undefined,
          visualIdentity: output.dossier?.visualIdentityContext || undefined,
          storyOutline: outlineData
        }

        const refinedScenes = await filmmakerDirector.refineScript(
          scriptResponse.scenes.map(s => ({
            order: 0,
            narration: s.narration,
            currentVisual: s.visualDescription,
            currentEnvironment: s.sceneEnvironment,
            estimatedDuration: s.estimatedDuration || 5
          })),
          baseStyleForDirector,
          undefined,
          productionCtx
        )

        // Mesclar refinamentos de volta nas cenas originais
        if (refinedScenes && refinedScenes.length === scriptResponse.scenes.length) {
          scriptResponse.scenes = scriptResponse.scenes.map((original, i) => {
            const refined = refinedScenes?.[i]
            if (!refined) return original

            return {
              ...original,
              visualDescription: refined.visualDescription || original.visualDescription,
              motionDescription: refined.motionDescription || original.motionDescription,
              sceneEnvironment: refined.sceneEnvironment || original.sceneEnvironment
            }
          })
          scriptLog.info('✅ Cineasta refinou todas as cenas com sucesso.')
        } else {
          scriptLog.warn(`⚠️ Cineasta retornou número incorreto de cenas (${refinedScenes?.length} vs ${scriptResponse.scenes.length}). Ignorando refinamento para evitar desincronia.`)
        }
      } catch (directorError) {
        scriptLog.error('❌ Erro crítico no Agente Cineasta (ignorando e salvando roteiro bruto):', directorError)
      }
    }

    // Salvar roteiro
    const script = await prisma.script.create({
      data: {
        outputId,
        summary: scriptResponse.summary || '',
        fullText: scriptResponse.fullText,
        wordCount: scriptResponse.wordCount,
        provider: scriptProvider.getName() as any,
        modelUsed: scriptResponse.model,
        promptUsed: JSON.stringify(promptContext),
        backgroundMusicPrompt: scriptResponse.backgroundMusic?.prompt || null,
        backgroundMusicVolume: scriptResponse.backgroundMusic?.volume || null
      }
    })

    // Atualizar título do Output se a IA gerou um
    if (scriptResponse.title) {
      await prisma.output.update({
        where: { id: outputId },
        data: { title: scriptResponse.title.replace(/^"|"$/g, '') } // Remove aspas extras se houver
      })
    }

    // Salvar cenas
    if (scriptResponse.scenes) {
      await prisma.scene.createMany({
        data: scriptResponse.scenes.map((scene, index) => ({
          outputId,
          order: index,
          narration: scene.narration?.trim(),
          visualDescription: scene.visualDescription?.trim(),
          sceneEnvironment: scene.sceneEnvironment?.trim() || null,
          motionDescription: scene.motionDescription?.trim() || null,
          audioDescription: scene.audioDescription?.trim() || null,
          audioDescriptionVolume: scene.audioDescriptionVolume ?? null,
          estimatedDuration: scene.estimatedDuration || 5
        }))
      })
    }

    // Salvar background music tracks (YouTube Cinematic)
    if (scriptResponse.backgroundMusicTracks && scriptResponse.backgroundMusicTracks.length > 0) {
      await prisma.backgroundMusicTrack.createMany({
        data: scriptResponse.backgroundMusicTracks.map(track => ({
          scriptId: script.id,
          prompt: track.prompt,
          volume: track.volume,
          startScene: track.startScene,
          endScene: track.endScene
        }))
      })
    }

    return script
  }

  /**
   * Gera imagens para as cenas
   */
  public async generateImages(outputId: string) {
    const log = createPipelineLogger({ stage: 'Images', outputId })
    const output = await this.loadOutputContext(outputId)
    try {
      const imageProvider = providerManager.getImageProvider()
      log.info(`Provedor de imagens: ${imageProvider.getName()}.`)

      // Validar pricing antes de gastar dinheiro
      const imageModel = (imageProvider as any).model || 'luma/photon-flash'
      validateReplicatePricing(imageModel)

      const scenes = await prisma.scene.findMany({
        where: { outputId },
        orderBy: { order: 'asc' }
      })

      log.info(`${scenes.length} cenas para gerar imagens.`)

      const CONCURRENCY_LIMIT = 5 // Lotes de 5 para evitar rate-limit/erros da API
      const sceneChunks = []
      for (let i = 0; i < scenes.length; i += CONCURRENCY_LIMIT) {
        sceneChunks.push(scenes.slice(i, i + CONCURRENCY_LIMIT))
      }

      let restrictedCount = 0
      let successCount = 0
      let errorCount = 0

      // =====================================================================
      // 🎨 VISUAL STYLE ANCHOR (safety net para o modelo de imagem)
      // O filmmaker agora tem Production Awareness e cuida da continuidade
      // visual semântica entre cenas. Aqui mantemos apenas o Style Anchor
      // como prefixo leve para estabilizar o modelo de geração de imagem.
      // =====================================================================

      const imgVs = output.visualStyle
      const imgAnchorParts: string[] = []
      if (imgVs) {
        if (imgVs.baseStyle) imgAnchorParts.push(imgVs.baseStyle)
        if (imgVs.lightingTags) imgAnchorParts.push(imgVs.lightingTags)
        if (imgVs.atmosphereTags) imgAnchorParts.push(imgVs.atmosphereTags)
        if (imgVs.compositionTags) imgAnchorParts.push(imgVs.compositionTags)
        if (imgVs.tags) imgAnchorParts.push(imgVs.tags)
      }
      const styleAnchor = imgAnchorParts.length > 0
        ? `[VISUAL STYLE ANCHOR — ${imgAnchorParts.join(', ')}]`
        : ''

      if (styleAnchor) {
        log.info(`🎨 Style Anchor: ${styleAnchor.slice(0, 100)}...`)
      }

      for (const chunk of sceneChunks) {
        const results = await Promise.allSettled(chunk.map(async (scene, chunkIndex) => {
          const absoluteIndex = scenes.indexOf(scene)
          log.step(`Cena ${absoluteIndex + 1}/${scenes.length}`, `sceneId=${scene.id}`)

          const isPortrait = output.aspectRatio === '9:16'
          const width = isPortrait ? 768 : 1344
          const height = isPortrait ? 1344 : 768

          // Montar prompt visual: Style Anchor (safety net) + visualDescription do filmmaker
          // Continuidade visual e identidade já foram incorporadas pelo filmmaker via Production Awareness
          let visualPrompt = scene.visualDescription

          if (styleAnchor) {
            visualPrompt = `${styleAnchor}\n\n${visualPrompt}`
            log.step(`Cena ${absoluteIndex + 1}`, `🎨 Anchor applied${scene.sceneEnvironment ? ` (env: ${scene.sceneEnvironment})` : ''}`)
          }


          // ── GERAÇÃO DE IMAGEM DA CENA ──
          log.step(`Cena ${absoluteIndex + 1}/${scenes.length}`, `prompt: ${visualPrompt.slice(0, 80)}...`)

          const imageRequest: ImageGenerationRequest = {
            prompt: visualPrompt,
            width,
            height,
            aspectRatio: output.aspectRatio || '16:9',
            seed: output.seed?.value,
            numVariants: 1
          }

          const imageResponse = await imageProvider.generate(imageRequest)
          const generatedImage = imageResponse.images[0]

          if (generatedImage) {
            await prisma.sceneImage.create({
              data: {
                sceneId: scene.id,
                role: 'start',
                provider: imageProvider.getName() as any,
                promptUsed: scene.visualDescription,
                fileData: Buffer.from(generatedImage.buffer) as any,
                mimeType: 'image/png',
                originalSize: generatedImage.buffer.length,
                width: generatedImage.width,
                height: generatedImage.height,
                isSelected: true,
                variantIndex: 0
              }
            })

            costLogService.log({
              outputId,
              resource: 'image',
              action: 'create',
              provider: imageResponse.costInfo.provider,
              model: imageResponse.costInfo.model,
              cost: imageResponse.costInfo.cost,
              metadata: imageResponse.costInfo.metadata,
              detail: `Scene ${absoluteIndex + 1} - image generation`
            }).catch(() => { })
          }
        }))

        // Processar resultados do allSettled
        for (let i = 0; i < results.length; i++) {
          const result = results[i]!
          const scene = chunk[i]!
          const absoluteIndex = scenes.indexOf(scene)

          if (result.status === 'fulfilled') {
            successCount++
          } else if (result.status === 'rejected') {
            const error = (result as PromiseRejectedResult).reason
            const { ContentRestrictedError } = await import('../providers/image/replicate-image.provider')

            if (error instanceof ContentRestrictedError) {
              restrictedCount++
              log.warn(`Cena ${absoluteIndex + 1} RESTRITA pelo filtro de conteúdo: ${error.message.slice(0, 100)}`)

              // Marcar a cena como restrita no banco
              await prisma.scene.update({
                where: { id: scene.id },
                data: {
                  imageStatus: 'restricted',
                  imageRestrictionReason: error.message
                }
              })
            } else {
              errorCount++
              log.error(`Cena ${absoluteIndex + 1} falhou (erro não-safety): ${error?.message?.slice(0, 100) || error}`)

              // Marcar como erro genérico
              await prisma.scene.update({
                where: { id: scene.id },
                data: {
                  imageStatus: 'error',
                  imageRestrictionReason: error?.message?.slice(0, 500) || 'Unknown error'
                }
              })
            }
          }
        }
      }

      // Marcar cenas que geraram com sucesso
      const generatedSceneIds = await prisma.sceneImage.findMany({
        where: { scene: { outputId } },
        select: { sceneId: true }
      })
      const generatedIds = new Set(generatedSceneIds.map(s => s.sceneId))
      for (const scene of scenes) {
        if (generatedIds.has(scene.id) && !['restricted', 'error'].includes(scene.imageStatus || '')) {
          await prisma.scene.update({
            where: { id: scene.id },
            data: { imageStatus: 'generated' }
          })
        }
      }

      log.info(`Geração de imagens concluída: ${successCount} OK, ${restrictedCount} restritas, ${errorCount} erros.`)

      if (restrictedCount > 0) {
        log.warn(`⚠️ ${restrictedCount} cena(s) foram bloqueadas pelo filtro de conteúdo. O usuário pode revisar e regenerar na tela de checagem.`)
      }
    }
    catch (error) {
      log.error('Erro ao gerar imagens.', error)
      throw error
    }
  }

  /**
   * Gera música de fundo via Stable Audio 2.5 (Replicate)
   * TikTok/Instagram: 1 música para todo o vídeo
   * YouTube Cinematic: N tracks com timestamps
   */
  public async generateBackgroundMusic(outputId: string) {
    const log = createPipelineLogger({ stage: 'BGM', outputId })
    const output = await this.loadOutputContext(outputId)
    log.info('Gerando música de fundo.')

    // Buscar script com dados de música
    const script = await prisma.script.findUnique({
      where: { outputId },
      include: { backgroundMusicTracks: true }
    })

    if (!script) {
      throw new Error('[OutputPipeline] ❌ Script not found. Generate script first.')
    }

    // Verificar se já existe BGM gerado
    const existingBgm = await prisma.audioTrack.findFirst({
      where: { outputId, type: 'background_music' }
    })

    if (existingBgm) {
      log.info('BGM já existe; pulando.')
      return
    }

    const musicProvider = providerManager.getMusicProvider()

    // Validar pricing antes de gastar dinheiro
    const musicModel = (musicProvider as any).model || 'stability-ai/stable-audio-2.5'
    validateReplicatePricing(musicModel)

    // Calcular duração REAL a partir das narrações geradas (não estimada)
    const narrationTracks = await prisma.audioTrack.findMany({
      where: { outputId, type: 'scene_narration' },
      select: { duration: true }
    })

    let totalNarrationDuration = 0
    if (narrationTracks.length > 0) {
      totalNarrationDuration = narrationTracks.reduce((acc, t) => acc + (t.duration || 5), 0)
      log.info(`Duração real da narração: ${totalNarrationDuration.toFixed(2)}s (${narrationTracks.length} cenas).`)
    }

    // Usar duração real da narração, fallback para duração estimada do output
    const videoDuration = totalNarrationDuration > 0
      ? Math.ceil(totalNarrationDuration)
      : (output.duration || 120)

    log.info(`Duração alvo da música: ${videoDuration}s (baseada na narração).`)

    // CASO 1: Música única para todo o vídeo (TikTok/Instagram)
    if (script.backgroundMusicPrompt) {
      const duration = Math.min(190, videoDuration) // Stable Audio max: 190s

      log.step('Música única (vídeo todo)', `${duration}s — volume ${script.backgroundMusicVolume}dB`)
      log.info(`Prompt BGM: "${(script.backgroundMusicPrompt || '').slice(0, 60)}..."`)

      const request: MusicGenerationRequest = {
        prompt: script.backgroundMusicPrompt,
        duration
      }

      const musicResponse = await musicProvider.generate(request)

      await prisma.audioTrack.create({
        data: {
          outputId,
          type: 'background_music',
          provider: musicProvider.getName().toUpperCase() as any,
          fileData: Buffer.from(musicResponse.audioBuffer) as any,
          mimeType: 'audio/mpeg',
          originalSize: musicResponse.audioBuffer.length,
          duration: musicResponse.duration
        }
      })

      // Registrar custo da música (fire-and-forget) — usa costInfo do provider
      costLogService.log({
        outputId,
        resource: 'bgm',
        action: 'create',
        provider: musicResponse.costInfo.provider,
        model: musicResponse.costInfo.model,
        cost: musicResponse.costInfo.cost,
        metadata: musicResponse.costInfo.metadata,
        detail: `Background music (full video) - ${duration}s audio`
      }).catch(() => { })

      log.info(`BGM gerada: ${(musicResponse.audioBuffer.length / 1024).toFixed(0)} KB.`)
    }

    // CASO 2: Múltiplas tracks por segmento de cenas (YouTube Cinematic)
    else if (script.backgroundMusicTracks && script.backgroundMusicTracks.length > 0) {
      log.info(`${script.backgroundMusicTracks.length} track(s) de BGM (por cena).`)

      // Montar array com duração real de cada cena (da narração)
      const sceneDurations = narrationTracks.map((t: any) => t.duration || 5)
      const totalScenes = sceneDurations.length

      for (const track of script.backgroundMusicTracks) {
        const start = track.startScene || 0
        const end = track.endScene !== null && track.endScene !== undefined ? track.endScene : totalScenes - 1

        // Somar durações reais das cenas neste segmento
        const segmentDuration = sceneDurations
          .slice(start, end + 1)
          .reduce((acc: number, d: number) => acc + d, 0)

        const trackDuration = Math.min(190, Math.ceil(segmentDuration))

        log.step(`Track cenas ${start}→${end}`, `${end - start + 1} cenas, ${trackDuration}s, ${track.volume}dB`)
        log.info(`Prompt: "${(track.prompt || '').slice(0, 50)}..."`)

        const request: MusicGenerationRequest = {
          prompt: track.prompt,
          duration: trackDuration
        }

        const musicResponse = await musicProvider.generate(request)

        await prisma.audioTrack.create({
          data: {
            outputId,
            type: 'background_music',
            provider: musicProvider.getName().toUpperCase() as any,
            fileData: Buffer.from(musicResponse.audioBuffer) as any,
            mimeType: 'audio/mpeg',
            originalSize: musicResponse.audioBuffer.length,
            duration: musicResponse.duration
          }
        })

        // Registrar custo da track (fire-and-forget) — usa costInfo do provider
        costLogService.log({
          outputId,
          resource: 'bgm',
          action: 'create',
          provider: musicResponse.costInfo.provider,
          model: musicResponse.costInfo.model,
          cost: musicResponse.costInfo.cost,
          metadata: musicResponse.costInfo.metadata,
          detail: `BGM track scenes ${start}→${end} - ${trackDuration}s audio`
        }).catch(() => { })

        log.info(`Track gerada: ${(musicResponse.audioBuffer.length / 1024).toFixed(0)} KB.`)
      }
    } else {
      log.warn('Nenhum prompt de BGM no script; pulando.')
    }
  }

  /**
   * Gera áudio (narração) para cada cena
   */
  public async generateAudio(outputId: string) {
    const output = await this.loadOutputContext(outputId)
    console.log(`[OutputPipeline] 🎤 generateAudio per scene for Output ${outputId}`)

    const scenes = await prisma.scene.findMany({
      where: { outputId },
      orderBy: { order: 'asc' }
    })

    const ttsProvider = providerManager.getTTSProvider()

    const narrativeRole = (output.monetizationContext as any)?.narrativeRole
    const isHookOnly = narrativeRole === 'hook-only'
    const hookOnlyTotalSeconds = isHookOnly ? resolveHookOnlyTotalDurationSeconds(output.duration) : undefined
    const hookOnlyBudgets = isHookOnly ? computeHookOnlySceneBudgetsSeconds(hookOnlyTotalSeconds!) : undefined

    // -------------------------------------------------------------------------
    // Configuração de Modelo (Núcleo de IA)
    // Consultar banco para saber qual modelo usar (v2, v2.5, v3, etc.)
    // -------------------------------------------------------------------------
    const ttsAssignment = await prisma.mediaAssignment.findUnique({
      where: { taskId: 'tts-narration' }
    })
    const dbModelId = ttsAssignment?.model
    if (dbModelId) {
      console.log(`[OutputPipeline] 🤖 Usando modelo configurado no banco (tts-narration): ${dbModelId}`)
    } else {
      console.log(`[OutputPipeline] ⚠️ Nenhuma configuração de 'tts-narration' encontrada no banco. Usando fallback.`)
    }

    const CONCURRENCY_LIMIT = 5
    const sceneChunks = []
    for (let i = 0; i < scenes.length; i += CONCURRENCY_LIMIT) {
      sceneChunks.push(scenes.slice(i, i + CONCURRENCY_LIMIT))
    }

    for (const chunk of sceneChunks) {

      await Promise.all(chunk.map(async (scene) => {
        if (!scene.narration) return

        // Apagar áudio anterior se existir (sempre regenerar fresh)
        const existingAudios = await prisma.audioTrack.findMany({
          where: { sceneId: scene.id, type: 'scene_narration' }
        })

        if (existingAudios.length > 0) {
          await prisma.audioTrack.deleteMany({
            where: { sceneId: scene.id, type: 'scene_narration' }
          })
          console.log(`[OutputPipeline] 🗑️ Scene ${scene.order + 1}: ${existingAudios.length} áudio(s) anterior(es) apagado(s).`)
        }

        const targetWPM = output.targetWPM || 150 // legado (não é mais UX), ainda útil como default geral
        const calculatedSpeedFromWPM = targetWPM / 150
        const safeSpeedFromWPM = Math.max(0.7, Math.min(1.2, calculatedSpeedFromWPM))

        // Validação: Voice ID é obrigatório
        if (!output.voiceId) {
          throw new Error('[OutputPipeline] ❌ Voice ID is required. Please select a voice before generating output.')
        }

        // ---------------------------------------------------------------------
        // Hook-Only timing (16–22s) — controle interno por budgets + speed + tags v3
        // Sem FFmpeg determinístico de silêncio: usamos apenas tags inline do Eleven v3.
        // ---------------------------------------------------------------------
        const sceneIndex = scene.order // 0-based
        const targetBudgetSeconds = (isHookOnly && hookOnlyBudgets)
          ? (hookOnlyBudgets[sceneIndex] ?? 5)
          : 5

        // Texto base enviado ao TTS: permitir tags inline v3 ([pause], [breathes], etc.),
        // mas bloquear SSML <break> (queremos SOMENTE tags inline).
        const narrationRawForTTS = stripSsmlBreakTags(scene.narration).trim()
        // Texto para contagem de palavras: remove tags v3 inline (não devem contar como palavras)
        const narrationForCounting = stripInlineAudioTags(scene.narration)
        const wc = countWords(narrationForCounting)

        let speed = isHookOnly
          ? computeSpeedForBudget(wc, targetBudgetSeconds)
          : safeSpeedFromWPM

        // Hook-only: não desacelerar apenas para "preencher" o budget.
        // Se a cena ficar curta, aceitamos encerrar mais cedo (opção A).
        if (isHookOnly) {
          speed = Math.max(speed, safeSpeedFromWPM)
        }

        // Hook-Only: sem injeção artificial de [pause] — a duração natural do áudio é respeitada.
        const pauseCount = 0

        const maxAttempts = isHookOnly ? 3 : 1
        const toleranceSeconds = isHookOnly ? 0.35 : 999

        let audioResponse: any | null = null
        let realDuration = 0

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const ttsText = isHookOnly
            ? appendPauseTagsForV3(narrationRawForTTS, pauseCount)
            : narrationRawForTTS

          if (isHookOnly) {
            console.log(`[OutputPipeline] 🗣️ Scene ${scene.order + 1} hook-only attempt ${attempt}: budget=${targetBudgetSeconds.toFixed(2)}s speed=${speed.toFixed(2)} pauses=${pauseCount} words=${wc}`)
          } else {
            const estimatedAudioDuration = wc > 0 ? (wc / targetWPM) * 60 : 0
            console.log(`[OutputPipeline] 🗣️ Generating audio for scene ${scene.order + 1}. WPM: ${targetWPM}, Speed: ${speed.toFixed(2)}x, Est. Duration: ${estimatedAudioDuration.toFixed(2)}s`)
          }

          console.log(`[OutputPipeline] 📝 Scene ${scene.order + 1} TTS TEXT (íntegra):\n────────────────────────────────────\n${ttsText}\n────────────────────────────────────`)

          const request: TTSRequest = {
            text: ttsText,
            voiceId: output.voiceId,
            language: output.narrationLanguage || 'pt-BR',
            speed,
            modelId: dbModelId || (isHookOnly ? 'eleven_v3' : undefined)
          }

          audioResponse = await ttsProvider.synthesize(request)

          // Registrar custo por tentativa (hook-only pode ter retries)
          costLogService.log({
            outputId,
            resource: 'narration',
            action: 'create',
            provider: audioResponse.costInfo.provider,
            model: audioResponse.costInfo.model,
            cost: audioResponse.costInfo.cost,
            metadata: {
              ...audioResponse.costInfo.metadata,
              attempt,
              speed,
              pauseCount,
              isHookOnly,
              targetBudgetSeconds
            },
            detail: `Scene ${scene.order + 1} narration attempt ${attempt} - ${ttsText.length} chars`
          }).catch(() => { })

          if (!isHookOnly) {
            realDuration = audioResponse.duration
            break
          }

          // Medir duração REAL do MP3 (com pausas) para fitting.
          realDuration = await this.probeAudioDuration(Buffer.from(audioResponse.audioBuffer)).catch(() => audioResponse.duration)
          const diff = realDuration - targetBudgetSeconds

          if (Math.abs(diff) <= toleranceSeconds || attempt === maxAttempts) {
            break
          }

          // Se ficou curto, não tentar esticar desacelerando (opção A).
          if (diff < 0) {
            break
          }

          // Ajuste de speed com base na razão real/target (controle proporcional)
          const ratio = realDuration / Math.max(0.1, targetBudgetSeconds)
          speed = clamp(speed * ratio, 0.7, 1.2)

          if (diff > 0) {
            // longo demais: speed será ajustado na próxima iteração (ratio acima)
          } else {
            // curto demais: speed já foi ajustado via ratio
          }
        }

        if (!audioResponse) return

        await prisma.audioTrack.create({
          data: {
            outputId,
            sceneId: scene.id,
            type: 'scene_narration',
            provider: ttsProvider.getName().toUpperCase() as any,
            voiceId: output.voiceId,
            fileData: Buffer.from(audioResponse.audioBuffer) as any,
            mimeType: 'audio/mpeg',
            originalSize: audioResponse.audioBuffer.length,
            duration: realDuration || audioResponse.duration,
            // Word-level timestamps do ElevenLabs /with-timestamps
            alignment: audioResponse.wordTimings ? audioResponse.wordTimings as any : undefined
          }
        })
      }))
    }

    // Registrar ttsProvider no output (se ainda não estiver salvo)
    if (!output.ttsProvider) {
      await prisma.output.update({
        where: { id: outputId },
        data: { ttsProvider: ttsProvider.getName().toUpperCase() }
      })
    }
  }


  /**
   * Extrai a duração real de um buffer MP3 usando ffprobe.
   * Usado no fitting do Hook-Only (pausas inline v3 afetam a duração real).
   */
  private async probeAudioDuration(audioBuffer: Buffer): Promise<number> {
    const tempPath = path.join(os.tmpdir(), `tts-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)

    try {
      await fs.writeFile(tempPath, audioBuffer)

      const duration = await new Promise<number>((resolve, reject) => {
        const proc = spawn(ffprobeInstaller.path, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          tempPath
        ])

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

        proc.on('close', (code: number | null) => {
          if (code !== 0) return reject(new Error(`ffprobe exit code ${code}: ${stderr}`))
          try {
            const parsed = JSON.parse(stdout)
            const dur = parseFloat(parsed?.format?.duration)
            if (isNaN(dur) || dur <= 0) return reject(new Error('ffprobe retornou duração inválida'))
            resolve(dur)
          } catch (e) {
            reject(new Error(`Erro ao parsear saída do ffprobe: ${e}`))
          }
        })

        proc.on('error', (err: Error) => reject(new Error(`ffprobe spawn error: ${err.message}`)))
      })

      return duration
    } finally {
      await fs.unlink(tempPath).catch(() => { })
    }
  }

  /**
   * Gera efeitos sonoros (SFX) para cada cena que tem audioDescription
   * 
   * Usa ElevenLabs Sound Effects API para gerar áudio a partir do prompt.
   * A duração do SFX é calculada a partir da narração da cena (AudioTrack scene_narration).
   * Salva como AudioTrack tipo 'scene_sfx'.
   */
  public async generateSFX(outputId: string) {
    const log = createPipelineLogger({ stage: 'SFX', outputId })
    log.info('Iniciando geração de SFX por cena.')

    const scenes = await prisma.scene.findMany({
      where: { outputId },
      orderBy: { order: 'asc' },
      include: {
        audioTracks: {
          where: { type: { in: ['scene_narration', 'scene_sfx'] } }
        }
      }
    })

    // Filtrar cenas que têm audioDescription e não têm SFX já gerado
    const scenesWithSFX = scenes.filter(scene => {
      const hasPrompt = scene.audioDescription && scene.audioDescription.trim().length > 0
      const alreadyHasSFX = scene.audioTracks.some(t => t.type === 'scene_sfx')
      if (alreadyHasSFX) {
        log.info(`Cena ${scene.order + 1}: SFX já existe, pulando.`)
      }
      return hasPrompt && !alreadyHasSFX
    })

    if (scenesWithSFX.length === 0) {
      log.info('Nenhuma cena necessita de SFX (sem audioDescription ou já gerado).')
      return
    }

    log.info(`${scenesWithSFX.length}/${scenes.length} cenas com SFX para gerar.`)

    const sfxProvider = providerManager.getSFXProvider()

    const CONCURRENCY_LIMIT = 3 // SFX é mais lento que TTS
    const sceneChunks = []
    for (let i = 0; i < scenesWithSFX.length; i += CONCURRENCY_LIMIT) {
      sceneChunks.push(scenesWithSFX.slice(i, i + CONCURRENCY_LIMIT))
    }

    let successCount = 0
    let errorCount = 0

    for (const chunk of sceneChunks) {
      const results = await Promise.allSettled(chunk.map(async (scene) => {
        // Calcular duração do SFX = duração EXATA da narração
        const narrationTrack = scene.audioTracks.find(t => t.type === 'scene_narration')
        if (!narrationTrack?.duration) {
          log.warn(`Cena ${scene.order + 1}: sem narração com duração, pulando SFX.`)
          return
        }
        const narrationDuration = narrationTrack.duration
        // ElevenLabs SFX aceita até 22s de duração_seconds — acima disso, solicitar o máximo
        const sfxRequestDuration = Math.min(22, narrationDuration)

        log.step(`Cena ${scene.order + 1}`, `"${scene.audioDescription!.slice(0, 60)}..." → ${narrationDuration.toFixed(1)}s (req=${sfxRequestDuration.toFixed(1)}s), vol=${scene.audioDescriptionVolume ?? -12}dB`)

        const sfxResponse = await sfxProvider.generate({
          prompt: scene.audioDescription!,
          durationSeconds: sfxRequestDuration,
          promptInfluence: 0.3
        })

        // Pós-processamento: ajustar duração exata com FFmpeg (cortar ou padear com silêncio)
        let finalBuffer = sfxResponse.audioBuffer
        try {
          finalBuffer = await adjustSfxDuration(Buffer.from(sfxResponse.audioBuffer), narrationDuration)
          log.info(`Cena ${scene.order + 1}: SFX ajustado para ${narrationDuration.toFixed(1)}s exatos.`)
        } catch (ffmpegErr) {
          log.warn(`Cena ${scene.order + 1}: Falha ao ajustar duração do SFX, usando original. ${ffmpegErr}`)
        }

        await prisma.audioTrack.create({
          data: {
            outputId,
            sceneId: scene.id,
            type: 'scene_sfx',
            provider: sfxProvider.getName().toUpperCase() as any,
            fileData: Buffer.from(finalBuffer) as any,
            mimeType: 'audio/mpeg',
            originalSize: finalBuffer.length,
            duration: narrationDuration // Duração exata da narração
          }
        })

        // Registrar custo (fire-and-forget)
        costLogService.log({
          outputId,
          resource: 'sfx',
          action: 'create',
          provider: sfxResponse.costInfo.provider,
          model: sfxResponse.costInfo.model,
          cost: sfxResponse.costInfo.cost,
          metadata: sfxResponse.costInfo.metadata,
          detail: `Scene ${scene.order + 1} SFX - ${narrationDuration.toFixed(1)}s audio`
        }).catch(() => { })
      }))

      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          errorCount++
          log.error(`SFX falhou: ${result.reason?.message?.slice(0, 100) || result.reason}`)
        }
      }
    }

    log.info(`SFX concluído: ${successCount} OK, ${errorCount} erros de ${scenesWithSFX.length} cenas.`)
  }

  /**
   * Regenera toda a narração com uma nova voz
   * 
   * Fluxo:
   *   1. Atualiza o voiceId no output
   *   2. Deleta todos os AudioTracks de scene_narration existentes
   *   3. Reseta a flag audioApproved
   *   4. Gera novo áudio para todas as cenas com a nova voz
   */
  public async regenerateAudioWithVoice(outputId: string, newVoiceId: string) {
    console.log(`[OutputPipeline] 🔄 Regenerando narração com nova voz: ${newVoiceId}`)

    // 1. Atualizar voiceId no output
    const currentTtsProvider = providerManager.getTTSProvider().getName().toUpperCase()

    await prisma.output.update({
      where: { id: outputId },
      data: {
        voiceId: newVoiceId,
        ttsProvider: currentTtsProvider,
        audioApproved: false,
        // Se já tiver renderizado, resetar status pois o vídeo ficará desatualizado
        ...(await prisma.output.findUnique({ where: { id: outputId }, select: { status: true } })
          .then(o => o?.status === 'COMPLETED' ? {
            bgmApproved: false,
            videosApproved: false
          } : {}))
      }
    })

    // 2. Deletar TODOS os áudios de narração existentes
    const deleted = await prisma.audioTrack.deleteMany({
      where: {
        outputId,
        type: 'scene_narration'
      }
    })
    console.log(`[OutputPipeline] 🗑️ ${deleted.count} áudios de narração deletados`)

    // 3. Gerar novo áudio com a nova voz
    await this.generateAudio(outputId)

    console.log(`[OutputPipeline] ✅ Narração regenerada com voz ${newVoiceId}`)
  }

  /**
   * Gera motion (image-to-video)
   */
  public async generateMotion(outputId: string) {
    const output = await this.loadOutputContext(outputId)
    const motionProvider = providerManager.getMotionProvider()

    const motionModel = (motionProvider as any).model || 'wan-video/wan-2.2-i2v-fast'
    validateReplicatePricing(motionModel)
    const scenes = await prisma.scene.findMany({
      where: { outputId },
      include: {
        images: { where: { isSelected: true } },
        audioTracks: { where: { type: 'scene_narration' } }
      },
      orderBy: { order: 'asc' }
    })

    const CONCURRENCY_LIMIT = 50 // Motion em batch de 50
    const sceneChunks = []
    for (let i = 0; i < scenes.length; i += CONCURRENCY_LIMIT) {
      sceneChunks.push(scenes.slice(i, i + CONCURRENCY_LIMIT))
    }

    for (const chunk of sceneChunks) {
      await Promise.all(chunk.map(async (scene) => {
        // Buscar startImage (role='start' ou fallback sem role)
        const startImage = scene.images.find(img => img.role === 'start') || scene.images[0]

        if (!startImage?.fileData) return

        // Motion prompt: prefere motionDescription (focado em movimento)
        // Fallback: visualDescription (backward-compatible com roteiros antigos)
        const motionPrompt = scene.motionDescription || scene.visualDescription

        const durationSeconds = scene.audioTracks[0]?.duration ?? scene.estimatedDuration ?? 5
        const request: MotionGenerationRequest = {
          imageBuffer: Buffer.from(startImage.fileData!) as any,
          prompt: motionPrompt,
          duration: durationSeconds,
          aspectRatio: output.aspectRatio || '16:9'
        }

        console.log(`[OutputPipeline] 🎬 Motion scene ${scene.order + 1} (duration: ${durationSeconds.toFixed(1)}s) prompt: ${motionPrompt.slice(0, 80)}...`)
        const videoResponse = await motionProvider.generate(request)

        await prisma.sceneVideo.create({
          data: {
            sceneId: scene.id,
            provider: motionProvider.getName() as any,
            promptUsed: motionPrompt,
            fileData: Buffer.from(videoResponse.video.videoBuffer) as any,
            mimeType: 'video/mp4',
            originalSize: videoResponse.video.videoBuffer.length,
            duration: videoResponse.video.duration || 5,
            sourceImageId: startImage.id,
            isSelected: true,
            variantIndex: 0
          }
        })

        // Registrar custo do motion (fire-and-forget) — usa costInfo do provider
        costLogService.log({
          outputId,
          resource: 'motion',
          action: 'create',
          provider: videoResponse.costInfo.provider,
          model: videoResponse.costInfo.model,
          cost: videoResponse.costInfo.cost,
          metadata: videoResponse.costInfo.metadata,
          detail: `Scene ${scene.order + 1}/${scenes.length} - motion generation`
        }).catch(() => { })
      }))
    }
  }


  /**
   * Regenera motion (image-to-video) para UMA cena específica.
   * Usado no fluxo de correções pós-renderização.
   * 
   * Fluxo:
   *   1. Busca a cena e a imagem selecionada
   *   2. Desmarca vídeos anteriores
   *   3. Gera novo motion via provider
   *   4. Salva novo SceneVideo como selecionado
   */
  public async regenerateSceneMotion(sceneId: string) {
    console.log(`[OutputPipeline] 🔄 Regenerating motion for Scene ${sceneId}`)

    // 1. Buscar cena com imagem selecionada e output pai
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        images: { where: { isSelected: true } },
        audioTracks: { where: { type: 'scene_narration' } },
        output: { include: { seed: true } }
      }
    })

    if (!scene) throw new Error('Cena não encontrada')
    if (!scene.images[0]?.fileData) throw new Error('Cena não possui imagem selecionada para gerar motion')

    const output = scene.output

    // Identificar start image selecionada
    const startImage = scene.images.find(img => img.role === 'start') || scene.images[0]

    if (!startImage) throw new Error('Imagem inicial não encontrada')

    // 2. Obter provider de motion
    const motionProvider = providerManager.getMotionProvider()

    // Validar pricing
    const motionModel = (motionProvider as any).model || 'wan-video/wan-2.2-i2v-fast'
    validateReplicatePricing(motionModel)

    // 3. Desmarcar vídeos anteriores desta cena
    await prisma.sceneVideo.updateMany({
      where: { sceneId },
      data: { isSelected: false }
    })

    // Motion prompt: prefere motionDescription (focado em movimento)
    const motionPrompt = scene.motionDescription || scene.visualDescription

    const durationSeconds = scene.audioTracks[0]?.duration ?? scene.estimatedDuration ?? 5
    const request: MotionGenerationRequest = {
      imageBuffer: Buffer.from(startImage.fileData!) as any,
      prompt: motionPrompt,
      duration: durationSeconds,
      aspectRatio: output.aspectRatio || '16:9'
    }

    console.log(`[OutputPipeline] 🎬 Regenerating motion for scene ${scene.order + 1} (${sceneId}, duration: ${durationSeconds.toFixed(1)}s)`)
    const videoResponse = await motionProvider.generate(request)

    // 5. Salvar novo SceneVideo
    const newVideo = await prisma.sceneVideo.create({
      data: {
        sceneId,
        provider: motionProvider.getName() as any,
        promptUsed: motionPrompt,
        fileData: Buffer.from(videoResponse.video.videoBuffer) as any,
        mimeType: 'video/mp4',
        originalSize: videoResponse.video.videoBuffer.length,
        duration: videoResponse.video.duration || 5,
        sourceImageId: startImage.id,
        isSelected: true,
        variantIndex: 0
      }
    })

    // 6. Registrar custo (fire-and-forget) — usa costInfo do provider
    costLogService.log({
      outputId: output.id,
      resource: 'motion',
      action: 'recreate',
      provider: videoResponse.costInfo.provider,
      model: videoResponse.costInfo.model,
      cost: videoResponse.costInfo.cost,
      metadata: videoResponse.costInfo.metadata,
      detail: `Scene ${scene.order + 1} - motion regeneration (correction)`
    }).catch(() => { })

    console.log(`[OutputPipeline] ✅ Motion regenerated for Scene ${sceneId}`)

    return newVideo
  }

  /**
   * Entra em modo correção: reseta flags de aprovação (imagens e motion)
   * para permitir edição pós-renderização.
   * 
   * Mantém: script, áudio, BGM (não precisam mudar)
   * Reseta: imagesApproved, videosApproved, status → PENDING
   */
  public async enterCorrectionMode(outputId: string) {
    console.log(`[OutputPipeline] 🔧 Entering correction mode for Output ${outputId}`)

    const output = await prisma.output.findUnique({ where: { id: outputId } })
    if (!output) throw new Error('Output não encontrado')

    if (output.status !== 'COMPLETED' && output.status !== 'FAILED') {
      throw new Error('Somente outputs com status COMPLETED ou FAILED podem entrar em modo correção')
    }

    // Resetar flags visuais mantendo script, áudio e BGM
    const updated = await prisma.output.update({
      where: { id: outputId },
      data: {
        status: 'PENDING',
        imagesApproved: false,
        videosApproved: false
      }
    })

    await this.logExecution(outputId, 'correction', 'started', 'Entrou em modo correção - imagens e motion desbloqueados para edição')

    return updated
  }

  /**
   * Renderiza vídeo final usando o VideoPipelineService
   */
  private async renderVideo(outputId: string) {
    const log = createPipelineLogger({ stage: 'Pipeline', outputId })
    log.info('Iniciando renderização final (FFmpeg).')
    await this.logExecution(outputId, 'render', 'started', 'Iniciando renderização FFmpeg...')

    const result = await videoPipelineService.renderVideo(outputId)

    if (result.success) {
      log.info('Vídeo renderizado e salvo no banco.')
      await this.logExecution(outputId, 'render', 'completed', 'Vídeo renderizado e salvo no banco.')
    } else {
      log.error('Erro na renderização.', result.error)
      await this.logExecution(outputId, 'render', 'failed', `Erro: ${result.error}`)
      throw new Error(`Falha na renderização: ${result.error}`)
    }
  }

  /**
   * Atualiza status do output
   */
  private async updateStatus(outputId: string, status: any) {
    await prisma.output.update({
      where: { id: outputId },
      data: { status }
    })
  }

  /**
   * Registra log de execução
   */
  private async logExecution(outputId: string, step: string, status: string, message: string) {
    await prisma.pipelineExecution.create({
      data: {
        outputId,
        step,
        status,
        message
      }
    })
  }
}

export const outputPipelineService = new OutputPipelineService()

// ─── Helper: Ajustar duração do SFX ─────────────────────────────

/**
 * Ajusta a duração de um buffer de áudio para a duração exata desejada.
 * - Mais longo → corta
 * - Mais curto → padea com silêncio
 */
async function adjustSfxDuration(audioBuffer: Buffer, targetDurationSeconds: number): Promise<Buffer> {
  const tempDir = path.join(os.tmpdir(), 'sfx-adjust')
  await fs.mkdir(tempDir, { recursive: true })

  const id = crypto.randomUUID().slice(0, 8)
  const inputPath = path.join(tempDir, `sfx-in-${id}.mp3`)
  const outputPath = path.join(tempDir, `sfx-out-${id}.mp3`)

  try {
    await fs.writeFile(inputPath, audioBuffer)

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          `apad=whole_dur=${targetDurationSeconds}`,
        ])
        .duration(targetDurationSeconds)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    return await fs.readFile(outputPath)
  } finally {
    await fs.unlink(inputPath).catch(() => { })
    await fs.unlink(outputPath).catch(() => { })
  }
}