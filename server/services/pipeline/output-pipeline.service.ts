/**
 * Output Pipeline Service
 * 
 * Orquestra todo o fluxo de criação de output (vídeo, thread, post, etc.)
 * a partir de um Document.
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
  MotionGenerationRequest
} from '../../types/ai-providers'
import { prisma } from '../../utils/prisma'
import { providerManager } from '../providers'
import fs from 'node:fs/promises'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

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
    try {
      // 1. Carregar Output com Document e todas as relações
      const output = await prisma.output.findUnique({
        where: { id: outputId },
        include: {
          document: {
            include: {
              sources: { orderBy: { order: 'asc' } },
              images: { orderBy: { order: 'asc' } },
              notes: { orderBy: { order: 'asc' } }
            }
          },
          scriptStyle: true,
          visualStyle: true,
          seed: true
        }
      })

      if (!output) {
        throw new Error('Output não encontrado')
      }

      // 2. Validar tipo de output (só vídeos por enquanto)
      if (output.outputType !== 'VIDEO_TEASER' && output.outputType !== 'VIDEO_FULL') {
        throw new Error(`Output type ${output.outputType} não suportado ainda`)
      }

      // 3. Gerar roteiro (se não existir)
      const existingScript = await prisma.script.findUnique({ where: { outputId } })
      let script: any = existingScript

      if (!existingScript) {
        await this.updateStatus(outputId, 'GENERATING')
        await this.logExecution(outputId, 'script', 'started', 'Gerando roteiro...')
        script = await this.generateScript(outputId, output)
        await this.logExecution(outputId, 'script', 'completed', 'Roteiro gerado.')
      }

      // 4. Aguardar aprovação do roteiro
      if (!output.scriptApproved) {
        return {
          outputId,
          status: 'completed',
          message: 'Roteiro pronto para revisão. Aprove para prosseguir.'
        }
      }

      // 5. Gerar imagens
      const scenesWithImages = await prisma.scene.findMany({
        where: { outputId },
        include: { images: true }
      })
      const hasImages = scenesWithImages.some(s => s.images.length > 0)

      if (!output.imagesApproved && !hasImages) {
        await this.logExecution(outputId, 'images', 'started', 'Gerando imagens...')
        await this.generateImages(outputId, output)
        await this.logExecution(outputId, 'images', 'completed', 'Imagens geradas.')
      }

      if (!output.imagesApproved) {
        return {
          outputId,
          status: 'completed',
          message: 'Imagens prontas para aprovação.'
        }
      }

      // 6. Gerar áudio
      const existingAudio = await prisma.audioTrack.findFirst({
        where: { outputId, type: 'narration' }
      })

      if (!existingAudio) {
        await this.logExecution(outputId, 'audio', 'started', 'Gerando narração...')
        await this.generateAudio(outputId, script.fullText, output)
        await this.logExecution(outputId, 'audio', 'completed', 'Narração gerada.')
      }

      // 7. Gerar motion (se habilitado)
      if (output.enableMotion) {
        const scenesWithVideos = await prisma.scene.findMany({
          where: { outputId },
          include: { videos: true }
        })
        const hasVideos = scenesWithVideos.some(s => s.videos.length > 0)

        if (!output.videosApproved && !hasVideos) {
          await this.logExecution(outputId, 'motion', 'started', 'Gerando motion...')
          await this.generateMotion(outputId, output)
          await this.logExecution(outputId, 'motion', 'completed', 'Motion gerado.')
        }

        if (!output.videosApproved) {
          return {
            outputId,
            status: 'completed',
            message: 'Vídeos prontos para aprovação.'
          }
        }
      }

      // 8. Renderizar vídeo final
      await this.logExecution(outputId, 'render', 'started', 'Renderizando...')
      await this.renderVideo(outputId)

      // 9. Finalizar
      await prisma.output.update({
        where: { id: outputId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      return {
        outputId,
        status: 'completed'
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.output.update({
        where: { id: outputId },
        data: {
          status: 'FAILED',
          errorMessage
        }
      })

      await this.logExecution(outputId, 'pipeline', 'failed', errorMessage)

      return {
        outputId,
        status: 'failed',
        error: errorMessage
      }
    }
  }

  /**
   * Gera roteiro com contexto rico do Document
   */
  private async generateScript(outputId: string, output: any) {
    const scriptProvider = providerManager.getScriptProvider()
    const document = output.document

    // Construir prompt com TODAS as fontes
    const promptContext: ScriptGenerationRequest = {
      theme: document.theme,
      language: output.language || 'pt-BR',
      narrationLanguage: output.narrationLanguage || 'pt-BR',
      
      // DOCUMENT SOURCES (RICO)
      sourceDocument: document.sourceText,
      
      // Fontes secundárias
      additionalSources: document.sources?.map((s: any) => ({
        title: s.title,
        content: s.content,
        type: s.sourceType
      })) || [],
      
      // Insights do usuário
      userNotes: document.notes?.map((n: any) => n.content) || [],
      
      // Referências visuais (descrições)
      visualReferences: document.images?.map((i: any) => i.description) || [],
      
      // Dados estruturados
      researchData: document.researchData,
      
      // Configuração de duração e tipo
      targetDuration: output.duration || 300,
      targetWPM: output.targetWPM || 150,
      
      // OUTPUT TYPE ESPECÍFICO
      outputType: output.outputType,
      format: output.format,
      
      // Estilo de roteiro
      scriptStyleDescription: output.scriptStyle?.description,
      scriptStyleInstructions: output.scriptStyle?.instructions,
      
      // Estilo visual
      visualStyleName: output.visualStyle?.name,
      visualStyleDescription: output.visualStyle?.description,
      
      // Diretrizes
      mustInclude: output.mustInclude,
      mustExclude: output.mustExclude
    }

    // Gerar roteiro
    const scriptResponse = await scriptProvider.generate(promptContext)

    // Salvar roteiro
    const script = await prisma.script.create({
      data: {
        outputId,
        summary: scriptResponse.summary || '',
        fullText: scriptResponse.text,
        wordCount: scriptResponse.text.split(/\s+/).length,
        provider: scriptProvider.name as any,
        modelUsed: scriptResponse.model,
        promptUsed: JSON.stringify(promptContext)
      }
    })

    // Salvar cenas
    if (scriptResponse.scenes) {
      await prisma.scene.createMany({
        data: scriptResponse.scenes.map((scene, index) => ({
          outputId,
          order: index,
          narration: scene.narration,
          visualDescription: scene.visualDescription,
          audioDescription: scene.audioDescription || null
        }))
      })
    }

    return script
  }

  /**
   * Gera imagens para as cenas
   */
  private async generateImages(outputId: string, output: any) {
    const imageProvider = providerManager.getImageProvider()
    const scenes = await prisma.scene.findMany({
      where: { outputId },
      orderBy: { order: 'asc' }
    })

    for (const scene of scenes) {
      const isPortrait = output.aspectRatio === '9:16'
      const width = isPortrait ? 768 : 1344
      const height = isPortrait ? 1344 : 768

      const request: ImageGenerationRequest = {
        prompt: scene.visualDescription,
        width,
        height,
        aspectRatio: output.aspectRatio || '16:9',
        style: output.visualStyle?.baseStyle || 'cinematic',
        seed: output.seed?.value,
        numVariants: 1
      }

      const imageResponse = await imageProvider.generate(request)

      // Pegar primeira imagem gerada
      const firstImage = imageResponse.images[0]
      if (!firstImage) continue

      await prisma.sceneImage.create({
        data: {
          sceneId: scene.id,
          provider: imageProvider.name as any,
          promptUsed: scene.visualDescription,
          fileData: firstImage.buffer,
          mimeType: 'image/png',
          originalSize: firstImage.buffer.length,
          width: firstImage.width,
          height: firstImage.height,
          isSelected: true,
          variantIndex: 0
        }
      })
    }
  }

  /**
   * Gera áudio (narração)
   */
  private async generateAudio(outputId: string, text: string, output: any) {
    const ttsProvider = providerManager.getTTSProvider()

    const request: TTSRequest = {
      text,
      voiceId: output.voiceId || 'default',
      language: output.narrationLanguage || 'pt-BR'
    }

    const audioResponse = await ttsProvider.synthesize(request)

    await prisma.audioTrack.create({
      data: {
        outputId,
        type: 'narration',
        provider: ttsProvider.name as any,
        voiceId: output.voiceId,
        fileData: audioResponse.audioBuffer,
        mimeType: 'audio/mpeg',
        originalSize: audioResponse.audioBuffer.length,
        duration: audioResponse.duration
      }
    })
  }

  /**
   * Gera motion (image-to-video)
   */
  private async generateMotion(outputId: string, output: any) {
    const motionProvider = providerManager.getMotionProvider()
    const scenes = await prisma.scene.findMany({
      where: { outputId },
      include: {
        images: {
          where: { isSelected: true }
        }
      },
      orderBy: { order: 'asc' }
    })

    for (const scene of scenes) {
      const selectedImage = scene.images[0]
      if (!selectedImage?.fileData) continue

      const request: MotionGenerationRequest = {
        imageBuffer: selectedImage.fileData,
        prompt: scene.visualDescription,
        duration: 5,
        aspectRatio: output.aspectRatio || '16:9'
      }

      const videoResponse = await motionProvider.generate(request)

      await prisma.sceneVideo.create({
        data: {
          sceneId: scene.id,
          provider: motionProvider.name as any,
          promptUsed: scene.visualDescription,
          fileData: videoResponse.video.videoBuffer,
          mimeType: 'video/mp4',
          originalSize: videoResponse.video.videoBuffer.length,
          duration: videoResponse.video.duration || 5,
          sourceImageId: selectedImage.id,
          isSelected: true,
          variantIndex: 0
        }
      })
    }
  }

  /**
   * Renderiza vídeo final (placeholder - usa lógica do VideoPipelineService)
   */
  private async renderVideo(outputId: string) {
    // TODO: Implementar renderização
    // Por enquanto, marca como completo
    console.log(`[OutputPipeline] Renderização do output ${outputId} (placeholder)`)
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
