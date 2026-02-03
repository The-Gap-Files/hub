/**
 * Video Pipeline Service
 * 
 * Orquestra todo o fluxo de criação de vídeo:
 * 1. Geração de roteiro
 * 2. Síntese de áudio (TTS)
 * 3. Geração de imagens
 * 4. Renderização do vídeo final
 */

import type {
  ScriptGenerationRequest,
  TTSRequest,
  ImageGenerationRequest,
  MotionGenerationRequest
} from '../../types/ai-providers'
import { prisma } from '../../utils/prisma'
import { providerManager } from '../providers'
import fs from 'node:fs/promises'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

// Configurar o caminho do executável do ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

// Tentar configurar o ffprobe se o pacote estiver disponível
try {
  const ffprobeInstaller = require('@ffprobe-installer/ffprobe')
  let ffprobePath = ffprobeInstaller.path.replace('app.asar', 'app.asar.unpacked')

  // No Windows, garantir que o caminho use barras invertidas se necessário ou vice-versa
  if (process.platform === 'win32' && !ffprobePath.endsWith('.exe')) {
    ffprobePath += '.exe'
  }

  ffmpeg.setFfprobePath(ffprobePath)
  console.log('[TheGapFiles] FFprobe path set:', ffprobePath)
} catch (e) {
  console.warn('[TheGapFiles] ffprobe-installer not found or could not be required')
}

export interface PipelineOptions {
  theme: string
  language?: string
  targetDuration?: number
  style?: string // Agora aceita ID do estilo de roteiro do banco
  voiceId?: string
  imageStyle?: 'cinematic' | 'photorealistic' | 'artistic' | 'documentary'
  visualStyle?: string
  aspectRatio?: '9:16' | '16:9'
  enableMotion?: boolean
  additionalContext?: string
  mustInclude?: string
  mustExclude?: string
}

export interface PipelineResult {
  videoId: string
  status: 'completed' | 'failed'
  outputPath?: string
  message?: string
  error?: string
}

