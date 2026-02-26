/**
 * Music Events Stage
 *
 * Generates short audio stingers/risers/drops based on the Edit Blueprint
 * produced by Retention QA (Stage 2.5).
 *
 * Each music event is stored as an AudioTrack with type='music_event'
 * and an offsetMs indicating its absolute position in the final timeline.
 * The video-pipeline.service mixes them during render.
 *
 * Silence events are skipped (no audio needed — handled in render as volume ducks).
 */

import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../providers'
import { costLogService } from '../../cost-log.service'
import { createPipelineLogger } from '../../../utils/pipeline-logger'
import type { RetentionQAResult, EditBlueprintMusicEvent } from '../../../types/retention-qa'

const CONCURRENCY_LIMIT = 3
const MAX_STINGER_DURATION = 2 // seconds

// ---- Interfaces --------------------------------------------------------

export interface MusicEventsStageInput {
  outputId: string
}

// ---- Stage -------------------------------------------------------------

class MusicEventsStage {

  async execute(input: MusicEventsStageInput): Promise<void> {
    const { outputId } = input
    const log = createPipelineLogger({ stage: 'MusicEvents', outputId })
    log.info('Starting music events generation from Edit Blueprint.')

    // 1. Load retentionQA from RetentionQAProduct
    const retentionQAProduct = await prisma.retentionQAProduct.findUnique({
      where: { outputId },
      select: { analysisData: true }
    })

    if (!retentionQAProduct?.analysisData) {
      log.info('No retentionQA data found; skipping music events.')
      return
    }

    const qa = retentionQAProduct.analysisData as unknown as RetentionQAResult
    const musicEvents = qa.editBlueprint?.musicEvents

    if (!musicEvents || musicEvents.length === 0) {
      log.info('Edit Blueprint has no music events; skipping.')
      return
    }

    // 2. Filter out silence events (no audio to generate) and already-generated events
    const existingTracks = await prisma.audioTrack.findMany({
      where: { outputId, type: 'music_event' },
      select: { offsetMs: true }
    })
    const existingOffsets = new Set(existingTracks.map(t => t.offsetMs))

    const pending = musicEvents.filter(ev => {
      if (ev.type === 'silence') return false
      const offsetMs = Math.round(ev.atSecond * 1000)
      if (existingOffsets.has(offsetMs)) {
        log.info(`Event at ${ev.atSecond}s (${ev.type}) already generated; skipping.`)
        return false
      }
      return true
    })

    if (pending.length === 0) {
      log.info('All music events already generated or only silence events.')
      return
    }

    log.info(`${pending.length} music events to generate (${musicEvents.filter(e => e.type === 'silence').length} silence events skipped).`)

    // 3. Generate in chunks
    const sfxProvider = providerManager.getSFXProvider()
    const chunks = this.chunk(pending, CONCURRENCY_LIMIT)

    let successCount = 0
    let errorCount = 0

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(event =>
          this.generateEvent(event, sfxProvider, outputId, log)
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          errorCount++
          log.error(`Music event failed: ${result.reason?.message?.slice(0, 100) || result.reason}`)
        }
      }
    }

    log.info(`Music events complete: ${successCount} OK, ${errorCount} errors out of ${pending.length}.`)
  }

  // ---- Private: generate single event -----------------------------------

  private async generateEvent(
    event: EditBlueprintMusicEvent,
    sfxProvider: ReturnType<typeof providerManager.getSFXProvider>,
    outputId: string,
    log: ReturnType<typeof createPipelineLogger>
  ): Promise<void> {
    const prompt = this.buildPrompt(event)
    const duration = this.getDuration(event)
    const offsetMs = Math.round(event.atSecond * 1000)

    log.step(
      `Event @${event.atSecond}s`,
      `type=${event.type}, scene=${event.sceneOrder}, dur=${duration}s, prompt="${prompt.slice(0, 60)}..."`
    )

    const response = await sfxProvider.generate({
      prompt,
      durationSeconds: duration,
      promptInfluence: 0.5 // Higher influence for precision stingers
    })

    await prisma.audioTrack.create({
      data: {
        outputId,
        sceneId: null, // Music events are timeline-based, not scene-based
        type: 'music_event',
        provider: sfxProvider.getName().toUpperCase() as any,
        fileData: Buffer.from(response.audioBuffer) as any,
        mimeType: 'audio/mpeg',
        originalSize: response.audioBuffer.length,
        duration: response.duration,
        offsetMs
      }
    })

    // Cost logging (fire-and-forget)
    costLogService.log({
      outputId,
      resource: 'music_event',
      action: 'create',
      provider: response.costInfo.provider,
      model: response.costInfo.model,
      cost: response.costInfo.cost,
      metadata: {
        type: event.type,
        atSecond: event.atSecond,
        sceneOrder: event.sceneOrder,
        durationSeconds: duration
      }
    }).catch(() => {})
  }

  // ---- Private: prompt building -----------------------------------------

  private buildPrompt(event: EditBlueprintMusicEvent): string {
    if (event.prompt) return event.prompt

    // Default prompts by type
    switch (event.type) {
      case 'stinger':
        return 'Short dramatic stinger hit, cinematic impact sound, brass and percussion, 0.3 seconds'
      case 'riser':
        return 'Tension building riser, cinematic suspense, rising pitch with subtle reverb, builds anticipation'
      case 'drop':
        return 'Heavy bass drop impact, cinematic low-end thump with sub-bass rumble, dramatic reveal moment'
      default:
        return 'Short cinematic sound effect, dramatic impact'
    }
  }

  private getDuration(event: EditBlueprintMusicEvent): number {
    switch (event.type) {
      case 'stinger':
        return 0.5
      case 'riser':
        return MAX_STINGER_DURATION
      case 'drop':
        return 0.8
      default:
        return 1
    }
  }

  // ---- Private: utility -------------------------------------------------

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

export const musicEventsStage = new MusicEventsStage()
