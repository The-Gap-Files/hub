import Replicate from 'replicate'
import fs from 'node:fs/promises'
import type {
  IMotionProvider,
  MotionGenerationRequest,
  MotionGenerationResponse,
  GeneratedMotion,
  ProviderCostInfo
} from '../../../types/ai-providers'
import { calculateReplicateOutputCost, calculateReplicateTimeCost } from '../../../constants/pricing'
import { buildMotionInput, type MotionInputContext } from '../../../utils/input-schema-builder'

/** Wan 2.2 5B: num_frames entre 81-121 (5s-7.5s @ 16fps) */
const FPS = 16
const MIN_FRAMES = 81
const MAX_FRAMES = 121

function durationToNumFrames(durationSeconds: number): number {
  const frames = Math.round(durationSeconds * FPS)
  return Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, frames))
}

/**
 * Replicate Motion Provider
 * Uses Wan Video 2.2 I2V Fast via Replicate API (image-to-video)
 * Model: wan-video/wan-2.2-i2v-fast
 * Schema: required prompt+image; num_frames 81-121, resolution 480p|720p, sample_shift 1-20, etc.
 */
export class ReplicateMotionProvider implements IMotionProvider {
  private client: Replicate
  private model: string
  private inputSchema: any = null

  constructor(config: { apiKey: string; model?: string; inputSchema?: any }) {
    if (!config.apiKey) {
      throw new Error('Replicate API key is required')
    }
    this.client = new Replicate({ auth: config.apiKey })
    this.model = config.model || 'wan-video/wan-2.2-i2v-fast'
    this.inputSchema = config.inputSchema ?? null
  }

  getName(): string {
    return 'REPLICATE'
  }

  async generate(request: MotionGenerationRequest): Promise<MotionGenerationResponse> {
    try {
      console.log(`[ReplicateMotion] Generating video from image`)

      let input: any
      let calculatedDuration: number

      if (this.inputSchema) {
        // Dynamic: build from schema
        const result = buildMotionInput(this.inputSchema, {
          imageBuffer: request.imageBuffer || await fs.readFile(request.imagePath!),
          endImageBuffer: request.endImageBuffer,
          prompt: request.prompt,
          duration: request.duration,
          aspectRatio: request.aspectRatio,
          guidanceScale: request.guidanceScale,
          numInferenceSteps: request.numInferenceSteps
        })
        input = result.input
        calculatedDuration = result.calculatedDuration
      } else {
        // Fallback: existing hardcoded logic
        const imageBuffer = request.imageBuffer || await fs.readFile(request.imagePath!)
        const durationSeconds = request.duration ?? 5
        const numFrames = durationToNumFrames(durationSeconds)
        calculatedDuration = numFrames / FPS
        input = {
          image: imageBuffer,
          prompt: request.prompt || 'Natural, smooth camera movement. Cinematic lighting.',
          go_fast: true,
          sample_shift: 12,
          disable_safety_checker: false,
          last_image: request.endImageBuffer
        }
      }

      console.log(`[ReplicateMotion] Using model: ${this.model}, duration: ~${calculatedDuration.toFixed(1)}s`)

      let predictTime: number | undefined
      const output = await this.client.run(this.model as any, { input }, (prediction: any) => {
        if (prediction.metrics?.predict_time) {
          predictTime = prediction.metrics.predict_time
        }
      })

      const videoUrl = Array.isArray(output) ? output[0] : (output as unknown as string)
      if (!videoUrl) {
        throw new Error('No video URL returned from Replicate')
      }

      const videoBuffer = await this.downloadVideo(videoUrl)

      const motion: GeneratedMotion = {
        videoBuffer,
        duration: calculatedDuration,
        format: 'mp4'
      }

      console.log(`[ReplicateMotion] predict_time: ${predictTime?.toFixed(2) ?? 'N/A'}s`)

      const outputCost = calculateReplicateOutputCost(this.model, 1)
      const cost = outputCost != null ? outputCost : (predictTime != null ? calculateReplicateTimeCost(this.model, predictTime) : 0)

      return {
        video: motion,
        provider: 'REPLICATE',
        model: this.model,
        predictTime,
        costInfo: {
          cost,
          provider: 'REPLICATE',
          model: this.model,
          metadata: { predict_time: predictTime }
        }
      }

    } catch (error: any) {
      console.error('[ReplicateMotion] Error:', error)
      if (error?.response) {
        // Try to read error body if available, but be careful of already read streams
        try {
          const body = await error.response.text()
          throw new Error(`Replicate API error: ${error.response.status} - ${body}`)
        } catch (e) {
          throw new Error(`Replicate API error: ${error.message}`)
        }
      }
      throw new Error(`Replicate motion generation failed: ${error.message}`)
    }
  }

  private async downloadVideo(url: string, retries = 3): Promise<Buffer> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
      } catch (error: any) {
        console.error(`[ReplicateMotion] Attempt ${i + 1} failed for URL: ${url}. Error: ${error.message}`)
        if (i === retries - 1) {
          throw new Error(`Failed to download motion video after ${retries} attempts: ${error.message}`)
        }
        // Espera curta (500ms, 1000ms, 1500ms)
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)))
      }
    }
    throw new Error('Unreachable code')
  }
}
