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

      // 4. Gerar áudio (se não existir)
      const existingAudio = await prisma.audioTrack.findFirst({
        where: { videoId: videoId!, type: 'narration' }
      })

      if (!existingAudio) {
        await this.updateStatus(videoId!, 'AUDIO_GENERATING')
        await this.logExecution(videoId!, 'audio', 'started', 'Iniciando síntese de voz...')
        await this.generateAudio(videoId!, script!.fullText, effectiveOptions)
        await this.updateStatus(videoId!, 'AUDIO_READY')
        await this.logExecution(videoId!, 'audio', 'completed', 'Narração de áudio concluída.')
      } else {
        await this.logExecution(videoId!, 'audio', 'completed', 'Áudio já existe. Reutilizando narração existente.')
      }

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
      await this.renderVideo(videoId!)

      // 7. Finalizar
      await prisma.video.update({
        where: { id: videoId! },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      return {
        videoId: videoId,
        status: 'completed'
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
      await this.logExecution(videoId, 'render', 'started', 'Renderizando vídeo...')
      await this.renderVideo(videoId)

      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      return {
        videoId,
        status: 'completed'
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
      select: {
        theme: true,
        language: true,
        narrationLanguage: true,
        sourceDocument: true,
        duration: true,
        targetWPM: true,
        style: true,
        visualStyle: true,
        mustInclude: true,
        mustExclude: true
      }
    })

    // Buscar estilo visual completo do banco (com campos categorizados)
    const selectedVisualStyle = options.visualStyle || video?.visualStyle
    let visualStyleData: {
      description: string
      baseStyle: string
      lightingTags: string
      atmosphereTags: string
      compositionTags: string
      tags: string
    } | undefined

    if (selectedVisualStyle) {
      const styleFromDb = await prisma.visualStyle.findFirst({
        where: {
          id: selectedVisualStyle,
          isActive: true
        },
        select: {
          description: true,
          baseStyle: true,
          lightingTags: true,
          atmosphereTags: true,
          compositionTags: true,
          tags: true
        }
      })
      if (styleFromDb) {
        visualStyleData = styleFromDb
      }
    }

    // Buscar instruções do estilo de roteiro do banco
    const selectedScriptStyle = options.style || video?.style
    let scriptStyleDescription: string | undefined
    let scriptStyleInstructions: string | undefined
    if (selectedScriptStyle) {
      const scriptStyleFromDb = await prisma.scriptStyle.findFirst({
        where: {
          id: selectedScriptStyle,
          isActive: true
        },
        select: { description: true, instructions: true }
      })
      scriptStyleDescription = scriptStyleFromDb?.description
      scriptStyleInstructions = scriptStyleFromDb?.instructions
    }

    const request: ScriptGenerationRequest = {
      theme: options.theme || video?.theme || '',
      language: options.language || video?.language || 'pt-BR',
      targetDuration: options.targetDuration || video?.duration || 300,
      targetWPM: video?.targetWPM || 150, // Velocidade de fala padrão: 150 WPM (média)
      style: selectedScriptStyle || 'documentary',
      scriptStyleDescription: scriptStyleDescription,
      scriptStyleInstructions: scriptStyleInstructions,
      visualStyle: selectedVisualStyle || undefined,
      visualStyleDescription: visualStyleData?.description, // Mantido para compatibilidade
      visualBaseStyle: visualStyleData?.baseStyle,
      visualLightingTags: visualStyleData?.lightingTags,
      visualAtmosphereTags: visualStyleData?.atmosphereTags,
      visualCompositionTags: visualStyleData?.compositionTags,
      visualGeneralTags: visualStyleData?.tags,
      additionalContext: video?.sourceDocument || options.additionalContext,
      mustInclude: options.mustInclude || video?.mustInclude || undefined,
      mustExclude: options.mustExclude || video?.mustExclude || undefined
    }

    const scriptProvider = providerManager.getScriptProvider()
    const result = await scriptProvider.generate(request)

    // Salvar roteiro
    await prisma.script.create({
      data: {
        videoId,
        summary: result.summary,
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
          visualDescription: scene.visualDescription,
          audioDescription: scene.audioDescription
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
      select: { narrationLanguage: true, voiceId: true }
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
        language: options.language || video?.narrationLanguage || 'pt-BR'
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

    // Ler arquivo final e comprimir
    const finalAudioBuffer = await fs.readFile(finalAudioPath)
    const { bufferToBytes, getMimeType } = await import('../../utils/compression')
    const compressedData = await bufferToBytes(finalAudioBuffer)
    const mimeType = getMimeType(finalAudioBuffer)

    // Registrar trilha principal no banco (BYTEA comprimido)
    await prisma.audioTrack.create({
      data: {
        videoId,
        type: 'narration',
        provider: ttsProvider.getName().toUpperCase() as 'ELEVENLABS',
        voiceId: selectedVoiceId,
        fileData: new Uint8Array(compressedData),
        mimeType: mimeType,
        originalSize: finalAudioBuffer.length,
        duration: totalDuration
      }
    })

    // Limpar arquivos temporários
    await fs.rm(audioDir, { recursive: true, force: true })

    await this.logExecution(
      videoId,
      'audio',
      'completed',
      `Generated ${totalDuration.toFixed(2)}s of narrated audio across ${scenes.length} scenes.`,
      Date.now() - startTime
    )

    return { audioBuffer: finalAudioBuffer, duration: totalDuration }
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
      select: {
        visualStyle: true,
        aspectRatio: true,
        imageStyle: true,
        seedId: true // Buscar seed do vídeo
      }
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

    // Buscar seed do banco se o vídeo tiver uma
    let seedValue: number | undefined
    if (video?.seedId) {
      const seedFromDb = await prisma.seed.findUnique({
        where: { id: video.seedId },
        select: { value: true }
      })
      seedValue = seedFromDb?.value
    }

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
        numVariants: 1,
        seed: seedValue // Passar seed para o provider
      }

      const result = await imageProvider.generate(request)

      // Salvar cada imagem gerada no banco (BYTEA comprimido)
      for (let j = 0; j < result.images.length; j++) {
        const image = result.images[j]
        if (!image) continue

        // Comprimir e detectar MIME type
        const { bufferToBytes, getMimeType } = await import('../../utils/compression')
        const compressedData = await bufferToBytes(image.buffer)
        const mimeType = getMimeType(image.buffer)

        await prisma.sceneImage.create({
          data: {
            sceneId: scene.id,
            provider: result.provider.toUpperCase() as 'REPLICATE' | 'STABLE_DIFFUSION',
            promptUsed: image.revisedPrompt ?? fullPrompt,
            fileData: new Uint8Array(compressedData),
            mimeType: mimeType,
            originalSize: image.buffer.length,
            width: image.width,
            height: image.height,
            isSelected: j === 0,
            variantIndex: j
          }
        })
      }
      await this.logExecution(videoId, 'images', 'completed', `Imagem gerada para a cena ${i + 1}.`)
    }

    // Incrementar usageCount da seed após uso bem-sucedido
    if (video?.seedId) {
      await prisma.seed.update({
        where: { id: video.seedId },
        data: {
          usageCount: {
            increment: 1
          }
        }
      })
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
        if (!sourceImage || !sourceImage.fileData) return

        await this.logExecution(videoId, 'motion', 'started', `Gerando movimento para a cena ${index + 1} de ${scenes.length}...`)

        // Para Image-to-Video, o prompt deve focar no conteúdo da cena.
        const motionPrompt = scene.visualDescription

        // Usar a duração real do áudio da cena se disponível, senão padrão de 5s
        const realDuration = (scene.endTime && scene.startTime !== null)
          ? Math.ceil(scene.endTime - scene.startTime)
          : 5

        // Descomprimir imagem do banco
        const { bytesToBuffer } = await import('../../utils/compression')
        const imageBuffer = await bytesToBuffer(Buffer.from(sourceImage.fileData))

        const request: MotionGenerationRequest = {
          imageBuffer: imageBuffer, // Passar buffer em vez de path
          prompt: motionPrompt,
          duration: realDuration,
          aspectRatio: selectedAspectRatio
        }

        try {
          const result = await motionProvider.generate(request)
          const videoBuffer = result.video.videoBuffer

          // Comprimir vídeo e salvar no banco
          const { bufferToBytes, getMimeType } = await import('../../utils/compression')
          const compressedData = await bufferToBytes(videoBuffer)
          const mimeType = getMimeType(videoBuffer)

          // Salvar no banco
          await prisma.sceneVideo.create({
            data: {
              sceneId: scene.id,
              provider: result.provider.toUpperCase() as 'REPLICATE',
              fileData: new Uint8Array(compressedData),
              mimeType: mimeType,
              originalSize: videoBuffer.length,
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
  private async renderVideo(videoId: string): Promise<void> {
    const startTime = Date.now()

    // Diretório temporário para renderização
    const tempDir = path.resolve('storage', 'temp', videoId, 'render')
    await fs.mkdir(tempDir, { recursive: true })

    try {
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
      const totalAudioDuration = audioTrack.duration || 0

      // 2. Descomprimir áudio do banco para arquivo temporário
      if (!audioTrack.fileData) {
        throw new Error('Audio track has no data')
      }
      const { bytesToBuffer } = await import('../../utils/compression')
      const audioBuffer = await bytesToBuffer(Buffer.from(audioTrack.fileData))
      const audioPath = path.join(tempDir, 'narration.mp3')
      await fs.writeFile(audioPath, audioBuffer)

      // 3. Preparar cenas e tempos
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

      // 4. Descomprimir assets (imagens/vídeos) para arquivos temporários
      const scenePaths: string[] = []
      for (const [index, scene] of scenes.entries()) {
        const videoClip = scene.videos[0]
        const image = scene.images[0]

        if (videoClip && videoClip.fileData) {
          const videoBuffer = await bytesToBuffer(Buffer.from(videoClip.fileData))
          const videoPath = path.join(tempDir, `scene_${index}.mp4`)
          await fs.writeFile(videoPath, videoBuffer)
          scenePaths.push(videoPath)
        } else if (image && image.fileData) {
          const imageBuffer = await bytesToBuffer(Buffer.from(image.fileData))
          const imagePath = path.join(tempDir, `scene_${index}.png`)
          await fs.writeFile(imagePath, imageBuffer)
          scenePaths.push(imagePath)
        } else {
          throw new Error(`Scene ${index} has no valid asset`)
        }
      }

      // 5. Renderizar vídeo
      const outputPath = path.join(tempDir, 'final.mp4')

      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg()

        // Armazenar metadados de cada cena para aplicar filtros
        const sceneMetadata: Array<{ duration: number; videoClipDuration?: number; isVideo: boolean }> = []

        // Adicionar cada asset como um input com duração real baseada no áudio
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

          if (videoClip && scenePaths[index]) {
            // Para vídeos, armazenar duração original para calcular velocidade
            const videoClipDuration = videoClip.duration || 5 // Padrão 5s se não tiver
            sceneMetadata.push({ duration, videoClipDuration, isVideo: true })

            // Não usar loop, vamos ajustar a velocidade depois
            command.input(scenePaths[index]!)
          } else if (image && scenePaths[index]) {
            sceneMetadata.push({ duration, isVideo: false })
            command.input(scenePaths[index]!)
              .inputOptions(['-loop 1', `-t ${duration}`])
          }
        })

        // Adicionar o áudio como último input (sem loop)
        command.input(audioPath)

        command
          .complexFilter([
            // 1. Ajustar velocidade dos vídeos para sincronizar com áudio
            ...scenes.map((_, i) => {
              const metadata = sceneMetadata[i]
              if (!metadata) return [] // Segurança: pular se não houver metadata

              const filters: any[] = []

              if (metadata.isVideo && metadata.videoClipDuration) {
                // Calcular fator de velocidade: quanto precisa acelerar/desacelerar
                const speedFactor = metadata.videoClipDuration / metadata.duration

                if (speedFactor > 1.05) {
                  // Vídeo é mais longo que o áudio → acelerar (máx 1.5x)
                  const clampedSpeed = Math.min(speedFactor, 1.5)
                  filters.push({
                    filter: 'setpts',
                    options: `${1 / clampedSpeed}*PTS`,
                    inputs: `${i}:v`,
                    outputs: `adjusted_${i}`
                  })
                } else if (speedFactor < 0.95) {
                  // Vídeo é mais curto que o áudio → desacelerar (mín 0.5x)
                  const clampedSpeed = Math.max(speedFactor, 0.5)
                  filters.push({
                    filter: 'setpts',
                    options: `${1 / clampedSpeed}*PTS`,
                    inputs: `${i}:v`,
                    outputs: `adjusted_${i}`
                  })
                } else {
                  // Diferença mínima (< 5%) → não ajustar
                  filters.push({
                    filter: 'null',
                    inputs: `${i}:v`,
                    outputs: `adjusted_${i}`
                  })
                }

                // Trim para garantir duração exata
                filters.push({
                  filter: 'trim',
                  options: { duration: metadata.duration },
                  inputs: `adjusted_${i}`,
                  outputs: `trimmed_${i}`
                })

                // Resetar PTS após trim
                filters.push({
                  filter: 'setpts',
                  options: 'PTS-STARTPTS',
                  inputs: `trimmed_${i}`,
                  outputs: `final_${i}`
                })
              } else {
                // Para imagens, apenas passar adiante
                filters.push({
                  filter: 'null',
                  inputs: `${i}:v`,
                  outputs: `final_${i}`
                })
              }

              return filters
            }).flat(),

            // 2. Escalar para garantir tamanho uniforme
            ...scenes.map((_, i) => ({
              filter: 'scale',
              options: isPortrait
                ? '768:1344:force_original_aspect_ratio=increase,crop=768:1344,pad=768:1344:(ow-iw)/2:(oh-ih)/2'
                : '1344:768:force_original_aspect_ratio=increase,crop=1344:768,pad=1344:768:(ow-iw)/2:(oh-ih)/2',
              inputs: `final_${i}`,
              outputs: `scaled_${i}`
            })),

            // 3. Concatenar os fluxos de vídeo processados
            {
              filter: 'concat',
              options: { n: scenes.length, v: 1, a: 0 },
              inputs: scenes.map((_, i) => `scaled_${i}`),
              outputs: 'v'
            },

            // 4. Forçar o formato de pixel para compatibilidade universal (H.264)
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
            resolve()
          })
          .save(outputPath)
      })

      // 6. Comprimir vídeo final e salvar no banco
      const finalVideoBuffer = await fs.readFile(outputPath)
      const { bufferToBytes, getMimeType } = await import('../../utils/compression')
      const compressedData = await bufferToBytes(finalVideoBuffer)
      const mimeType = getMimeType(finalVideoBuffer)

      await prisma.video.update({
        where: { id: videoId },
        data: {
          outputData: new Uint8Array(compressedData),
          outputMimeType: mimeType,
          outputSize: finalVideoBuffer.length
        }
      })

    } finally {
      // 7. Limpar arquivos temporários
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { })
    }
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

      // Comprimir e salvar no banco
      const { bufferToBytes, getMimeType } = await import('../../utils/compression')
      const compressedData = await bufferToBytes(image.buffer)
      const mimeType = getMimeType(image.buffer)

      await prisma.sceneImage.create({
        data: {
          sceneId: scene.id,
          provider: result.provider.toUpperCase() as 'REPLICATE',
          promptUsed: image.revisedPrompt ?? fullPrompt,
          fileData: new Uint8Array(compressedData),
          mimeType: mimeType,
          originalSize: image.buffer.length,
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
    if (!sourceImage || !sourceImage.fileData) throw new Error('Imagem de origem não encontrada para esta cena')

    const video = scene.video
    const motionProvider = providerManager.getMotionProvider()

    // Descomprimir imagem do banco
    const { bytesToBuffer, bufferToBytes, getMimeType } = await import('../../utils/compression')
    const imageBuffer = await bytesToBuffer(Buffer.from(sourceImage.fileData))

    const request: MotionGenerationRequest = {
      imageBuffer: imageBuffer, // Passar buffer em vez de path
      prompt: scene.visualDescription,
      duration: 5,
      aspectRatio: (video.aspectRatio as any) || '16:9'
    }

    const result = await motionProvider.generate(request)
    const videoBuffer = result.video.videoBuffer

    // Desmarcar vídeos anteriores desta cena
    await prisma.sceneVideo.updateMany({
      where: { sceneId },
      data: { isSelected: false }
    })

    // Comprimir e salvar no banco
    const compressedData = await bufferToBytes(videoBuffer)
    const mimeType = getMimeType(videoBuffer)

    await prisma.sceneVideo.create({
      data: {
        sceneId: scene.id,
        provider: result.provider.toUpperCase() as 'REPLICATE',
        fileData: new Uint8Array(compressedData),
        mimeType: mimeType,
        originalSize: videoBuffer.length,
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
