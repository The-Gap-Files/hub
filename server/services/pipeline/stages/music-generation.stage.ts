/**
 * Music Generation Stage
 * Generates background music (BGM) via music provider.
 * Supports single-track (TikTok/Instagram) and multi-track (YouTube Cinematic).
 */

import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../providers'
import { costLogService } from '../../cost-log.service'
import { validateMediaPricing } from '../../../constants/pricing'
import { createPipelineLogger } from '../../../utils/pipeline-logger'
import type { MusicGenerationRequest } from '../../../types/ai-providers'

const LOG = '[MusicStage]'

const STABLE_AUDIO_MAX_DURATION = 190

// ---- Interfaces --------------------------------------------------------

export interface MusicStageInput {
  outputId: string
  outputDuration?: number | null
}

// ---- Stage -------------------------------------------------------------

class MusicGenerationStage {
  async execute(input: MusicStageInput): Promise<void> {
    const { outputId } = input
    const log = createPipelineLogger({ stage: 'BGM', outputId })
    log.info('Generating background music.')

    // Load script with background music tracks
    const script = await prisma.script.findUnique({
      where: { outputId },
      include: { backgroundMusicTracks: true },
    })

    if (!script) {
      throw new Error(`${LOG} Script not found. Generate script first.`)
    }

    // Skip if BGM already exists
    const existingBgm = await prisma.audioTrack.findFirst({
      where: { outputId, type: 'background_music' },
    })

    if (existingBgm) {
      log.info('BGM already exists; skipping.')
      return
    }

    const musicProvider = providerManager.getMusicProvider()

    // Validate pricing before spending
    const musicModel = (musicProvider as any).model || 'stability-ai/stable-audio-2.5'
    validateMediaPricing(musicModel, musicProvider.getName())

    // Calculate REAL narration duration from generated narration tracks (not estimated)
    const narrationTracks = await prisma.audioTrack.findMany({
      where: { outputId, type: 'scene_narration' },
      select: { duration: true },
    })

    let totalNarrationDuration = 0
    if (narrationTracks.length > 0) {
      totalNarrationDuration = narrationTracks.reduce((acc, t) => acc + (t.duration || 5), 0)
      log.info(`Real narration duration: ${totalNarrationDuration.toFixed(2)}s (${narrationTracks.length} scenes).`)
    }

    // Use real narration duration, fallback to estimated output duration
    const videoDuration = totalNarrationDuration > 0
      ? Math.ceil(totalNarrationDuration)
      : (input.outputDuration || 120)

    log.info(`Target music duration: ${videoDuration}s (based on narration).`)

    // CASE 1: Single BGM for the entire video (TikTok/Instagram)
    if (script.backgroundMusicPrompt) {
      await this.generateSingleTrack(outputId, script, videoDuration, musicProvider, log)
    }
    // CASE 2: Multiple tracks per scene segment (YouTube Cinematic)
    else if (script.backgroundMusicTracks && script.backgroundMusicTracks.length > 0) {
      await this.generateMultiTracks(outputId, script.backgroundMusicTracks, narrationTracks, musicProvider, log)
    } else {
      log.warn('No BGM prompt in script; skipping.')
    }
  }

  // ---- Single track (full video) ----------------------------------------

  private async generateSingleTrack(
    outputId: string,
    script: { backgroundMusicPrompt: string | null; backgroundMusicVolume: number | null },
    videoDuration: number,
    musicProvider: ReturnType<typeof providerManager.getMusicProvider>,
    log: ReturnType<typeof createPipelineLogger>,
  ): Promise<void> {
    const duration = Math.min(STABLE_AUDIO_MAX_DURATION, videoDuration)

    log.step('Single track (full video)', `${duration}s, volume ${script.backgroundMusicVolume}dB`)
    log.info(`BGM prompt: "${(script.backgroundMusicPrompt || '').slice(0, 60)}..."`)

    const request: MusicGenerationRequest = {
      prompt: script.backgroundMusicPrompt!,
      duration,
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
        duration: musicResponse.duration,
      },
    })

    // Log cost (fire-and-forget) using costInfo from provider
    costLogService.log({
      outputId,
      resource: 'bgm',
      action: 'create',
      provider: musicResponse.costInfo.provider,
      model: musicResponse.costInfo.model,
      cost: musicResponse.costInfo.cost,
      metadata: musicResponse.costInfo.metadata,
      detail: `Background music (full video) - ${duration}s audio`,
    }).catch(() => { })

    log.info(`BGM generated: ${(musicResponse.audioBuffer.length / 1024).toFixed(0)} KB.`)
  }

  // ---- Multi tracks (per scene segment) ---------------------------------

  private async generateMultiTracks(
    outputId: string,
    backgroundMusicTracks: Array<{
      prompt: string
      volume: number | null
      startScene: number | null
      endScene: number | null
    }>,
    narrationTracks: Array<{ duration: number | null }>,
    musicProvider: ReturnType<typeof providerManager.getMusicProvider>,
    log: ReturnType<typeof createPipelineLogger>,
  ): Promise<void> {
    log.info(`${backgroundMusicTracks.length} BGM track(s) (per scene segment).`)

    // Build array with real duration of each scene (from narration)
    const sceneDurations = narrationTracks.map((t) => t.duration || 5)
    const totalScenes = sceneDurations.length

    for (const track of backgroundMusicTracks) {
      const start = track.startScene || 0
      const end = track.endScene !== null && track.endScene !== undefined
        ? track.endScene
        : totalScenes - 1

      // Sum real durations of scenes in this segment
      const segmentDuration = sceneDurations
        .slice(start, end + 1)
        .reduce((acc, d) => acc + d, 0)

      const trackDuration = Math.min(STABLE_AUDIO_MAX_DURATION, Math.ceil(segmentDuration))

      log.step(
        `Track scenes ${start}-${end}`,
        `${end - start + 1} scenes, ${trackDuration}s, ${track.volume}dB`,
      )
      log.info(`Prompt: "${(track.prompt || '').slice(0, 50)}..."`)

      const request: MusicGenerationRequest = {
        prompt: track.prompt,
        duration: trackDuration,
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
          duration: musicResponse.duration,
        },
      })

      // Log cost (fire-and-forget) using costInfo from provider
      costLogService.log({
        outputId,
        resource: 'bgm',
        action: 'create',
        provider: musicResponse.costInfo.provider,
        model: musicResponse.costInfo.model,
        cost: musicResponse.costInfo.cost,
        metadata: musicResponse.costInfo.metadata,
        detail: `BGM track scenes ${start}-${end} - ${trackDuration}s audio`,
      }).catch(() => { })

      log.info(`Track generated: ${(musicResponse.audioBuffer.length / 1024).toFixed(0)} KB.`)
    }
  }
}

export const musicGenerationStage = new MusicGenerationStage()
