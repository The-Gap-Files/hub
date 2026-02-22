/**
 * Motion Generation Stage
 * -----------------------------------------------------------------------
 * Generates image-to-video motion for scenes. Supports two flows:
 *
 * 1. Batch generation (execute): processes ALL scenes of an output
 *    with concurrent batching (CONCURRENCY_LIMIT = 50).
 * 2. Single-scene regeneration (regenerateScene): correction flow
 *    that deselects previous videos and creates a new selected one.
 *
 * Extracted from output-pipeline.service.ts (generateMotion + regenerateSceneMotion).
 */

import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../providers'
import { costLogService } from '../../cost-log.service'
import { validateMediaPricing } from '../../../constants/pricing'
import type { MotionGenerationRequest } from '../../../types/ai-providers'

const LOG = '[MotionStage]'
const CONCURRENCY_LIMIT = 50
const DEFAULT_DURATION = 5
const DEFAULT_ASPECT_RATIO = '16:9'

// ---- Interfaces --------------------------------------------------------

export interface MotionStageInput {
  outputId: string
  aspectRatio?: string | null
}

// ---- Helpers -----------------------------------------------------------

function findStartImage(images: Array<{ id: string; role: string | null; fileData: Buffer | null }>) {
  return images.find(img => img.role === 'start') || images[0]
}

function findEndImage(images: Array<{ id: string; role: string | null; fileData: Buffer | null }>) {
  return images.find(img => img.role === 'end')
}

function resolveMotionPrompt(scene: { motionDescription: string | null; visualDescription: string }) {
  return scene.motionDescription || scene.visualDescription
}

function resolveDuration(audioTracks: Array<{ duration: number | null }>, estimatedDuration: number | null): number {
  return audioTracks[0]?.duration ?? estimatedDuration ?? DEFAULT_DURATION
}

function buildMotionRequest(
  startImage: { fileData: Buffer | null },
  endImage: { fileData: Buffer | null } | undefined,
  prompt: string,
  duration: number,
  aspectRatio: string
): MotionGenerationRequest {
  return {
    imageBuffer: Buffer.from(startImage.fileData!) as any,
    endImageBuffer: endImage?.fileData ? Buffer.from(endImage.fileData) as any : undefined,
    prompt,
    duration,
    aspectRatio,
  }
}

function buildSceneVideoData(
  sceneId: string,
  providerName: string,
  prompt: string,
  videoResponse: any,
  sourceImageId: string
) {
  return {
    sceneId,
    provider: providerName as any,
    promptUsed: prompt,
    fileData: Buffer.from(videoResponse.video.videoBuffer) as any,
    mimeType: 'video/mp4',
    originalSize: videoResponse.video.videoBuffer.length,
    duration: videoResponse.video.duration || DEFAULT_DURATION,
    sourceImageId,
    isSelected: true,
    variantIndex: 0,
  }
}

// ---- Stage -------------------------------------------------------------

class MotionGenerationStage {

  /**
   * Batch generate motion for all scenes of an output.
   * Processes scenes in chunks of CONCURRENCY_LIMIT (50).
   */
  async execute(input: MotionStageInput): Promise<void> {
    const { outputId } = input

    // 1. Load output context (only aspectRatio needed)
    const output = await prisma.output.findUniqueOrThrow({
      where: { id: outputId },
      select: { aspectRatio: true },
    })

    // 2. Resolve motion provider and validate pricing
    const motionProvider = providerManager.getMotionProvider()
    const motionModel = (motionProvider as any).model || 'wan-video/wan-2.2-i2v-fast'
    validateMediaPricing(motionModel, motionProvider.getName())

    // 3. Load scenes with selected images and narration audio
    const scenes = await prisma.scene.findMany({
      where: { outputId },
      include: {
        images: { where: { isSelected: true } },
        audioTracks: { where: { type: 'scene_narration' } },
      },
      orderBy: { order: 'asc' },
    })

    // 4. Chunk scenes for concurrent batching
    const sceneChunks: typeof scenes[] = []
    for (let i = 0; i < scenes.length; i += CONCURRENCY_LIMIT) {
      sceneChunks.push(scenes.slice(i, i + CONCURRENCY_LIMIT))
    }

    const aspectRatio = output.aspectRatio || DEFAULT_ASPECT_RATIO

    // 5. Process each chunk concurrently
    for (const chunk of sceneChunks) {
      await Promise.all(chunk.map(scene =>
        this.processScene(scene, aspectRatio, motionProvider, outputId, scenes.length)
      ))
    }
  }

