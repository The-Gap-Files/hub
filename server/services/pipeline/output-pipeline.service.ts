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
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { videoPipelineService } from './video-pipeline.service'
import { createPipelineLogger } from '../../utils/pipeline-logger'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

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
        motion: output.enableMotion ? output.videosApproved : 'N/A'
      })

      // Validate Approvals
      if (!output.scriptApproved) throw new Error("Aprovação pendente: Roteiro")
      if (!output.imagesApproved) throw new Error("Aprovação pendente: Imagens (Visual)")
      if (!output.audioApproved) throw new Error("Aprovação pendente: Áudio (Narração)")
      if (output.enableMotion && !output.videosApproved) throw new Error("Aprovação pendente: Motion (Vídeos)")

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
    const scriptProvider = await providerManager.getScriptProvider()
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

      // Configuração de duração e tipo
      targetDuration: output.duration || 300,
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
    if (promptContext.narrativeRole && outlineData._monetizationMeta?.itemType === 'teaser') {
      for (let attempt = 0; attempt <= MAX_SCRIPT_RETRIES; attempt++) {
        try {
          scriptValidation = await validateScript(
            scriptResponse.scenes || [],
            {
              itemType: 'teaser',
              narrativeRole: promptContext.narrativeRole,
              angleCategory: outlineData._monetizationMeta?.angleCategory,
              shortFormatType: promptContext.shortFormatType,
              targetDuration: output.duration || undefined,
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
            // Injetar feedback de validação no contexto e regenerar
            const validationFeedback = [
              `⚠️ CORREÇÃO OBRIGATÓRIA (VALIDADOR REPROVOU O ROTEIRO ANTERIOR):`,
              ...(scriptValidation.violations || []).map(v => `- VIOLAÇÃO: ${v}`),
              scriptValidation.corrections ? `\nINSTRUÇÕES DE CORREÇÃO: ${scriptValidation.corrections}` : '',
              scriptValidation.overResolution ? `\n🚨 O roteiro RESOLVE DEMAIS para a role "${promptContext.narrativeRole}". Reduza explicações, remova conclusões e deixe loops abertos.` : ''
            ].filter(Boolean).join('\n')

            const retryContext = {
              ...promptContext,
              additionalContext: [promptContext.additionalContext || '', validationFeedback].filter(Boolean).join('\n\n')
            }

            scriptLog.info(`🔄 Regenerando script com feedback do validador...`)
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
      // 🎨 VISUAL CONTINUITY ENGINE
      // Injeta [VISUAL STYLE ANCHOR] e [VISUAL CONTINUITY] nos prompts
      // baseado no sceneEnvironment de cada cena.
      //
      // Mesmo ambiente (sceneEnvironment igual ao anterior) →
      //   Anchor + Continuity (objetos e atmosfera da cena anterior persistem)
      // Novo ambiente (sceneEnvironment diferente ou primeira cena) →
      //   Só Anchor (transição limpa, sem contaminação)
      // =====================================================================

      // Montar Style Anchor a partir dos campos de estilo visual
      const vs = output.visualStyle
      let styleAnchorParts: string[] = []
      if (vs) {
        if (vs.baseStyle) styleAnchorParts.push(vs.baseStyle)
        if (vs.lightingTags) styleAnchorParts.push(vs.lightingTags)
        if (vs.atmosphereTags) styleAnchorParts.push(vs.atmosphereTags)
        if (vs.compositionTags) styleAnchorParts.push(vs.compositionTags)
        if (vs.tags) styleAnchorParts.push(vs.tags)
      }
      const styleAnchor = styleAnchorParts.length > 0
        ? `[VISUAL STYLE ANCHOR — ${styleAnchorParts.join(', ')}]`
        : ''

      if (styleAnchor) {
        log.info(`🎨 Style Anchor: ${styleAnchor.slice(0, 100)}...`)
      }

      // Montar Visual Identity do dossiê (diretrizes específicas do universo)
      const visualIdentity = output.dossier?.visualIdentityContext
        ? `[VISUAL IDENTITY — ${output.dossier.visualIdentityContext}]`
        : ''

      if (visualIdentity) {
        log.info(`🆔 Visual Identity: ${visualIdentity.slice(0, 100)}...`)
      }

      for (const chunk of sceneChunks) {
        const results = await Promise.allSettled(chunk.map(async (scene, chunkIndex) => {
          const absoluteIndex = scenes.indexOf(scene)
          log.step(`Cena ${absoluteIndex + 1}/${scenes.length}`, `sceneId=${scene.id}`)

          const isPortrait = output.aspectRatio === '9:16'
          const width = isPortrait ? 768 : 1344
          const height = isPortrait ? 1344 : 768

          // Montar prompt visual com Style Anchor + Visual Identity + Visual Continuity
          let visualPrompt = scene.visualDescription

          // Determinar se é mesmo ambiente da cena anterior
          const prevScene = absoluteIndex > 0 ? scenes[absoluteIndex - 1] : null
          const isSameEnvironment = prevScene
            && scene.sceneEnvironment
            && prevScene.sceneEnvironment
            && scene.sceneEnvironment === prevScene.sceneEnvironment

          // Montar prefixo: Anchor → Identity → Continuity (se aplicável)
          const prefixParts: string[] = []
          if (styleAnchor) prefixParts.push(styleAnchor)
          if (visualIdentity) prefixParts.push(visualIdentity)

          if (isSameEnvironment && prevScene) {
            // Mesmo ambiente → Anchor + Identity + Continuity
            const continuityContext = prevScene.visualDescription.slice(0, 300)
            prefixParts.push(`[VISUAL CONTINUITY — same environment "${scene.sceneEnvironment}": ${continuityContext}]`)
            log.step(`Cena ${absoluteIndex + 1}`, `🔗 Continuity + Anchor + Identity (env: ${scene.sceneEnvironment})`)
          } else if (prefixParts.length > 0) {
            log.step(`Cena ${absoluteIndex + 1}`, `🎨 Anchor + Identity${scene.sceneEnvironment ? ` (new env: ${scene.sceneEnvironment})` : ''}`)
          }

          if (prefixParts.length > 0) {
            visualPrompt = `${prefixParts.join('\n')}\n\n${visualPrompt}`
          }

          const request: ImageGenerationRequest = {
            prompt: visualPrompt,
            width,
            height,
            aspectRatio: output.aspectRatio || '16:9',
            seed: output.seed?.value,
            numVariants: 1
          }

          log.step(`Cena ${absoluteIndex + 1}/${scenes.length}`, `prompt: ${request.prompt.slice(0, 120)}...`)

          const imageResponse = await imageProvider.generate(request)
          const firstImage = imageResponse.images[0]
          if (!firstImage) return

          await prisma.sceneImage.create({
            data: {
              sceneId: scene.id,
              provider: imageProvider.getName() as any,
              promptUsed: scene.visualDescription,
              fileData: Buffer.from(firstImage.buffer) as any,
              mimeType: 'image/png',
              originalSize: firstImage.buffer.length,
              width: firstImage.width,
              height: firstImage.height,
              isSelected: true,
              variantIndex: 0
            }
          })

          // Registrar custo da imagem (fire-and-forget) — usa costInfo do provider
          costLogService.log({
            outputId,
            resource: 'image',
            action: 'create',
            provider: imageResponse.costInfo.provider,
            model: imageResponse.costInfo.model,
            cost: imageResponse.costInfo.cost,
            metadata: imageResponse.costInfo.metadata,
            detail: `Scene ${absoluteIndex + 1}/${scenes.length} - image generation${imageResponse.predictTime ? ` (${imageResponse.predictTime.toFixed(1)}s GPU)` : ''}`
          }).catch(() => { })
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

        const targetWPM = output.targetWPM || 150 // Padrão 150 WPM (Conversa normal)

        // Calcular velocidade baseada no WPM desejado
        // 150 WPM = 1.0x (Normal)
        // 180 WPM = 1.2x (Rápido)
        // 120 WPM = 0.8x (Lento)
        const calculatedSpeed = targetWPM / 150

        // Garantir limites da API do ElevenLabs (0.7 a 1.2 oficial)
        const safeSpeed = Math.max(0.7, Math.min(1.2, calculatedSpeed))

        const wordCount = scene.narration.split(/\s+/).length
        const estimatedAudioDuration = (wordCount / targetWPM) * 60

        console.log(`[OutputPipeline] 🗣️ Generating audio for scene ${scene.order + 1}. WPM: ${targetWPM}, Speed: ${safeSpeed.toFixed(2)}x, Est. Duration: ${estimatedAudioDuration.toFixed(2)}s`)

        // Validação: Voice ID é obrigatório
        if (!output.voiceId) {
          throw new Error('[OutputPipeline] ❌ Voice ID is required. Please select a voice before generating output.')
        }

        const request: TTSRequest = {
          text: scene.narration,
          voiceId: output.voiceId,
          language: output.narrationLanguage || 'pt-BR',
          speed: safeSpeed
        }

        const audioResponse = await ttsProvider.synthesize(request)

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
            duration: audioResponse.duration,
            // Word-level timestamps do ElevenLabs /with-timestamps
            alignment: audioResponse.wordTimings ? audioResponse.wordTimings as any : undefined
          }
        })

        // Registrar custo da narração (fire-and-forget) — usa costInfo do provider
        costLogService.log({
          outputId,
          resource: 'narration',
          action: 'create',
          provider: audioResponse.costInfo.provider,
          model: audioResponse.costInfo.model,
          cost: audioResponse.costInfo.cost,
          metadata: audioResponse.costInfo.metadata,
          detail: `Scene ${scene.order + 1} narration - ${scene.narration.length} chars`
        }).catch(() => { })
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
        const selectedImage = scene.images[0]
        if (!selectedImage?.fileData) return

        // Motion prompt: prefere motionDescription (focado em movimento)
        // Fallback: visualDescription (backward-compatible com roteiros antigos)
        const motionPrompt = scene.motionDescription || scene.visualDescription

        const durationSeconds = scene.audioTracks[0]?.duration ?? scene.estimatedDuration ?? 5
        const request: MotionGenerationRequest = {
          imageBuffer: Buffer.from(selectedImage.fileData!) as any,
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
            sourceImageId: selectedImage.id,
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
    const selectedImage = scene.images[0]

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
      imageBuffer: Buffer.from(selectedImage.fileData!) as any,
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
        sourceImageId: selectedImage.id,
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

