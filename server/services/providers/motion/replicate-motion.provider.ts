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
 * Uses Kling v2.5 Turbo Pro via Replicate API
 */
export class ReplicateMotionProvider implements IMotionProvider {
  private client: Replicate
  private model: string

  constructor(config: { apiKey: string; model?: string }) {
    if (!config.apiKey) {
      throw new Error('Replicate API key is required')
    }
    this.client = new Replicate({ auth: config.apiKey })
    // Default to Kling v2.5 Turbo Pro as requested by user
    this.model = config.model || 'kwaivgi/kling-v2.5-turbo-pro'
  }

  getName(): string {
    return 'Replicate (Kling v2.5)'
  }

  async generate(request: MotionGenerationRequest): Promise<MotionGenerationResponse> {
    try {
      console.log(`[ReplicateMotion] Generating video from image: ${request.imagePath}`)

      // Prepare input
      // We pass the buffer directly to the Replicate SDK, which handles the upload
      const imageBuffer = await fs.readFile(request.imagePath)

      const input = {
        prompt: request.prompt || 'Bring this image to life with natural movement',
        start_image: imageBuffer,
        duration: request.duration === 10 ? 10 : 5,
        aspect_ratio: request.aspectRatio || '16:9',
        negative_prompt: request.negativePrompt || 'deformed, distorted, flickering, static, low quality'
      }

      console.log(`[ReplicateMotion] Using model: ${this.model}`)

      // Execute generation
      const output = await this.client.run(this.model as any, { input })

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

      return {
        video: motion,
        provider: 'REPLICATE',
        model: this.model
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
