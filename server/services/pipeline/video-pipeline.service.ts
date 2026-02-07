/**
 * Video Pipeline Service
 * 
 * Responsável pela renderização final do vídeo usando FFmpeg.
 * Combina cenas (imagens/vídeos), narrações e trilhas sonoras.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import os from 'node:os'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import { prisma } from '../../utils/prisma'

// Configurar FFmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path)
ffmpeg.setFfprobePath(ffprobeInstaller.path)

export interface RenderResult {
  success: boolean
  error?: string
}

export class VideoPipelineService {
  /**
   * Renderiza o vídeo final para um Output
   */
  async renderVideo(outputId: string): Promise<RenderResult> {
    const tempDir = path.join(os.tmpdir(), `thegapfiles-render-${outputId}`)
    const outputDir = path.resolve('storage', 'outputs')
    const finalPath = path.join(outputDir, `${outputId}.mp4`)

    try {
      console.log(`[VideoPipeline] 🎬 Iniciando renderização para Output: ${outputId}`)

      // 1. Garantir diretórios
      await fs.mkdir(tempDir, { recursive: true })
      await fs.mkdir(outputDir, { recursive: true })

      // 2. Buscar dados do Output e Cenas
      const output = await prisma.output.findUnique({
        where: { id: outputId },
        include: {
          scenes: {
            orderBy: { order: 'asc' },
            include: {
              images: { where: { isSelected: true } },
              videos: { where: { isSelected: true } },
              audioTracks: { where: { type: 'scene_narration' } }
            }
          }
        }
      })

      if (!output) throw new Error('Output não encontrado')
      if (!output.scenes || output.scenes.length === 0) throw new Error('Nenhuma cena encontrada para renderizar')

      const isVertical = output.aspectRatio === '9:16'
      const width = isVertical ? 1080 : 1920
      const height = isVertical ? 1920 : 1080

      const scenePaths: string[] = []

      // 3. Processar cada cena individualmente
      for (const [index, scene] of output.scenes.entries()) {
        console.log(`[VideoPipeline] 🎞️ Processando cena ${index + 1}/${output.scenes.length}`)

        // Determinar asset visual (vídeo tem precedência sobre imagem)
        const videoAsset = scene.videos[0]
        const imageAsset = scene.images[0]
        const audioAsset = scene.audioTracks[0]

        if (!audioAsset?.fileData) {
          console.warn(`[VideoPipeline] ⚠️ Cena ${index + 1} sem áudio de narração. Pulando.`)
          continue
        }

        const sceneAudioPath = path.join(tempDir, `scene_${index}_audio.mp3`)
        await fs.writeFile(sceneAudioPath, audioAsset.fileData)

        // Descobrir o tempo do áudio de maneira simples e direta (ffprobe no arquivo real)
        const realDuration = await new Promise<number>((resolve) => {
          ffmpeg.ffprobe(sceneAudioPath, (err, metadata) => {
            if (err) {
              console.warn(`[VideoPipeline] Erro ao ler duração com ffprobe, usando DB: ${err.message}`)
              return resolve(audioAsset.duration || 5)
            }
            resolve(metadata?.format?.duration || audioAsset.duration || 5)
          })
        })

        console.log(`[VideoPipeline] ⏳ Sincronia Real: Visual casado com Áudio (${realDuration.toFixed(3)}s)`)

        let visualInputPath: string
        let isVideo = false

        if (videoAsset?.fileData) {
          visualInputPath = path.join(tempDir, `scene_${index}_visual.mp4`)
          await fs.writeFile(visualInputPath, videoAsset.fileData)
          isVideo = true
        } else if (imageAsset?.fileData) {
          visualInputPath = path.join(tempDir, `scene_${index}_visual.png`)
          await fs.writeFile(visualInputPath, imageAsset.fileData)
        } else {
          console.warn(`[VideoPipeline] ⚠️ Cena ${index + 1} sem imagem ou vídeo. Pulando.`)
          continue
        }

        const sceneOutputPath = path.join(tempDir, `scene_${index}_final.mp4`)

        // Renderizar clipe da cena usando o tempo REAL detectado
        await this.renderSceneClip({
          visualPath: visualInputPath,
          audioPath: sceneAudioPath,
          outputPath: sceneOutputPath,
          isVideo,
          width,
          height,
          duration: realDuration,
          visualDuration: isVideo ? await this.getVideoDuration(visualInputPath) : 0
        })

        scenePaths.push(sceneOutputPath)
      }

      if (scenePaths.length === 0) throw new Error('Falha ao gerar clipes das cenas')

      // 4. Concatenar todas as cenas
      console.log(`[VideoPipeline] 🔗 Concatenando ${scenePaths.length} cenas...`)
      const concatenatedPath = path.join(tempDir, 'concatenated_no_bgm.mp4')
      await this.concatenateScenes(scenePaths, concatenatedPath)

      // 5. Mixar Background Music (se existir)
      const bgmTrack = await prisma.audioTrack.findFirst({
        where: { outputId, type: 'background_music' },
        orderBy: { createdAt: 'desc' }
      })

      const script = await prisma.script.findUnique({
        where: { outputId },
        select: { backgroundMusicVolume: true }
      })

      if (bgmTrack?.fileData) {
        const bgmVolume = script?.backgroundMusicVolume ?? -18
        console.log(`[VideoPipeline] 🎵 Mixando Background Music (volume: ${bgmVolume}dB)...`)

        const bgmPath = path.join(tempDir, 'bgm_audio.mp3')
        await fs.writeFile(bgmPath, bgmTrack.fileData)

        await this.mixBackgroundMusic(concatenatedPath, bgmPath, finalPath, bgmVolume)
        console.log(`[VideoPipeline] ✅ Background Music mixada com sucesso!`)
      } else {
        // Sem BGM - copiar concatenado direto
        console.log(`[VideoPipeline] ⚠️ Sem Background Music. Usando vídeo sem BGM.`)
        await fs.copyFile(concatenatedPath, finalPath)
      }

      console.log(`[VideoPipeline] ✅ Renderização concluída: ${finalPath}`)

      // 5. Ler arquivo para salvar no banco
      const videoBuffer = await fs.readFile(finalPath)
      const stats = await fs.stat(finalPath)

      // 6. Atualizar banco de dados com os dados BINÁRIOS
      await prisma.output.update({
        where: { id: outputId },
        data: {
          outputData: videoBuffer,
          outputMimeType: 'video/mp4',
          outputSize: stats.size,
          outputPath: null, // Limpa o caminho antigo para não confundir
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      console.log(`[VideoPipeline] 🗄️ Vídeo ingerido no PostgreSQL e removido do disco.`)

      return { success: true }

    } catch (error: any) {
      console.error(`[VideoPipeline] ❌ Erro na renderização:`, error)
      return { success: false, error: error.message }
    } finally {
      // Limpar TODOS os arquivos temporários e o output físico
      try {
        await fs.rm(tempDir, { recursive: true, force: true })

        // Se houver arquivo de output sobrando, deleta
        if (await fs.stat(finalPath).catch(() => null)) {
          await fs.unlink(finalPath)
        }
      } catch (err) {
        console.error(`[VideoPipeline] Erro na limpeza final:`, err)
      }
    }
  }

  /**
   * Obtém a duração de um arquivo de vídeo usando ffprobe
   */
  private getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err)
        const duration = metadata.format.duration
        resolve(duration || 0)
      })
    })
  }

  /**
   * Cria um clipe de vídeo para uma única cena, sincronizando visual e áudio
   */
  private renderSceneClip(options: {
    visualPath: string
    audioPath: string
    outputPath: string
    isVideo: boolean
    width: number
    height: number
    duration: number
    visualDuration: number // Duração original do vídeo visual (se houver)
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg()

      // Construir filtros de vídeo
      const videoFilters = [
        `scale=${options.width}:${options.height}:force_original_aspect_ratio=increase`,
        `crop=${options.width}:${options.height}`
      ]

      if (options.isVideo) {
        // Se for vídeo, calculamos o fator de time-stretch para encaixar no áudio
        // Factor = Target / Source
        // Ex: Target 10s, Source 2s -> Factor 5 -> setpts=5*PTS (Slow motion)
        const timeStretchFactor = options.visualDuration > 0 ? (options.duration / options.visualDuration) : 1

        console.log(`[VideoPipeline] 🐢 Time-Stretch: Source=${options.visualDuration.toFixed(2)}s, Target=${options.duration.toFixed(2)}s, Factor=${timeStretchFactor.toFixed(2)}x`)

        videoFilters.push(`setpts=${timeStretchFactor}*PTS`)

        command.input(options.visualPath)
      } else {
        // Se for imagem, faz loop
        command.input(options.visualPath).inputOptions(['-loop 1'])
      }

      // Adicionar áudio
      command.input(options.audioPath)

      command
        .outputOptions([
          `-t ${options.duration}`, // Duração exata (baseada no áudio)
          '-c:v libx264',
          '-r 30', // Frame rate constante
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-ar 44100',
          '-shortest',
          `-vf ${videoFilters.join(',')}` // Aplicar filtros combinados
        ])
        .output(options.outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run()
    })
  }

  /**
   * Mixa Background Music no vídeo final
   * Aplica o volume em dB definido pela LangChain via FFmpeg amix
   */
  private mixBackgroundMusic(
    videoPath: string,
    bgmPath: string,
    outputPath: string,
    volumeDb: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // filter_complex:
      // [1:a] = áudio do BGM
      // volume=XdB = aplica o volume definido pela LangChain
      // amix inputs=2, duration=first = mixa BGM com narração, cortando BGM quando o vídeo acabar
      const filterComplex = `[1:a]volume=${volumeDb}dB[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`

      ffmpeg()
        .input(videoPath)
        .input(bgmPath)
        .outputOptions([
          '-filter_complex', filterComplex,
          '-map', '0:v',
          '-map', '[aout]',
          '-c:v', 'copy', // Não re-encoda vídeo (só mixa áudio)
          '-c:a', 'aac',
          '-ar', '44100',
          '-b:a', '192k'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run()
    })
  }

  /**
   * Concatena múltiplos arquivos MP4
   */
  private concatenateScenes(inputs: string[], outputPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Usar concat demuxer para evitar bugs de sincronia do mergeToFile
      const listPath = path.join(path.dirname(outputPath), 'concat_list.txt')
      const content = inputs.map(p => `file '${path.resolve(p).replace(/\\/g, '/')}'`).join('\n')

      try {
        await fs.writeFile(listPath, content)

        ffmpeg()
          .input(listPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c copy']) // Copia direta sem re-encodar (mantém sincronia)
          .on('error', async (err: Error) => {
            await fs.unlink(listPath).catch(() => { })
            reject(err)
          })
          .on('end', async () => {
            await fs.unlink(listPath).catch(() => { })
            resolve()
          })
          .save(outputPath)
      } catch (err) {
        reject(err)
      }
    })
  }
}

export const videoPipelineService = new VideoPipelineService()