export class VideoPipelineService {
  /**
   * Executa o pipeline completo de criação de vídeo
   */
  async execute(options: PipelineOptions, existingVideoId?: string): Promise<PipelineResult> {
    let videoId = existingVideoId
    let effectiveOptions = { ...options }

    // 1. Criar registro do vídeo se não existir ou carregar se existir
    if (!videoId) {
      const video = await prisma.video.create({
        data: {
          title: `Video: ${options.theme.substring(0, 50)}...`,
          theme: options.theme,
          language: options.language ?? 'pt-BR',
          style: options.style ?? 'documentary',
          duration: options.targetDuration ?? 300,
          voiceId: options.voiceId,
          imageStyle: options.imageStyle ?? 'cinematic',
          visualStyle: options.visualStyle ?? 'epictok',
          aspectRatio: options.aspectRatio ?? '16:9',
          enableMotion: options.enableMotion ?? false,
          status: 'PENDING'
        }
      })
      videoId = video.id
    } else {
      const video = await prisma.video.findUnique({ where: { id: videoId } })
      if (video) {
        // Mesclar opções do banco com as passadas (priorizando banco para o que já foi configurado)
        effectiveOptions = {
          ...options, // Valores padrão ou passados no execute
          theme: video.theme,
          language: video.language,
          targetDuration: video.duration ?? 300,
          style: video.style as any,
          voiceId: video.voiceId ?? undefined,
          imageStyle: video.imageStyle as any,
          visualStyle: video.visualStyle ?? undefined,
          aspectRatio: video.aspectRatio as any,
          enableMotion: video.enableMotion
        }
      }
      await this.logExecution(videoId, 'pipeline', 'started', 'Retomando processamento do vídeo...')
    }

    // Carregar o registro do vídeo para garantir que está no escopo e atualizado
    const video = await prisma.video.findUnique({ where: { id: videoId! } })
    if (!video) throw new Error('Vídeo não encontrado')

    try {
      // 2. Gerar roteiro (se não existir)
      const existingScript = await prisma.script.findUnique({ where: { videoId: videoId! } })
      let script: any = existingScript
      if (!existingScript) {
        await this.updateStatus(videoId!, 'SCRIPT_GENERATING')
        await this.logExecution(videoId!, 'script', 'started', 'Iniciando geração do roteiro...')
        script = await this.generateScript(videoId!, effectiveOptions)
        await this.updateStatus(videoId!, 'SCRIPT_READY')
        await this.logExecution(videoId!, 'script', 'completed', 'Roteiro gerado com sucesso.')
      }

      // 3. Aguardar aprovação do roteiro
      if (!video?.scriptApproved) {
        return {
          videoId: videoId!,
          status: 'completed',
          message: 'Roteiro pronto para revisão. Aprove para prosseguir com Imagens, Áudio e Motion.'
        }
      }

      // 4. Gerar imagens (se não aprovado e se não existirem cenas com imagens)
      const scenesWithImages = await prisma.scene.findMany({
        where: { videoId: videoId! },
        include: { images: true }
      })
      const hasImages = scenesWithImages.some(s => s.images.length > 0)

      if (!video?.imagesApproved && !hasImages) {
        await this.updateStatus(videoId!, 'IMAGES_GENERATING')
        await this.logExecution(videoId!, 'images', 'started', 'Iniciando geração das imagens para as cenas...')
        await this.generateImages(videoId!, effectiveOptions)
        await this.updateStatus(videoId!, 'IMAGES_READY')
        await this.logExecution(videoId!, 'images', 'completed', 'Imagens iniciais geradas. Aguardando aprovação.')
      }

      // Se não estiver aprovado, para aqui e avisa
      if (!video?.imagesApproved) {
        return {
          videoId: videoId!,
          status: 'completed',
          message: 'Aguardando aprovação das imagens para continuar com Áudio e Motion.'
        }
      }

      // 4. Gerar áudio
      await this.updateStatus(videoId!, 'AUDIO_GENERATING')
      await this.logExecution(videoId!, 'audio', 'started', 'Iniciando síntese de voz...')
      await this.generateAudio(videoId!, script!.fullText, effectiveOptions)
      await this.updateStatus(videoId!, 'AUDIO_READY')
      await this.logExecution(videoId!, 'audio', 'completed', 'Narração de áudio concluída.')

      // 5. Gerar movimento (Opcional)
      if (effectiveOptions.enableMotion) {
        // Verificar se já existem vídeos
        const scenesWithVideos = await prisma.scene.findMany({
          where: { videoId: videoId! },
          include: { videos: true }
        })
        const hasVideos = scenesWithVideos.some(s => s.videos.length > 0)

        if (!video?.videosApproved && !hasVideos) {
          await this.updateStatus(videoId!, 'MOTION_GENERATING')
          await this.logExecution(videoId!, 'motion', 'started', 'Iniciando animação das imagens (motion)...')
          await this.generateMotion(videoId!, effectiveOptions)
          await this.updateStatus(videoId!, 'MOTION_READY')
          await this.logExecution(videoId!, 'motion', 'completed', 'Vídeos de movimento gerados. Aguardando aprovação.')
        }

        // Se o motion estiver ativado mas não aprovado, para aqui
        if (!video?.videosApproved) {
          return {
            videoId: videoId!,
            status: 'completed',
            message: 'Aguardando aprovação dos vídeos para continuar com a renderização final.'
          }
        }
      }

      // 6. Renderizar vídeo
      await this.updateStatus(videoId!, 'RENDERING')
      await this.logExecution(videoId!, 'render', 'started', 'Iniciando montagem e renderização final do vídeo...')
      const outputPath = await this.renderVideo(videoId!)

      // 7. Finalizar
      await prisma.video.update({
        where: { id: videoId! },
        data: {
          status: 'COMPLETED',
          outputPath,
          completedAt: new Date()
        }
      })

      return {
        videoId: videoId,
        status: 'completed',
        outputPath
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'FAILED',
          errorMessage
        }
      })

      await this.logExecution(videoId, 'pipeline', 'failed', errorMessage)

