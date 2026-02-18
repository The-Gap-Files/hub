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
import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { createPipelineLogger } from '../../utils/pipeline-logger'
import { CaptionService, type SceneCaptionData } from '../caption.service'
import type { CaptionStyleId } from '../../constants/caption-styles'

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
    const log = createPipelineLogger({ stage: 'Render', outputId })
    const tempDir = path.join(os.tmpdir(), `thegapfiles-render-${outputId}`)
    const outputDir = path.resolve('storage', 'outputs')
    const finalPath = path.join(outputDir, `${outputId}.mp4`)

    try {
      log.info('Iniciando renderização (motion + narração + BGM → disco temp → banco).')

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
              audioTracks: { where: { type: { in: ['scene_narration', 'scene_sfx'] } } }
            }
          }
        }
      })

      if (!output) throw new Error('Output não encontrado')
      if (!output.scenes || output.scenes.length === 0) throw new Error('Nenhuma cena encontrada para renderizar')

      const narrativeRole = (output.monetizationContext && typeof output.monetizationContext === 'object')
        ? (output.monetizationContext as any).narrativeRole
        : undefined
      const isHookOnly = narrativeRole === 'hook-only'

      const isVertical = output.aspectRatio === '9:16'
      const width = isVertical ? 1080 : 1920
      const height = isVertical ? 1920 : 1080

      const scenePaths: string[] = []
      const sceneDurations: number[] = [] // Armazena duração real de cada cena para sincronia global

      // 3. Processar cada cena individualmente
      for (const [index, scene] of output.scenes.entries()) {
        log.step(`Cena ${index + 1}/${output.scenes.length}`, `sceneId=${scene.id}`)

        // Determinar asset visual (vídeo tem precedência sobre imagem)
        const videoAsset = scene.videos[0]
        const imageAsset = scene.images[0]
        const audioAsset = scene.audioTracks.find(t => t.type === 'scene_narration')
        const sfxAsset = scene.audioTracks.find(t => t.type === 'scene_sfx')

        if (!audioAsset?.fileData) {
          log.warn(`Cena ${index + 1} sem áudio de narração; pulando.`)
          continue
        }

        const sceneAudioPath = path.join(tempDir, `scene_${index}_audio.mp3`)
        await fs.writeFile(sceneAudioPath, audioAsset.fileData)

        // Se a cena tem SFX, pré-mixar narração + SFX
        let finalAudioPath = sceneAudioPath
        if (sfxAsset?.fileData) {
          const sfxPath = path.join(tempDir, `scene_${index}_sfx.mp3`)
          await fs.writeFile(sfxPath, sfxAsset.fileData)

          const mixedPath = path.join(tempDir, `scene_${index}_mixed.mp3`)
          const sfxVolumeDb = scene.audioDescriptionVolume ?? -12

          log.step(`Cena ${index + 1}`, `Mixando SFX (${sfxVolumeDb}dB) com narração`)

          await new Promise<void>((resolve, reject) => {
            ffmpeg()
              .input(sceneAudioPath)
              .input(sfxPath)
              .complexFilter([
                // Narração em volume normal, SFX com volume ajustado
                `[1:a]volume=${sfxVolumeDb}dB[sfx]`,
                `[0:a][sfx]amix=inputs=2:duration=first:dropout_transition=2[out]`
              ])
              .outputOptions(['-map', '[out]', '-ac', '2', '-ar', '44100'])
              .output(mixedPath)
              .on('end', () => resolve())
              .on('error', (err) => {
                log.warn(`Mix SFX falhou na cena ${index + 1}: ${err.message}. Usando só narração.`)
                resolve() // Não falhar o render por causa de SFX
              })
              .run()
          })

          // Verificar se o mix foi criado com sucesso
          try {
            await fs.access(mixedPath)
            finalAudioPath = mixedPath
          } catch {
            log.warn(`Mix SFX não gerou arquivo na cena ${index + 1}; usando narração pura.`)
          }
        }

        // Descobrir o tempo do áudio de maneira simples e direta (ffprobe no arquivo real)
        const probedDuration = await new Promise<number>((resolve) => {
          ffmpeg.ffprobe(finalAudioPath, (err, metadata) => {
            if (err) {
              log.warn(`ffprobe duração da cena ${index + 1} falhou; usando DB.`, { err: err.message })
              return resolve(audioAsset.duration || 5)
            }
            resolve(metadata?.format?.duration || audioAsset.duration || 5)
          })
        })

        // Hook-only (especialmente a última cena): ElevenLabs pode adicionar silêncio residual ao final do MP3.
        // Para não "sobrar cena" depois da fala, usamos o fim da última palavra (alignment) + micro tail.
        let realDuration = probedDuration
        const isLastScene = index === output.scenes.length - 1
        if (isHookOnly && isLastScene) {
          const alignment = (audioAsset as any).alignment
          const lastEndTime = Array.isArray(alignment) && alignment.length > 0
            ? (alignment[alignment.length - 1] as any)?.endTime
            : null

          const HOOK_ONLY_AUDIO_TAIL_SECONDS = 0.08
          if (typeof lastEndTime === 'number' && Number.isFinite(lastEndTime) && lastEndTime > 0) {
            realDuration = Math.min(probedDuration, lastEndTime + HOOK_ONLY_AUDIO_TAIL_SECONDS)
            log.step(
              `Cena ${index + 1}`,
              `hook-only last-scene duration override: probed=${probedDuration.toFixed(3)}s -> spoken=${realDuration.toFixed(3)}s`
            )
          }
        }

        log.step(`Cena ${index + 1}`, `duração ${realDuration.toFixed(3)}s (visual + áudio sincronizados)`)

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
          log.warn(`Cena ${index + 1} sem imagem ou vídeo; pulando.`)
          continue
        }

        const sceneOutputPath = path.join(tempDir, `scene_${index}_final.mp4`)

        // Renderizar clipe da cena usando o tempo REAL detectado
        await this.renderSceneClip({
          visualPath: visualInputPath,
          audioPath: finalAudioPath,
          outputPath: sceneOutputPath,
          isVideo,
          width,
          height,
          duration: realDuration,
          visualDuration: isVideo ? await this.getVideoDuration(visualInputPath) : 0
        })

        scenePaths.push(sceneOutputPath)
        sceneDurations.push(realDuration)
      }

      if (scenePaths.length === 0) throw new Error('Falha ao gerar clipes das cenas')

      // 4. Concatenar todas as cenas
      log.info(`Concatenando ${scenePaths.length} cenas em vídeo único (temp).`)
      const concatenatedPath = path.join(tempDir, 'concatenated_no_bgm.mp4')
      await this.concatenateScenes(scenePaths, concatenatedPath)

      // 5. Mixar Background Music (se existir)
      // 5. Mixar Background Music (Posicionamento Temporal Correto)
      const bgmAudioTracks = await prisma.audioTrack.findMany({
        where: { outputId, type: 'background_music' },
        orderBy: { createdAt: 'asc' }
      })

      const script = await prisma.script.findUnique({
        where: { outputId },
        include: {
          backgroundMusicTracks: {
            orderBy: { startScene: 'asc' }
          }
        }
      })

      // Extrair render options para uso no BGM e pós-produção
      const opts = output.renderOptions as { includeLogo?: boolean; includeCaptions?: boolean; captionStyleId?: string | null; volumeOverride?: { global?: number; perTrack?: Record<number, number> } } | null

      if (bgmAudioTracks.length > 0) {
        const volumeOverride = opts?.volumeOverride ?? null
        const bgmVolume = volumeOverride?.global ?? script?.backgroundMusicVolume ?? -18
        log.info(`Mixando BGM: ${bgmAudioTracks.length} faixa(s), volume ${bgmVolume}dB${volumeOverride ? ' (override do usuário)' : ''}.`)

        const tracksToMix: { path: string, delayMs: number, volumeDb?: number }[] = []

        // Estratégia de pareamento: Ordem de criação do AudioTrack == Ordem de startScene do Script
        // Isso assume integridade do pipeline de criação. Falha graceful se desbalanceado.

        for (const [index, track] of bgmAudioTracks.entries()) {
          if (!track.fileData) continue

          const trackPath = path.join(tempDir, `bgm_track_${index}.mp3`)
          await fs.writeFile(trackPath, track.fileData)

          // Descobrir start time
          let startTime = 0

          if (bgmAudioTracks.length === 1 && (!script?.backgroundMusicTracks || script.backgroundMusicTracks.length === 0)) {
            // Caso legado ou música única global: começa no zero
            startTime = 0
          } else {
            // Caso múltiplo: usar metadados do script
            const meta = script?.backgroundMusicTracks?.[index]
            if (meta) {
              // Somar duração de todas as cenas ANTERIORES ao startScene
              const startSceneIndex = meta.startScene || 0
              // Proteção: não acessar índice fora do array de durações
              const safeIndex = Math.min(startSceneIndex, sceneDurations.length)
              startTime = sceneDurations.slice(0, safeIndex).reduce((acc, dur) => acc + dur, 0)
            } else {
              log.warn(`Metadados de BGM não encontrados para track ${index}; delay=0s.`)
            }
          }

          // Volume per-track: usar override individual se disponível, senão volume global
          const trackVolume = volumeOverride?.perTrack?.[index] ?? bgmVolume

          log.step(`BGM track ${index}`, `delay ${startTime.toFixed(2)}s, volume ${trackVolume}dB (startScene: ${script?.backgroundMusicTracks?.[index]?.startScene ?? 0})`)

          tracksToMix.push({
            path: trackPath,
            delayMs: Math.round(startTime * 1000), // adelay usa milissegundos
            volumeDb: trackVolume
          })
        }

        // Mixar usando filtro complexo com adelay
        await this.mixMultipleTracks(concatenatedPath, tracksToMix, finalPath, bgmVolume)
        log.info('BGM mixada com sucesso.')

      } else {
        log.info('Sem BGM; usando vídeo concatenado como final.')
        await fs.copyFile(concatenatedPath, finalPath)
      }

      log.info(`Vídeo final gerado em disco (temp): ${finalPath}.`)

      const stats = await fs.stat(finalPath)
      const MAX_DB_SIZE = 200 * 1024 * 1024 // 200MB — Limite de segurança para V8/Prisma
      // opts já declarado acima (antes do bloco de BGM)

      // Só carregamos em memória quando cabe no limite (e aplicamos legendas/logo antes de uma única gravação)
      if (stats.size <= MAX_DB_SIZE) {
        let videoBuffer = await fs.readFile(finalPath)

        if (opts) {
          const captionService = new CaptionService()
          if (opts.includeCaptions && opts.captionStyleId) {
            log.info('Aplicando legendas + logo no pipeline (antes de salvar).')
            const outputForCaptions = await prisma.output.findUnique({
              where: { id: outputId },
              select: {
                scenes: {
                  orderBy: { order: 'asc' },
                  select: {
                    order: true,
                    narration: true,
                    audioTracks: {
                      where: { type: 'scene_narration' },
                      select: { duration: true, fileData: true, alignment: true },
                      take: 1
                    }
                  }
                }
              }
            })
            type SceneWithTracks = { order: number; narration: string; audioTracks: Array<{ duration: number; fileData: Buffer | null; alignment: unknown }> }
            const scenesWithTracks = (outputForCaptions?.scenes ?? []) as unknown as SceneWithTracks[]
            const sceneCaptionData: SceneCaptionData[] = scenesWithTracks
              .filter(scene => scene.narration && scene.audioTracks[0])
              .map(scene => {
                const track = scene.audioTracks[0]!
                const wordTimings = Array.isArray(track.alignment)
                  ? (track.alignment as { word: string; startTime: number; endTime: number }[])
                  : undefined
                return {
                  narration: scene.narration,
                  audioDuration: track.duration || 5,
                  audioFileData: track.fileData ? Buffer.from(track.fileData) : undefined,
                  wordTimings,
                  order: scene.order
                }
              })
            if (sceneCaptionData.length > 0) {
              const result = await captionService.addCaptionsFromScenes(videoBuffer, sceneCaptionData, { styleId: opts.captionStyleId as CaptionStyleId })
              videoBuffer = Buffer.from(result.captionedBuffer)
            }
          } else if (opts.includeLogo) {
            log.info('Aplicando apenas logo no pipeline (antes de salvar).')
            videoBuffer = Buffer.from(await captionService.applyLogoOnly(videoBuffer))
          }
        }

        const finalSize = videoBuffer.length
        try {
          const sizeMB = (finalSize / 1024 / 1024).toFixed(1)
          log.info(`Salvando vídeo no PostgreSQL (${sizeMB} MB) — única gravação.`)

          await prisma.output.update({
            where: { id: outputId },
            data: {
              outputData: videoBuffer,
              outputMimeType: 'video/mp4',
              outputSize: finalSize,
              outputPath: null,
              status: 'RENDERED',
              completedAt: null,
              renderOptions: Prisma.DbNull
            }
          })

          await fs.unlink(finalPath).catch(() => { })
          log.info(`Vídeo salvo no banco com sucesso (${sizeMB} MB). Status=RENDERED.`)
        } catch (dbError) {
          log.error('Falha ao salvar no DB (limite memória); usando fallback em disco.', dbError)
          await fs.writeFile(finalPath, videoBuffer).catch(() => { })
          await prisma.output.update({
            where: { id: outputId },
            data: {
              outputData: null,
              outputMimeType: 'video/mp4',
              outputSize: finalSize,
              outputPath: finalPath,
              status: 'RENDERED',
              completedAt: null,
              renderOptions: Prisma.DbNull
            }
          })
          log.info(`Vídeo salvo em disco (fallback): ${finalPath}.`)
        }
      } else {
        const sizeMB = (stats.size / 1024 / 1024).toFixed(1)
        log.info(`Vídeo grande (${sizeMB} MB); processando legendas/logo em disco (sem carregar em memória).`)

        // Processar legendas/logo on-disk (FFmpeg path → path, sem Buffer)
        let processedPath = finalPath

        if (opts && (opts.includeCaptions || opts.includeLogo)) {
          const captionService = new CaptionService()
          const postProcessedPath = finalPath.replace('.mp4', '_pp.mp4')

          if (opts.includeCaptions && opts.captionStyleId) {
            log.info('[OnDisk] Aplicando legendas + logo no vídeo grande.')
            const outputForCaptions = await prisma.output.findUnique({
              where: { id: outputId },
              select: {
                scenes: {
                  orderBy: { order: 'asc' },
                  select: {
                    order: true,
                    narration: true,
                    audioTracks: {
                      where: { type: 'scene_narration' },
                      select: { duration: true, fileData: true, alignment: true },
                      take: 1
                    }
                  }
                }
              }
            })
            type SceneWithTracks = { order: number; narration: string; audioTracks: Array<{ duration: number; fileData: Buffer | null; alignment: unknown }> }
            const scenesWithTracks = (outputForCaptions?.scenes ?? []) as unknown as SceneWithTracks[]
            const sceneCaptionData: SceneCaptionData[] = scenesWithTracks
              .filter(scene => scene.narration && scene.audioTracks[0])
              .map(scene => {
                const track = scene.audioTracks[0]!
                const wordTimings = Array.isArray(track.alignment)
                  ? (track.alignment as { word: string; startTime: number; endTime: number }[])
                  : undefined
                return {
                  narration: scene.narration,
                  audioDuration: track.duration || 5,
                  audioFileData: track.fileData ? Buffer.from(track.fileData) : undefined,
                  wordTimings,
                  order: scene.order
                }
              })
            if (sceneCaptionData.length > 0) {
              await captionService.addCaptionsFromScenesOnDisk(
                finalPath, postProcessedPath, sceneCaptionData,
                { styleId: opts.captionStyleId as CaptionStyleId }
              )
              processedPath = postProcessedPath
            }
          } else if (opts.includeLogo) {
            log.info('[OnDisk] Aplicando apenas logo no vídeo grande.')
            await captionService.applyLogoOnlyOnDisk(finalPath, postProcessedPath)
            processedPath = postProcessedPath
          }
        }

        // Verificar tamanho final após pós-processamento
        const finalStats = await fs.stat(processedPath)
        const finalSizeMB = (finalStats.size / 1024 / 1024).toFixed(1)

        // Tentar salvar no DB; se falhar (muito grande), manter em disco
        if (finalStats.size <= MAX_DB_SIZE) {
          log.info(`[OnDisk] Pós-processado (${finalSizeMB} MB) cabe no banco; salvando.`)
          const videoBuffer = await fs.readFile(processedPath)
          await prisma.output.update({
            where: { id: outputId },
            data: {
              outputData: videoBuffer,
              outputMimeType: 'video/mp4',
              outputSize: finalStats.size,
              outputPath: null,
              status: 'RENDERED',
              completedAt: null,
              renderOptions: Prisma.DbNull
            }
          })
          // Limpar arquivos de disco
          await fs.unlink(finalPath).catch(() => { })
          if (processedPath !== finalPath) await fs.unlink(processedPath).catch(() => { })
        } else {
          // Se ainda é grande demais para o banco, mover o pós-processado para o path final
          if (processedPath !== finalPath) {
            await fs.rename(processedPath, finalPath).catch(async () => {
              await fs.copyFile(processedPath, finalPath)
              await fs.unlink(processedPath).catch(() => { })
            })
          }
          log.info(`[OnDisk] Vídeo grande (${finalSizeMB} MB) salvo em disco com legendas/logo: ${finalPath}`)
          await prisma.output.update({
            where: { id: outputId },
            data: {
              outputData: null,
              outputMimeType: 'video/mp4',
              outputSize: finalStats.size,
              outputPath: finalPath,
              status: 'RENDERED',
              completedAt: null,
              renderOptions: Prisma.DbNull
            }
          })
        }
      }

      return { success: true }

    } catch (error: unknown) {
      const log = createPipelineLogger({ stage: 'Render', outputId })
      log.error('Erro na renderização.', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (err) {
        const log = createPipelineLogger({ stage: 'Render', outputId })
        log.warn('Falha na limpeza de arquivos temporários.', { err: err instanceof Error ? err.message : String(err) })
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
        // Calcular fator de time-stretch para sincronizar visual com áudio
        // Factor = Target / Source
        // Ex: Target 10s, Source 5s -> Factor 2 -> setpts=2*PTS (Slow motion)
        const timeStretchFactor = options.visualDuration > 0 ? (options.duration / options.visualDuration) : 1

        console.log(`[VideoPipeline] 🐢 Time-Stretch: Source=${options.visualDuration.toFixed(2)}s, Target=${options.duration.toFixed(2)}s, Factor=${timeStretchFactor.toFixed(2)}x`)

        // Limitar o fator de time-stretch para evitar slow-motion extremo
        const MAX_STRETCH = 4.0
        const effectiveFactor = Math.min(timeStretchFactor, MAX_STRETCH)
        if (timeStretchFactor > MAX_STRETCH) {
          console.warn(`[VideoPipeline] ⚠️ Time-Stretch limitado de ${timeStretchFactor.toFixed(2)}x para ${MAX_STRETCH}x (máximo permitido)`)
        }

        videoFilters.push(`setpts=${effectiveFactor}*PTS`)

        // Manter 16fps nativo do Wan Video — sem interpolação, sem overhead
        // Evita travadas causadas por conversão de FPS e mantém estética cinematográfica

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
          '-r 16', // Frame rate nativo do Wan Video (16fps) — sem conversão
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
        .inputOptions(['-stream_loop', '-1']) // Loop infinito do BGM (cortado pelo duration=first do amix)
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
   * Re-encoda para garantir keyframes alinhados e transições suaves entre cenas
   */
  private concatenateScenes(inputs: string[], outputPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Usar concat demuxer para combinar cenas
      const listPath = path.join(path.dirname(outputPath), 'concat_list.txt')
      const content = inputs.map(p => `file '${path.resolve(p).replace(/\\/g, '/')}'`).join('\n')

      try {
        await fs.writeFile(listPath, content)

        ffmpeg()
          .input(listPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions([
            // Re-encodar para garantir keyframes uniformes entre cenas
            '-c:v libx264',
            '-preset fast',          // Bom equilíbrio entre velocidade e qualidade
            '-crf 18',               // Qualidade alta (menor = melhor, 18 é visualmente lossless)
            '-g 16',                 // Keyframe a cada 16 frames (1s a 16fps) - evita travadas entre cenas
            '-r 16',                 // Frame rate nativo do Wan Video (16fps)
            '-pix_fmt yuv420p',
            '-c:a aac',
            '-ar 44100',
            '-b:a 192k'
          ])
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
  /**
   * Concatena múltiplos arquivos de áudio em um só
   */
  /**
   * Mixa múltiplas faixas de áudio no vídeo usando adelay e amix
   */
  private mixMultipleTracks(
    videoPath: string,
    audioTracks: { path: string; delayMs: number; volumeDb?: number }[],
    outputPath: string,
    volumeDb: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = ffmpeg().input(videoPath)

      // Adicionar inputs de áudio
      audioTracks.forEach(t => cmd.input(t.path))

      // Construir filter_complex
      // [0:a] é o áudio do vídeo original (narração)
      // [1:a], [2:a]... são as músicas

      const filterParts: string[] = []
      const mixInputs: string[] = ['[0:a]'] // Começa com a narração

      audioTracks.forEach((track, i) => {
        const inputIndex = i + 1 // 0 é o vídeo
        // Aplicar delay e volume em CADA faixa separadamente (com override individual se disponível)
        // adelay=DELAY|DELAY (para estéreo)
        const trackVol = track.volumeDb ?? volumeDb
        filterParts.push(`[${inputIndex}:a]adelay=${track.delayMs}|${track.delayMs},volume=${trackVol}dB[delayed${i}]`)
        mixInputs.push(`[delayed${i}]`)
      })

      // Mixar tudo: narração + faixas delayeds
      // inputs=N+1 (narração + qtd músicas)
      // duration=first (duração do vídeo manda)
      // dropout_transition=2 (transição suave se um acabar)
      // Espaço antes de [aout] evita que ffmpeg interprete "1[aout]" como um único argumento (Invalid argument)
      filterParts.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2:weights=3${' 1'.repeat(mixInputs.length - 1)} [aout]`)

      cmd
        .outputOptions([
          '-filter_complex', filterParts.join(';'),
          '-map', '0:v',      // Usa vídeo original
          '-map', '[aout]',   // Usa áudio mixado
          '-c:v', 'copy',     // Não re-encoda vídeo
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
}

export const videoPipelineService = new VideoPipelineService()
