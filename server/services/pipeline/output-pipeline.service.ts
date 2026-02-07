/**
 * Output Pipeline Service
 * 
 * Orquestra todo o fluxo de criação de output (vídeo, thread, post, etc.)
 * a partir de um dossier.
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
import { validateReplicatePricing } from '../../constants/pricing'
import fs from 'node:fs/promises'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { videoPipelineService } from './video-pipeline.service'

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
    console.log(`[OutputPipeline] 🚀 Render Requested for ${outputId}`)
    try {
      const output = await this.loadOutputContext(outputId)

      console.log(`[OutputPipeline] 🔍 Validating Approvals: Script=${output.scriptApproved}, Images=${output.imagesApproved}, Audio=${output.audioApproved}, Motion=${output.enableMotion ? output.videosApproved : 'N/A'}`)

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
            notes: { orderBy: { order: 'asc' } }
          }
        },
        seed: true
      }
    })

    if (!output) throw new Error('Output não encontrado')

    // Resolver estilos a partir das constantes (não mais do DB)
    const scriptStyle = output.scriptStyleId ? getScriptStyleById(output.scriptStyleId) : undefined
    const visualStyle = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined

    return { ...output, scriptStyle, visualStyle }
  }

  /**
   * Gera roteiro com contexto rico do dossier
   */
  public async generateScript(outputId: string) {
    const output = await this.loadOutputContext(outputId)
    const scriptProvider = providerManager.getScriptProvider()
    const dossier = output.dossier

    // Construir prompt com TODAS as fontes
    const promptContext: ScriptGenerationRequest = {
      theme: dossier.theme,
      language: output.language || 'pt-BR',
      narrationLanguage: output.narrationLanguage || 'pt-BR',

      // DOSSIER SOURCES (RICO)
      sourceDocument: dossier.sourceText,

      // Fontes secundárias
      additionalSources: dossier.sources?.map((s: any) => ({
        title: s.title,
        content: s.content,
        type: s.sourceType
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

      // Configuração de duração e tipo
      targetDuration: output.duration || 300,
      targetWPM: output.targetWPM || 150,

      // OUTPUT TYPE ESPECÍFICO
      outputType: output.outputType,
      format: output.format,

      // Estilo de roteiro
      scriptStyleDescription: output.scriptStyle?.description,
      scriptStyleInstructions: output.scriptStyle?.instructions,

      // Estilo visual (resolvido das constantes)
      visualStyleName: output.visualStyle?.name,
      visualStyleDescription: output.visualStyle?.description,

      // Objetivo Editorial (diretriz narrativa prioritária)
      additionalContext: output.objective 
        ? `🎯 OBJETIVO EDITORIAL (CRÍTICO - GOVERNA TODA A NARRATIVA):\n${output.objective}`
        : undefined,

      // Diretrizes
      mustInclude: output.mustInclude || undefined,
      mustExclude: output.mustExclude || undefined
    }

    // Gerar roteiro
    const scriptResponse = await scriptProvider.generate(promptContext)

    // Registrar custo do script (fire-and-forget) -- usa tokens reais quando disponíveis
    costLogService.logScriptGeneration({
      outputId,
      provider: scriptResponse.provider || 'ANTHROPIC',
      model: scriptResponse.model || 'claude-opus-4-6',
      inputCharacters: JSON.stringify(promptContext).length,
      outputCharacters: scriptResponse.fullText.length,
      usage: scriptResponse.usage,
      action: 'create',
      detail: `Script generation - ${scriptResponse.wordCount} words, ${scriptResponse.scenes?.length || 0} scenes`
    }).catch(() => {})

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
          narration: scene.narration,
          visualDescription: scene.visualDescription,
          audioDescription: scene.audioDescription || null,
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
          startTime: track.startTime,
          endTime: track.endTime
        }))
      })
    }

    return script
  }

  /**
   * Gera imagens para as cenas
   */
  public async generateImages(outputId: string) {
    const output = await this.loadOutputContext(outputId)
    try {
      const imageProvider = providerManager.getImageProvider()
      console.log(`[OutputPipeline] 🖼️ Image Provider obtained: ${imageProvider.getName()}`)

      // Validar pricing antes de gastar dinheiro
      const imageModel = (imageProvider as any).model || 'black-forest-labs/flux-schnell'
      validateReplicatePricing(imageModel)

      const scenes = await prisma.scene.findMany({
        where: { outputId },
        orderBy: { order: 'asc' }
      })

      console.log(`[OutputPipeline] 🎬 Found ${scenes.length} scenes for image generation`)

      const CONCURRENCY_LIMIT = 3 // Limite para evitar rate limits agressivos
      const sceneChunks = []
      for (let i = 0; i < scenes.length; i += CONCURRENCY_LIMIT) {
        sceneChunks.push(scenes.slice(i, i + CONCURRENCY_LIMIT))
      }

      for (const chunk of sceneChunks) {
        await Promise.all(chunk.map(async (scene, chunkIndex) => {
          const absoluteIndex = scenes.indexOf(scene)
          console.log(`[OutputPipeline] 📸 Processing Scene ${absoluteIndex + 1}/${scenes.length} (ID: ${scene.id})...`)

          const isPortrait = output.aspectRatio === '9:16'
          const width = isPortrait ? 768 : 1344
          const height = isPortrait ? 1344 : 768

          // NOVO: Merge inteligente de prompts com GPT
          let enhancedPrompt = scene.visualDescription
          const vs = output.visualStyle

          if (vs) {
            try {
              // Importar serviço de merge
              const { promptMergerService } = await import('../prompt-merger.service')

              // Fazer merge inteligente
              enhancedPrompt = await promptMergerService.mergePrompt({
                sceneDescription: scene.visualDescription,
                visualStyle: {
                  baseStyle: vs.baseStyle || undefined,
                  lightingTags: vs.lightingTags || undefined,
                  atmosphereTags: vs.atmosphereTags || undefined,
                  compositionTags: vs.compositionTags || undefined,
                  tags: vs.tags || undefined
                }
              })

              console.log(`[OutputPipeline] 🎨 Prompt merged: "${enhancedPrompt.substring(0, 80)}..."`)
            } catch (error) {
              console.error('[OutputPipeline] ❌ Prompt merge failed, using fallback:', error)

              // Fallback: concatenação manual
              const tags = [
                vs.lightingTags,
                vs.atmosphereTags,
                vs.compositionTags,
                vs.tags
              ].filter(t => t && t.trim().length > 0).join(', ')

              const parts = []
              if (vs.baseStyle) parts.push(vs.baseStyle)
              parts.push(scene.visualDescription)
              if (tags) parts.push(tags)

              enhancedPrompt = parts.join(', ')
            }
          }

          const request: ImageGenerationRequest = {
            prompt: enhancedPrompt,
            width,
            height,
            aspectRatio: output.aspectRatio || '16:9',
            style: (output.visualStyle?.baseStyle as any) || 'cinematic',
            seed: output.seed?.value,
            numVariants: 1
          }

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

          // Registrar custo da imagem (fire-and-forget)
          costLogService.logReplicateImage({
            outputId,
            model: imageResponse.model || 'black-forest-labs/flux-schnell',
            numImages: imageResponse.images.length,
            action: 'create',
            detail: `Scene ${absoluteIndex + 1}/${scenes.length} - image generation${imageResponse.predictTime ? ` (${imageResponse.predictTime.toFixed(1)}s GPU)` : ''}`
          }).catch(() => {})
        }))
      }
    }

    // Atualizar status para imagens aprovadas (ou pendente de revisão se quisermos passo manual)
    // Por enquanto, vamos marcar output.imagesApproved = false (padrão) mas o processo terminou
    catch (error) {
      console.error(`[OutputPipeline] ❌ Error generating images:`, error)
      throw error // Repassar erro para o handler principal
    }
  }

  /**
   * Gera música de fundo via Stable Audio 2.5 (Replicate)
   * TikTok/Instagram: 1 música para todo o vídeo
   * YouTube Cinematic: N tracks com timestamps
   */
  public async generateBackgroundMusic(outputId: string) {
    const output = await this.loadOutputContext(outputId)
    console.log(`[OutputPipeline] 🎵 generateBackgroundMusic for Output ${outputId}`)

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
      console.log('[OutputPipeline] ⏭️ Background music already exists. Skipping.')
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
      console.log(`[OutputPipeline] 🎵 Duração real da narração: ${totalNarrationDuration.toFixed(2)}s (${narrationTracks.length} cenas)`)
    }

    // Usar duração real da narração, fallback para duração estimada do output
    const videoDuration = totalNarrationDuration > 0
      ? Math.ceil(totalNarrationDuration)
      : (output.duration || 120)

    console.log(`[OutputPipeline] 🎵 Duração da música: ${videoDuration}s (baseada na narração real)`)

    // CASO 1: Música única para todo o vídeo (TikTok/Instagram)
    if (script.backgroundMusicPrompt) {
      const duration = Math.min(190, videoDuration) // Stable Audio max: 190s

      console.log(`[OutputPipeline] 🎵 Gerando música única (video todo): ${duration}s`)
      console.log(`[OutputPipeline] 🎵 Prompt: "${script.backgroundMusicPrompt}"`)
      console.log(`[OutputPipeline] 🎵 Volume: ${script.backgroundMusicVolume}dB`)

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

      // Registrar custo da música (fire-and-forget)
      costLogService.logReplicateMusic({
        outputId,
        model: musicResponse.model || 'stability-ai/stable-audio-2.5',
        predictTime: musicResponse.predictTime,
        audioDuration: duration,
        action: 'create',
        detail: `Background music (full video) - ${duration}s audio`
      }).catch(() => {})

      console.log(`[OutputPipeline] ✅ Background music gerada! ${(musicResponse.audioBuffer.length / 1024).toFixed(0)}KB`)
    }

    // CASO 2: Múltiplas tracks com timestamps (YouTube Cinematic)
    else if (script.backgroundMusicTracks && script.backgroundMusicTracks.length > 0) {
      console.log(`[OutputPipeline] 🎵 Gerando ${script.backgroundMusicTracks.length} tracks de background music`)

      for (const track of script.backgroundMusicTracks) {
        const trackDuration = track.endTime 
          ? Math.min(190, track.endTime - track.startTime)
          : Math.min(190, videoDuration - track.startTime)

        console.log(`[OutputPipeline] 🎵 Track: ${track.startTime}s → ${track.endTime || 'Fim'} (${trackDuration}s)`)
        console.log(`[OutputPipeline] 🎵 Prompt: "${track.prompt}"`)
        console.log(`[OutputPipeline] 🎵 Volume: ${track.volume}dB`)

        const request: MusicGenerationRequest = {
          prompt: track.prompt,
          duration: Math.round(trackDuration)
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

        // Registrar custo da track (fire-and-forget)
        costLogService.logReplicateMusic({
          outputId,
          model: musicResponse.model || 'stability-ai/stable-audio-2.5',
          predictTime: musicResponse.predictTime,
          audioDuration: Math.round(trackDuration),
          action: 'create',
          detail: `BGM track ${track.startTime}s→${track.endTime || 'end'} - ${Math.round(trackDuration)}s audio`
        }).catch(() => {})

        console.log(`[OutputPipeline] ✅ Track gerada! ${(musicResponse.audioBuffer.length / 1024).toFixed(0)}KB`)
      }
    } else {
      console.log('[OutputPipeline] ⚠️ Nenhum prompt de background music encontrado no script.')
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

        const existing = await prisma.audioTrack.findFirst({
          where: { sceneId: scene.id, type: 'scene_narration' }
        })

        if (existing) {
          console.log(`[OutputPipeline] ⏭️ Scene ${scene.order + 1} already has audio.`)
          return
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

        // Registrar custo da narração (fire-and-forget)
        const ttsProviderName = ttsProvider.getName().toUpperCase()
        if (ttsProviderName === 'ELEVENLABS') {
          costLogService.logElevenLabsTTS({
            outputId,
            characterCount: scene.narration.length,
            action: 'create',
            detail: `Scene ${scene.order + 1} narration - ${scene.narration.length} chars`
          }).catch(() => {})
        } else {
          costLogService.logReplicateTTS({
            outputId,
            model: 'elevenlabs/v2-multilingual',
            elapsedSeconds: audioResponse.duration || 0,
            characterCount: scene.narration.length,
            action: 'create',
            detail: `Scene ${scene.order + 1} narration via Replicate - ${scene.narration.length} chars`
          }).catch(() => {})
        }
      }))
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
    await prisma.output.update({
      where: { id: outputId },
      data: {
        voiceId: newVoiceId,
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

    // Validar pricing antes de gastar dinheiro
    const motionModel = (motionProvider as any).model || 'wan-video/wan-2.2-i2v-fast'
    validateReplicatePricing(motionModel)
    const scenes = await prisma.scene.findMany({
      where: { outputId },
      include: {
        images: {
          where: { isSelected: true }
        }
      },
      orderBy: { order: 'asc' }
    })

    const CONCURRENCY_LIMIT = 15 // Motion em batch de 15
    const sceneChunks = []
    for (let i = 0; i < scenes.length; i += CONCURRENCY_LIMIT) {
      sceneChunks.push(scenes.slice(i, i + CONCURRENCY_LIMIT))
    }

    for (const chunk of sceneChunks) {
      await Promise.all(chunk.map(async (scene) => {
        const selectedImage = scene.images[0]
        if (!selectedImage?.fileData) return

        const request: MotionGenerationRequest = {
          imageBuffer: Buffer.from(selectedImage.fileData!) as any,
          prompt: scene.visualDescription,
          duration: 5,
          aspectRatio: output.aspectRatio || '16:9'
        }

        console.log(`[OutputPipeline] 🎞️ Generating motion for scene ${scene.order + 1}`)
        const videoResponse = await motionProvider.generate(request)

        await prisma.sceneVideo.create({
          data: {
            sceneId: scene.id,
            provider: motionProvider.getName() as any,
            promptUsed: scene.visualDescription,
            fileData: Buffer.from(videoResponse.video.videoBuffer) as any,
            mimeType: 'video/mp4',
            originalSize: videoResponse.video.videoBuffer.length,
            duration: videoResponse.video.duration || 5,
            sourceImageId: selectedImage.id,
            isSelected: true,
            variantIndex: 0
          }
        })

        // Registrar custo do motion (fire-and-forget)
        costLogService.logReplicateMotion({
          outputId,
          model: videoResponse.model || 'wan-video/wan-2.2-i2v-fast',
          predictTime: videoResponse.predictTime,
          numVideos: 1,
          action: 'create',
          detail: `Scene ${scene.order + 1}/${scenes.length} - motion generation`
        }).catch(() => {})
      }))
    }
  }

  /**
   * Renderiza vídeo final usando o VideoPipelineService
   */
  private async renderVideo(outputId: string) {
    console.log(`[OutputPipeline] 🎬 Iniciando renderização final para ${outputId}...`)
    await this.logExecution(outputId, 'render', 'started', 'Iniciando renderização FFmpeg...')

    const result = await videoPipelineService.renderVideo(outputId)

    if (result.success) {
      console.log(`[OutputPipeline] ✅ Vídeo renderizado e salvo no banco com sucesso.`)
      await this.logExecution(outputId, 'render', 'completed', 'Vídeo renderizado e salvo no banco.')
    } else {
      console.error(`[OutputPipeline] ❌ Erro na renderização: ${result.error}`)
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