      return {
        videoId: videoId,
        status: 'failed',
        error: errorMessage
      }
    }
  }

  /**
   * Re-executa apenas a etapa de renderização de um vídeo existente
   */
  async reprocessRender(videoId: string): Promise<PipelineResult> {
    try {
      await this.updateStatus(videoId, 'RENDERING')
      const outputPath = await this.renderVideo(videoId)

      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'COMPLETED',
          outputPath,
          completedAt: new Date()
        }
      })

      return {
        videoId,
        status: 'completed',
        outputPath
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.updateStatus(videoId, 'FAILED')
      await this.logExecution(videoId, 'render', 'failed', errorMessage)

      return {
        videoId,
        status: 'failed',
        error: errorMessage
      }
    }
  }

  /**
   * Gera o roteiro segmentado em cenas
   */
  private async generateScript(videoId: string, options: PipelineOptions) {
    const startTime = Date.now()

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { theme: true, language: true, duration: true, style: true, visualStyle: true, mustInclude: true, mustExclude: true }
    })

    // Buscar descrição do estilo visual do banco
    const selectedVisualStyle = options.visualStyle || video?.visualStyle
    let visualStyleDescription: string | undefined
    if (selectedVisualStyle) {
      const styleFromDb = await prisma.visualStyle.findFirst({
        where: {
          id: selectedVisualStyle,
          isActive: true
        },
        select: { description: true }
      })
      visualStyleDescription = styleFromDb?.description
    }

    // Buscar instruções do estilo de roteiro do banco
    const selectedScriptStyle = options.style || video?.style
    let scriptStyleInstructions: string | undefined
    if (selectedScriptStyle) {
      const scriptStyleFromDb = await prisma.scriptStyle.findFirst({
        where: {
          id: selectedScriptStyle,
          isActive: true
        },
        select: { instructions: true }
      })
      scriptStyleInstructions = scriptStyleFromDb?.instructions
    }

    const request: ScriptGenerationRequest = {
      theme: options.theme || video?.theme || '',
      language: options.language || video?.language || 'pt-BR',
      targetDuration: options.targetDuration || video?.duration || 300,
      style: selectedScriptStyle || 'documentary',
      scriptStyleInstructions: scriptStyleInstructions,
      visualStyle: selectedVisualStyle || undefined,
      visualStyleDescription: visualStyleDescription,
      mustInclude: options.mustInclude || video?.mustInclude || undefined,
      mustExclude: options.mustExclude || video?.mustExclude || undefined
    }

    const scriptProvider = providerManager.getScriptProvider()
    const result = await scriptProvider.generate(request)

    // Salvar roteiro
    await prisma.script.create({
      data: {
        videoId,
        fullText: result.fullText,
        wordCount: result.wordCount,
        provider: result.provider.toUpperCase() as 'OPENAI' | 'ANTHROPIC' | 'GEMINI',
        modelUsed: result.model,
        promptUsed: JSON.stringify(request)
      }
    })

    // Salvar cenas
    for (const scene of result.scenes) {
      await prisma.scene.create({
        data: {
          videoId,
          order: scene.order,
          narration: scene.narration,
          visualDescription: scene.visualDescription
        }
      })
    }

    // Atualizar título do vídeo
    await prisma.video.update({
      where: { id: videoId },
      data: { title: result.title }
    })

    await this.logExecution(
      videoId,
      'script',
      'completed',
      `Generated ${result.scenes.length} scenes, ${result.wordCount} words`,
      Date.now() - startTime
    )

    return result
  }

  /**
   * Refina o roteiro com base no feedback do usuário
   */
  async refineScript(videoId: string, feedback: string) {
    const startTime = Date.now()

    await this.updateStatus(videoId, 'SCRIPT_GENERATING')
    await this.logExecution(videoId, 'script', 'started', `Refinando roteiro com feedback: ${feedback.substring(0, 50)}...`)

    // 1. Limpar cenas e roteiro antigos
    await prisma.scene.deleteMany({ where: { videoId } })
    await prisma.script.deleteMany({ where: { videoId } })

    // 2. Gerar novo roteiro com o feedback como contexto adicional
    const options = await prisma.video.findUnique({ where: { id: videoId } })
    if (!options) throw new Error('Vídeo não encontrado')

    const pipelineOptions: PipelineOptions = {
      theme: options.theme,
      language: options.language,
      targetDuration: options.duration || 300,
      style: options.style as any,
      visualStyle: options.visualStyle || undefined,
      additionalContext: feedback // Injetar feedback aqui
    }

    await this.generateScript(videoId, pipelineOptions)

    await this.updateStatus(videoId, 'SCRIPT_READY')
    await this.logExecution(videoId, 'script', 'completed', 'Roteiro refinado com sucesso.', Date.now() - startTime)
  }

  /**
   * Aprova o roteiro e continua o pipeline
   */
  async approveScript(videoId: string) {
    await prisma.video.update({
      where: { id: videoId },
      data: { scriptApproved: true }
    })

    await this.logExecution(videoId, 'script', 'completed', 'Roteiro aprovado pelo usuário.')

    // Continuar o pipeline
    const video = await prisma.video.findUnique({ where: { id: videoId } })
    if (video) {
      this.execute({
        theme: video.theme,
        enableMotion: video.enableMotion
      }, videoId)
    }
  }

  /**
   * Converte o roteiro em áudio narrado (processando cena por cena para maior precisão)
   */
  private async generateAudio(
    videoId: string,
    text: string,
    options: PipelineOptions
  ) {
    const startTime = Date.now()

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { language: true, voiceId: true }
    })

    const scenes = await prisma.scene.findMany({
      where: { videoId },
      orderBy: { order: 'asc' }
    })

    const ttsProvider = providerManager.getTTSProvider()
    const config = useRuntimeConfig()

    // Prioridade: Options > Banco > Runtime Config > Fallback fixo
    const selectedVoiceId = options.voiceId ||
      video?.voiceId ||
      config.providers?.tts?.voiceId ||
      'pNInz6obpgDQGcFmaJgB'

    const audioBuffers: Buffer[] = []
    let currentTime = 0

    // Pasta para áudios individuais (opcional, para cache ou debug)
    const audioDir = path.resolve('storage', 'audio', videoId)
    const scenesAudioDir = path.join(audioDir, 'scenes')
    await fs.mkdir(scenesAudioDir, { recursive: true })

    for (const [index, scene] of scenes.entries()) {
      await this.logExecution(videoId, 'audio', 'started', `Sintetizando áudio para a cena ${index + 1} de ${scenes.length}...`)

      const request: TTSRequest = {
        text: scene.narration,
        voiceId: selectedVoiceId,
        language: options.language || video?.language || 'pt-BR'
      }

      const result = await ttsProvider.synthesize(request)

      // Salvar áudio da cena temporariamente para pegar duração real
      const sceneAudioPath = path.join(scenesAudioDir, `scene_${scene.order}.mp3`)
      await fs.writeFile(sceneAudioPath, result.audioBuffer)

      // Pegar duração real (ou usar a estimativa se o ffprobe falhar)
      const preciseDuration = await this.getAudioDuration(sceneAudioPath)
      const duration = preciseDuration > 0 ? preciseDuration : result.duration

      // Atualizar cena com tempos exatos para sincronização
      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          startTime: currentTime,
          endTime: currentTime + duration
        }
      })

      audioBuffers.push(result.audioBuffer)
      currentTime += duration
    }

    // Concatenar todos os áudios em um único arquivo de narração usando FFmpeg (mais robusto que concatenar buffers)
    const finalAudioPath = path.join(audioDir, 'narration.mp3')
    await this.concatenateAudioFiles(
      scenes.map(s => path.join(scenesAudioDir, `scene_${s.order}.mp3`)),
      finalAudioPath
    )

    // Pegar a duração real do arquivo final para o banco
    const realTotalDuration = await this.getAudioDuration(finalAudioPath)
    const totalDuration = realTotalDuration > 0 ? realTotalDuration : currentTime

    // Registrar trilha principal no banco
    await prisma.audioTrack.create({
      data: {
        videoId,
        type: 'narration',
        provider: ttsProvider.getName().toUpperCase() as 'ELEVENLABS',
        voiceId: selectedVoiceId,
        filePath: finalAudioPath,
        fileSize: (await fs.stat(finalAudioPath)).size,
        duration: totalDuration
      }
    })

    await this.logExecution(
      videoId,
      'audio',
      'completed',
      `Generated ${totalDuration.toFixed(2)}s of narrated audio across ${scenes.length} scenes.`,
      Date.now() - startTime
    )

    return { audioBuffer: await fs.readFile(finalAudioPath), duration: totalDuration }
  }

  /**
   * Concatena múltiplos arquivos de áudio usando FFmpeg
   */
  private async concatenateAudioFiles(filePaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg()
      filePaths.forEach(path => command.input(path))

      command
        .on('error', reject)
        .on('end', () => resolve())
        .mergeToFile(outputPath, path.dirname(outputPath))
    })
  }

  /**
   * Obtém a duração real de um arquivo de áudio usando ffprobe
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error(`[FFprobe] Error reading duration for ${filePath}:`, err.message)
          // Fallback: estimativa baseada no tamanho do arquivo (MP3 ~128kbps = 16KB/s)
          // Ou retornar 0 e deixar o chamador lidar
          return resolve(0)
        }
        resolve(metadata.format.duration || 0)
      })
    })
  }

  /**
   * Gera imagens para cada cena do vídeo
   */
  private async generateImages(videoId: string, options: PipelineOptions) {
    const startTime = Date.now()

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { visualStyle: true, aspectRatio: true, imageStyle: true }
    })

    const scenes = await prisma.scene.findMany({
      where: { videoId },
      orderBy: { order: 'asc' }
    })

    const imageProvider = providerManager.getImageProvider()

    // Prioritizar opções, mas cair para o banco se necessário
    const selectedVisualStyle = options.visualStyle || video?.visualStyle
    const selectedAspectRatio = options.aspectRatio || (video?.aspectRatio as '9:16' | '16:9') || '16:9'
    const selectedImageStyle = options.imageStyle || (video?.imageStyle as any) || 'cinematic'

    // Obter as tags do estilo visual selecionado do banco de dados
    let visualStyleTags = ''
    if (selectedVisualStyle) {
      const styleFromDb = await prisma.visualStyle.findFirst({
        where: {
          id: selectedVisualStyle,
          isActive: true
        },
        select: { tags: true }
      })
      visualStyleTags = styleFromDb?.tags || ''
    }

    // Definir dimensões baseadas no aspect ratio
    const isPortrait = selectedAspectRatio === '9:16'

    // Para SDXL no Replicate, é melhor usar os nomes de aspect ratio se possível, 
    // ou garantir que as dimensões batam com o que o modelo espera.
    // Se aspect_ratio for passado, alguns modelos ignoram width/height.
    const width = isPortrait ? 768 : 1344
    const height = isPortrait ? 1344 : 768

    for (const [i, scene] of scenes.entries()) {
      await this.logExecution(videoId, 'images', 'started', `Gerando imagem para a cena ${i + 1} de ${scenes.length}...`)

      // Combinar a descrição da cena com as tags de estilo
      const fullPrompt = visualStyleTags
        ? `${scene.visualDescription}. Style: ${visualStyleTags}`
        : scene.visualDescription

      const request: ImageGenerationRequest = {
        prompt: fullPrompt,
        width,
        height,
        aspectRatio: selectedAspectRatio,
        style: selectedImageStyle,
        numVariants: 1
      }

      const result = await imageProvider.generate(request)

      // Salvar cada imagem gerada
      for (let j = 0; j < result.images.length; j++) {
        const image = result.images[j]
        if (!image) continue

        const outputDir = path.resolve('storage', 'images', videoId)
        await fs.mkdir(outputDir, { recursive: true })

        const fileName = `scene_${scene.order}_v${j}.png`
        const imagePath = path.join(outputDir, fileName)

        // Salvar no disco
        await fs.writeFile(imagePath, image.buffer)

        await prisma.sceneImage.create({
          data: {
            sceneId: scene.id,
            provider: result.provider.toUpperCase() as 'REPLICATE' | 'STABLE_DIFFUSION',
            promptUsed: image.revisedPrompt ?? fullPrompt,
            filePath: imagePath,
            fileSize: image.buffer.length,
            width: image.width,
            height: image.height,
            isSelected: j === 0,
            variantIndex: j
          }
        })
      }
      await this.logExecution(videoId, 'images', 'completed', `Imagem gerada para a cena ${i + 1}.`)
    }

    await this.logExecution(
      videoId,
      'images',
      'completed',
      `Generated images for ${scenes.length} scenes`,
      Date.now() - startTime
    )
  }

  /**
   * Gera clips de vídeo (motion) para as imagens das cenas
   */
  private async generateMotion(videoId: string, options: PipelineOptions) {
    const startTime = Date.now()

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { aspectRatio: true, visualStyle: true }
    })

    const scenes = await prisma.scene.findMany({
      where: { videoId },
      include: {
        images: { where: { isSelected: true } }
      },
      orderBy: { order: 'asc' }
    })

    const motionProvider = providerManager.getMotionProvider()
    const selectedVisualStyle = options.visualStyle || video?.visualStyle

    // Buscar tags do banco de dados
    let styleTags = ''
    if (selectedVisualStyle) {
      const styleFromDb = await prisma.visualStyle.findFirst({
        where: {
          id: selectedVisualStyle,
          isActive: true
        },
        select: { tags: true }
      })
      styleTags = styleFromDb?.tags || ''
    }

    const selectedAspectRatio = options.aspectRatio || (video?.aspectRatio as '9:16' | '16:9') || '16:9'

    // Limitar concorrência para evitar rate limits em vídeos longos
    const BATCH_SIZE = 5
    const sceneEntries = Array.from(scenes.entries())

    for (let i = 0; i < sceneEntries.length; i += BATCH_SIZE) {
      const batch = sceneEntries.slice(i, i + BATCH_SIZE)

      const motionPromises = batch.map(async ([index, scene]) => {
        const sourceImage = scene.images[0]
        if (!sourceImage) return

        await this.logExecution(videoId, 'motion', 'started', `Gerando movimento para a cena ${index + 1} de ${scenes.length}...`)

        // Para Image-to-Video, o prompt deve focar no conteúdo da cena.
        const motionPrompt = scene.visualDescription

        // Usar a duração real do áudio da cena se disponível, senão padrão de 5s
        const realDuration = (scene.endTime && scene.startTime !== null)
          ? Math.ceil(scene.endTime - scene.startTime)
          : 5

        const request: MotionGenerationRequest = {
          imagePath: sourceImage.filePath,
          prompt: motionPrompt,
          duration: realDuration,
          aspectRatio: selectedAspectRatio
        }

        try {
          const result = await motionProvider.generate(request)
          const videoBuffer = result.video.videoBuffer

          const outputDir = path.resolve('storage', 'images', videoId)
          const fileName = `scene_${scene.order}_motion.mp4`
          const videoPath = path.join(outputDir, fileName)

          // Salvar no disco
          await fs.writeFile(videoPath, videoBuffer)

          // Salvar no banco
          await prisma.sceneVideo.create({
            data: {
              sceneId: scene.id,
              provider: result.provider.toUpperCase() as 'REPLICATE',
              filePath: videoPath,
              fileSize: videoBuffer.length,
              duration: result.video.duration,
              sourceImageId: sourceImage.id,
              isSelected: true
            }
          })

          await this.logExecution(videoId, 'motion', 'completed', `Movimento gerado para a cena ${index + 1}.`)

        } catch (e: any) {
          console.error(`Failed to generate motion for scene ${scene.order}:`, e.message)
          await this.logExecution(videoId, 'motion', 'failed', `Scene ${scene.order}: ${e.message}`)
        }
      })

      // Aguardar o lote atual antes de iniciar o próximo
      await Promise.all(motionPromises)
    }

    await this.logExecution(
      videoId,
      'motion',
      'completed',
      `Motion generation phase finished`,
      Date.now() - startTime
    )
  }

  /**
   * Renderiza o vídeo final usando FFmpeg
   */
  private async renderVideo(videoId: string): Promise<string> {
    const startTime = Date.now()

    const outputDir = path.resolve('storage', 'output', videoId)
    await fs.mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, 'final.mp4')

    // 1. Buscar dados necessários
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        scenes: {
          include: {
            images: { where: { isSelected: true } },
            videos: { where: { isSelected: true } }
          },
          orderBy: { order: 'asc' }
        },
        audioTracks: {
          where: { type: 'narration' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!video || !video.audioTracks[0]) {
      throw new Error('Video data or audio track not found for rendering')
    }

    const audioTrack = video.audioTracks[0]
    const audioPath = audioTrack.filePath
    const totalAudioDuration = audioTrack.duration || 0

    // 2. Preparar cenas e tempos
    const scenes = video.scenes.filter(s => s.images.length > 0)
    if (scenes.length === 0) {
      throw new Error('No images found to render video')
    }

    const firstScene = scenes[0]!
    const firstImage = firstScene.images[0]
    if (!firstImage) {
      throw new Error('First scene has no selected image')
    }

    // Detectar formato baseado na primeira imagem, com fallback para o banco
    const isPortrait = (firstImage.width && firstImage.height)
      ? firstImage.width < firstImage.height
      : video.aspectRatio === '9:16'

    return new Promise((resolve, reject) => {
      const command = ffmpeg()

      // 1. Adicionar cada asset como um input com loop/stream e duração real baseada no áudio
      scenes.forEach((scene, index) => {
        const videoClip = scene.videos[0]
        const image = scene.images[0]

        // Calcular duração real da cena baseada nos tempos do áudio salvos anteriormente
        let duration = (scene.endTime && scene.startTime !== null)
          ? (scene.endTime - scene.startTime)
          : (totalAudioDuration / scenes.length) // fallback para divisão igual

        // Se for a última cena, adicionar um pequeno buffer (0.5s) para garantir que o áudio não corte
        if (index === scenes.length - 1) {
          duration += 0.5
        }

        if (videoClip) {
          command.input(videoClip.filePath)
            .inputOptions(['-stream_loop -1', `-t ${duration}`])
        } else if (image) {
          command.input(image.filePath)
            .inputOptions(['-loop 1', `-t ${duration}`])
        }
      })

      // 2. Adicionar o áudio como último input (sem loop)
      command.input(audioPath)

      command
        .complexFilter([
          // 1. Escalar imagens para garantir tamanho uniforme (caso mude o formato entre cenas)
          ...scenes.map((_, i) => ({
            filter: 'scale',
            options: isPortrait
              ? '768:1344:force_original_aspect_ratio=increase,crop=768:1344,pad=768:1344:(ow-iw)/2:(oh-ih)/2'
              : '1344:768:force_original_aspect_ratio=increase,crop=1344:768,pad=1344:768:(ow-iw)/2:(oh-ih)/2',
            inputs: `${i}:v`,
            outputs: `scaled_${i}`
          })),
          // 2. Concatenar os fluxos de vídeo processados
          {
            filter: 'concat',
            options: { n: scenes.length, v: 1, a: 0 },
            inputs: scenes.map((_, i) => `scaled_${i}`),
            outputs: 'v'
          },
          // 3. Forçar o formato de pixel para compatibilidade universal (H.264)
          {
            filter: 'format',
            options: 'yuv420p',
            inputs: 'v',
            outputs: 'final_v'
          }
        ])
        .outputOptions([
          '-map [final_v]',
          `-map ${scenes.length}:a`, // O áudio é o index N
          '-c:v libx264',
          '-r 30',
          '-y'         // Sobrescrever arquivo se existir
        ])
        .on('start', (cmd: string) => console.log('[FFmpeg] Rendering started:', cmd))
        .on('error', (err: Error) => {
          console.error('[FFmpeg] Rendering error:', err)
          reject(err)
        })
        .on('end', async () => {
          const duration = Date.now() - startTime
          console.log(`[FFmpeg] Rendering completed in ${duration}ms`)
          await this.logExecution(videoId, 'render', 'completed', `Video rendered in ${duration}ms`, duration)
          resolve(outputPath)
        })
        .save(outputPath)
    })
  }

  /**
   * Regenera a imagem de uma cena específica
   */
  async regenerateSceneImage(sceneId: string): Promise<void> {
    console.log(`[VideoPipeline] Regenerating image for scene: ${sceneId}`)
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: { video: true }
    })

    if (!scene) throw new Error('Cena não encontrada')

    const video = scene.video
    const imageProvider = providerManager.getImageProvider()

    // Obter as tags do estilo visual selecionado
    const visualStyleTags = video.visualStyle ? getStyleTags(video.visualStyle) : ''

    const isPortrait = video.aspectRatio === '9:16'
    const width = isPortrait ? 768 : 1344
    const height = isPortrait ? 1344 : 768

    const fullPrompt = visualStyleTags
      ? `${scene.visualDescription}. Style: ${visualStyleTags}`
      : scene.visualDescription

    const request: ImageGenerationRequest = {
      prompt: fullPrompt,
      width,
      height,
      aspectRatio: video.aspectRatio || '16:9',
      style: (video.imageStyle as any) || 'cinematic',
      numVariants: 1
    }

    const result = await imageProvider.generate(request)
    const image = result.images[0]

    if (image) {
      const outputDir = path.resolve('storage', 'images', video.id)
      await fs.mkdir(outputDir, { recursive: true })

      // Desmarcar imagens anteriores desta cena
      await prisma.sceneImage.updateMany({
        where: { sceneId },
        data: { isSelected: false }
      })

      // Limpar vídeos anteriores desta cena (pois a imagem mudou)
      await prisma.sceneVideo.updateMany({
        where: { sceneId },
        data: { isSelected: false }
      })

      const fileName = `scene_${scene.order}_v${Date.now()}.png`
      const imagePath = path.join(outputDir, fileName)
      await fs.writeFile(imagePath, image.buffer)
      console.log(`[VideoPipeline] New image saved to: ${imagePath}`)

      await prisma.sceneImage.create({
        data: {
          sceneId: scene.id,
          provider: result.provider.toUpperCase() as 'REPLICATE',
          promptUsed: image.revisedPrompt ?? fullPrompt,
          filePath: imagePath,
          fileSize: image.buffer.length,
          width: image.width,
          height: image.height,
          isSelected: true
        }
      })

      await this.logExecution(video.id, 'images', 'completed', `Imagem da cena ${scene.order} regenerada com sucesso.`)
    }
  }

  /**
   * Regenera o vídeo (motion) de uma cena específica
   */
  async regenerateSceneMotion(sceneId: string): Promise<void> {
    console.log(`[VideoPipeline] Regenerating motion for scene: ${sceneId}`)
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        video: true,
        images: { where: { isSelected: true } }
      }
    })

    if (!scene) throw new Error('Cena não encontrada')
    const sourceImage = scene.images[0]
    if (!sourceImage) throw new Error('Imagem de origem não encontrada para esta cena')

    const video = scene.video
    const motionProvider = providerManager.getMotionProvider()

    const request: MotionGenerationRequest = {
      imagePath: sourceImage.filePath,
      prompt: scene.visualDescription,
      duration: 5,
      aspectRatio: (video.aspectRatio as any) || '16:9'
    }

    const result = await motionProvider.generate(request)
    const videoBuffer = result.video.videoBuffer

    const outputDir = path.resolve('storage', 'images', video.id)
    await fs.mkdir(outputDir, { recursive: true })

    // Desmarcar vídeos anteriores desta cena
    await prisma.sceneVideo.updateMany({
      where: { sceneId },
      data: { isSelected: false }
    })

    const fileName = `scene_${scene.order}_motion_${Date.now()}.mp4`
    const videoPath = path.join(outputDir, fileName)
    await fs.writeFile(videoPath, videoBuffer)
    console.log(`[VideoPipeline] New motion video saved to: ${videoPath}`)

    await prisma.sceneVideo.create({
      data: {
        sceneId: scene.id,
        provider: result.provider.toUpperCase() as 'REPLICATE',
        filePath: videoPath,
        fileSize: videoBuffer.length,
        duration: result.video.duration,
        sourceImageId: sourceImage.id,
        isSelected: true
      }
    })

    await this.logExecution(video.id, 'motion', 'completed', `Movimento da cena ${scene.order} regenerado com sucesso.`)
  }

  /**
   * Atualiza o status do vídeo
   */
  private async updateStatus(
    videoId: string,
    status: 'PENDING' | 'SCRIPT_GENERATING' | 'SCRIPT_READY' | 'AUDIO_GENERATING' |
      'AUDIO_READY' | 'IMAGES_GENERATING' | 'IMAGES_READY' | 'MOTION_GENERATING' |
      'MOTION_READY' | 'RENDERING' |
      'COMPLETED' | 'FAILED' | 'CANCELLED'
  ) {
    await prisma.video.update({
      where: { id: videoId },
      data: { status }
    })
  }

  /**
   * Registra log de execução do pipeline
   */
  private async logExecution(
    videoId: string,
    step: string,
    status: 'started' | 'completed' | 'failed',
    message?: string,
    durationMs?: number
  ) {
    await prisma.pipelineExecution.create({
      data: {
        videoId,
        step,
        status,
        message,
        durationMs
      }
    })
  }
}
