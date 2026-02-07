import Replicate from 'replicate'
import fs from 'node:fs/promises'
import type {
  IMotionProvider,
  MotionGenerationRequest,
  MotionGenerationResponse,
  GeneratedMotion
} from '../../../types/ai-providers'

/**
 * Replicate Motion Provider
 * Uses Wan Video 2.2 I2V Fast via Replicate API
 * Model: wan-video/wan-2.2-i2v-fast (PrunaAI optimized version)
 */
export class ReplicateMotionProvider implements IMotionProvider {
  private client: Replicate
  private model: string

  constructor(config: { apiKey: string; model?: string }) {
    if (!config.apiKey) {
      throw new Error('Replicate API key is required')
    }
    this.client = new Replicate({ auth: config.apiKey })
    // Default to Wan Video 2.2 I2V Fast
    this.model = config.model || 'wan-video/wan-2.2-i2v-fast'
  }

  getName(): string {
    return 'REPLICATE'
  }

  async generate(request: MotionGenerationRequest): Promise<MotionGenerationResponse> {
    try {
      console.log(`[ReplicateMotion] Generating video from image`)

      // Prepare input - usar buffer se disponível, senão ler do path
      const imageBuffer = request.imageBuffer || await fs.readFile(request.imagePath!)

      const input = {
        image: imageBuffer,
        prompt: request.prompt || 'Natural, smooth camera movement. Cinematic lighting.',
        num_frames: request.duration === 10 ? 121 : 81, // 81 frames = ~5s @ 16fps, 121 frames = ~7.5s @ 16fps
        resolution: '480p', // 480p = 832x480px (16:9) ou 480x832px (9:16)
        frames_per_second: 16,
        go_fast: true, // Usa otimização PrunaAI
        sample_shift: 12, // Default recomendado
        interpolate_output: false,
        disable_safety_checker: false
      }

      console.log(`[ReplicateMotion] Using model: ${this.model}`)

      // Execute generation - capturando predict_time via progress callback
      let predictTime: number | undefined
      const output = await this.client.run(this.model as any, { input }, (prediction: any) => {
        if (prediction.metrics?.predict_time) {
          predictTime = prediction.metrics.predict_time
        }
      })

      // Output is typically a URL string or array of strings
      const videoUrl = Array.isArray(output) ? output[0] : (output as unknown as string)

      if (!videoUrl) {
        throw new Error('No video URL returned from Replicate')
      }

      // Download the video content
      const videoBuffer = await this.downloadVideo(videoUrl)

      // Construct response
      const motion: GeneratedMotion = {
        videoBuffer,
        duration: request.duration === 10 ? 10 : 5,
        format: 'mp4'
      }

      console.log(`[ReplicateMotion] predict_time: ${predictTime?.toFixed(2) ?? 'N/A'}s`)

      return {
        video: motion,
        provider: 'REPLICATE',
        model: this.model,
        predictTime
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
