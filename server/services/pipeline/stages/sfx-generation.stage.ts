/**
 * SFX Generation Stage
 * Generates sound effects for scenes with audioDescription.
 * Duration matches narration exactly via FFmpeg post-processing.
 */

import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../providers'
import { costLogService } from '../../cost-log.service'
import { createPipelineLogger } from '../../../utils/pipeline-logger'
import { adjustSfxDuration } from './_shared/adjust-sfx-duration'

const LOG = '[SFXStage]'

const CONCURRENCY_LIMIT = 3
const ELEVENLABS_MAX_DURATION_SECONDS = 22

// ---- Interfaces --------------------------------------------------------

export interface SFXStageInput {
  outputId: string
}

// ---- Stage -------------------------------------------------------------

class SFXGenerationStage {

  async execute(input: SFXStageInput): Promise<void> {
    const { outputId } = input
    const log = createPipelineLogger({ stage: 'SFX', outputId })
    log.info('Starting SFX generation per scene.')

    const scenes = await this.loadScenes(outputId)
    const pending = this.filterPendingScenes(scenes, log)

    if (pending.length === 0) {
      log.info('No scenes require SFX (no audioDescription or already generated).')
      return
    }

    log.info(`${pending.length}/${scenes.length} scenes queued for SFX generation.`)

    const sfxProvider = providerManager.getSFXProvider()
    const chunks = this.chunk(pending, CONCURRENCY_LIMIT)

    let successCount = 0
    let errorCount = 0

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(scene =>
          this.generateForScene(scene, sfxProvider, outputId, log)
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          errorCount++
          log.error(`SFX failed: ${result.reason?.message?.slice(0, 100) || result.reason}`)
        }
      }
    }

    log.info(`SFX complete: ${successCount} OK, ${errorCount} errors out of ${pending.length} scenes.`)
  }

  // ---- Private: data loading -------------------------------------------

  private async loadScenes(outputId: string) {
    return prisma.scene.findMany({
      where: { outputId },
      orderBy: { order: 'asc' },
      include: {
        audioTracks: {
          where: { type: { in: ['scene_narration', 'scene_sfx'] } }
        }
      }
    })
  }

  // ---- Private: filtering ----------------------------------------------

  private filterPendingScenes(
    scenes: Awaited<ReturnType<typeof this.loadScenes>>,
    log: ReturnType<typeof createPipelineLogger>
  ) {
    return scenes.filter(scene => {
      const hasPrompt = scene.audioDescription && scene.audioDescription.trim().length > 0
      const alreadyHasSFX = scene.audioTracks.some(t => t.type === 'scene_sfx')

      if (alreadyHasSFX) {
        log.info(`Scene ${scene.order + 1}: SFX already exists, skipping.`)
      }

      return hasPrompt && !alreadyHasSFX
    })
  }

  // ---- Private: per-scene generation -----------------------------------

  private async generateForScene(
    scene: Awaited<ReturnType<typeof this.loadScenes>>[number],
    sfxProvider: ReturnType<typeof providerManager.getSFXProvider>,
    outputId: string,
    log: ReturnType<typeof createPipelineLogger>
  ): Promise<void> {
    const narrationTrack = scene.audioTracks.find(t => t.type === 'scene_narration')

    if (!narrationTrack?.duration) {
      log.warn(`Scene ${scene.order + 1}: no narration with duration, skipping SFX.`)
      return
    }

    const narrationDuration = narrationTrack.duration
    // ElevenLabs SFX accepts up to 22s; cap at maximum when narration exceeds it
    const sfxRequestDuration = Math.min(ELEVENLABS_MAX_DURATION_SECONDS, narrationDuration)

    log.step(
      `Scene ${scene.order + 1}`,
      `"${scene.audioDescription!.slice(0, 60)}..." | ${narrationDuration.toFixed(1)}s (req=${sfxRequestDuration.toFixed(1)}s), vol=${scene.audioDescriptionVolume ?? -12}dB`
    )

    const sfxResponse = await sfxProvider.generate({
      prompt: scene.audioDescription!,
      durationSeconds: sfxRequestDuration,
      promptInfluence: 0.3
    })

    // Post-process: adjust duration to match narration exactly (trim or pad with silence)
    const finalBuffer = await this.postProcessDuration(
      sfxResponse.audioBuffer,
      narrationDuration,
      scene.order,
      log
    )

    await prisma.audioTrack.create({
      data: {
        outputId,
        sceneId: scene.id,
        type: 'scene_sfx',
        provider: sfxProvider.getName().toUpperCase() as any,
        fileData: Buffer.from(finalBuffer) as any,
        mimeType: 'audio/mpeg',
        originalSize: finalBuffer.length,
        duration: narrationDuration
      }
    })

    // Cost logging (fire-and-forget)
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
  }

  // ---- Private: FFmpeg duration adjustment ------------------------------

  private async postProcessDuration(
    audioBuffer: Buffer | Uint8Array,
    targetDuration: number,
    sceneOrder: number,
    log: ReturnType<typeof createPipelineLogger>
  ): Promise<Buffer | Uint8Array> {
    try {
      const adjusted = await adjustSfxDuration(Buffer.from(audioBuffer), targetDuration)
      log.info(`Scene ${sceneOrder + 1}: SFX adjusted to ${targetDuration.toFixed(1)}s exact.`)
      return adjusted
    } catch (ffmpegErr) {
      log.warn(`Scene ${sceneOrder + 1}: Failed to adjust SFX duration, using original. ${ffmpegErr}`)
      return audioBuffer
    }
  }

  // ---- Private: array chunking -----------------------------------------

  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size))
    }
    return chunks
  }
}

export const sfxGenerationStage = new SFXGenerationStage()