  /**
   * Regenerate motion for a single scene (correction flow).
   * Deselects previous videos and creates a new selected one.
   */
  async regenerateScene(sceneId: string): Promise<any> {
    console.log(`${LOG} Regenerating motion for scene ${sceneId}`)

    // 1. Load scene with selected images, narration audio, and parent output
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        images: { where: { isSelected: true } },
        audioTracks: { where: { type: 'scene_narration' } },
        output: { include: { seed: true } },
      },
    })

    if (!scene) throw new Error('Scene not found')
    if (!scene.images[0]?.fileData) throw new Error('Scene has no selected image for motion generation')

    const startImage = findStartImage(scene.images as any)
    if (!startImage) throw new Error('Start image not found')

    const endImage = findEndImage(scene.images as any)
    const output = scene.output

    // 2. Resolve motion provider and validate pricing
    const motionProvider = providerManager.getMotionProvider()
    const motionModel = (motionProvider as any).model || 'wan-video/wan-2.2-i2v-fast'
    validateMediaPricing(motionModel, motionProvider.getName())

    // 3. Deselect previous videos for this scene
    await prisma.sceneVideo.updateMany({
      where: { sceneId },
      data: { isSelected: false },
    })

    // 4. Build request and generate motion
    const motionPrompt = resolveMotionPrompt(scene as any)
    const durationSeconds = resolveDuration(scene.audioTracks as any, scene.estimatedDuration)
    const aspectRatio = output.aspectRatio || DEFAULT_ASPECT_RATIO

    const request = buildMotionRequest(startImage as any, endImage as any, motionPrompt, durationSeconds, aspectRatio)

    if (endImage?.fileData) {
      console.log(`${LOG} Scene ${scene.order + 1} - last_image detected for regeneration`)
    }

    console.log(`${LOG} Regenerating motion for scene ${scene.order + 1} (${sceneId}, duration: ${durationSeconds.toFixed(1)}s)`)
    const videoResponse = await motionProvider.generate(request)

    // 5. Save new SceneVideo (selected)
    const newVideo = await prisma.sceneVideo.create({
      data: buildSceneVideoData(sceneId, motionProvider.getName(), motionPrompt, videoResponse, startImage.id),
    })

    // 6. Cost logging (fire-and-forget)
    this.logCost(output.id, videoResponse, 'recreate', `Scene ${scene.order + 1} - motion regeneration (correction)`)

    console.log(`${LOG} Motion regenerated for scene ${sceneId}`)

    return newVideo
  }

  // ---- Private ---------------------------------------------------------

  /**
   * Process a single scene within the batch execute flow.
   */
  private async processScene(
    scene: any,
    aspectRatio: string,
    motionProvider: any,
    outputId: string,
    totalScenes: number
  ): Promise<void> {
    const startImage = findStartImage(scene.images)
    if (!startImage?.fileData) return

    const endImage = findEndImage(scene.images)
    const motionPrompt = resolveMotionPrompt(scene)
    const durationSeconds = resolveDuration(scene.audioTracks, scene.estimatedDuration)

    const request = buildMotionRequest(startImage as any, endImage as any, motionPrompt, durationSeconds, aspectRatio)

    if (endImage?.fileData) {
      console.log(`${LOG} Motion scene ${scene.order + 1} - last_image detected, using start+end frame conditioning`)
    }

    console.log(`${LOG} Motion scene ${scene.order + 1} (duration: ${durationSeconds.toFixed(1)}s) prompt: ${motionPrompt.slice(0, 80)}...`)
    const videoResponse = await motionProvider.generate(request)

    // Save SceneVideo
    await prisma.sceneVideo.create({
      data: buildSceneVideoData(scene.id, motionProvider.getName(), motionPrompt, videoResponse, startImage.id),
    })

    // Cost logging (fire-and-forget)
    this.logCost(outputId, videoResponse, 'create', `Scene ${scene.order + 1}/${totalScenes} - motion generation`)
  }

  /**
   * Fire-and-forget cost logging using costInfo from the provider response.
   */
  private logCost(outputId: string, videoResponse: any, action: 'create' | 'recreate', detail: string): void {
    costLogService.log({
      outputId,
      resource: 'motion',
      action,
      provider: videoResponse.costInfo.provider,
      model: videoResponse.costInfo.model,
      cost: videoResponse.costInfo.cost,
      metadata: videoResponse.costInfo.metadata,
      detail,
    }).catch(() => { })
  }
}

export const motionGenerationStage = new MotionGenerationStage()
