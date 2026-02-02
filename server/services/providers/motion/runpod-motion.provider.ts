import fs from 'node:fs/promises'
import type {
  IMotionProvider,
  MotionGenerationRequest,
  MotionGenerationResponse,
  GeneratedMotion
} from '../../../types/ai-providers'

/**
 * RunPod Motion Provider
 * Consome um worker customizado no RunPod Serverless que retorna o vídeo em Base64
 */
export class RunPodMotionProvider implements IMotionProvider {
  private apiKey: string
  private endpointId: string

  constructor(config: { apiKey: string; endpointId?: string }) {
    if (!config.apiKey) {
      throw new Error('RunPod API key is required')
    }
    this.apiKey = config.apiKey
    // O ID do endpoint deve ser configurado no .env ou via parâmetro
    this.endpointId = config.endpointId || process.env.RUNPOD_ENDPOINT_ID || ''
  }

  getName(): string {
    return 'RunPod Serverless (Custom Worker)'
  }

  async generate(request: MotionGenerationRequest): Promise<MotionGenerationResponse> {
    if (!this.endpointId) {
      throw new Error('RunPod Endpoint ID is not configured')
    }

    try {
      console.log(`[RunPodMotion] Generating video from image: ${request.imagePath}`)

      // Ler a imagem e converter para Base64 para enviar ao worker
      const imageBuffer = await fs.readFile(request.imagePath)
      const imageBase64 = imageBuffer.toString('base64')

      // Processar End Image se existir
      let endImageBase64: string | undefined
      if (request.endImagePath) {
        const endImageBuffer = await fs.readFile(request.endImagePath)
        endImageBase64 = endImageBuffer.toString('base64')
      }

      const url = `https://api.runpod.ai/v2/${this.endpointId}/runsync`

      const payload = {
        input: {
          image_base64: imageBase64,
          end_image_base64: endImageBase64, // Novo campo
          prompt: request.prompt,
          duration: request.duration || 5,
          aspect_ratio: request.aspectRatio || '16:9',
          guidance_scale: request.guidanceScale, // Novo campo
          num_inference_steps: request.numInferenceSteps, // Novo campo

          // Parâmetros otimizados para Wan 2.2
          width: request.aspectRatio === '9:16' ? 720 : 1280,
          height: request.aspectRatio === '9:16' ? 1280 : 720,
          fps: 16 // Wan 2.2 padrão cinemático (o num_frames agora é calculado no worker se duration for enviado)
        }
      }

      console.log(`[RunPodMotion] Calling RunPod endpoint: ${this.endpointId}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`RunPod API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      if (data.status === 'COMPLETED') {
        // O worker retorna video_base64
        const videoBuffer = Buffer.from(data.output.video_base64, 'base64')

        const motion: GeneratedMotion = {
          videoBuffer,
          duration: data.output.duration || 4,
          format: 'mp4'
        }

        return {
          video: motion,
          provider: 'RUNPOD',
          model: 'custom-video-worker'
        }
      } else if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') {
        // Caso o runsync demore e retorne um job ID em vez do resultado direto
        // (Isso pode acontecer se o worker demorar mais que o timeout do runsync)
        return this.pollJobStatus(data.id)
      }

      throw new Error(`RunPod generation failed with status: ${data.status}`)

    } catch (error: any) {
      console.error('[RunPodMotion] Error:', error)
      throw new Error(`RunPod motion generation failed: ${error.message}`)
    }
  }

  /**
   * Faz polling para obter o resultado caso o runsync não retorne imediatamente
   */
  private async pollJobStatus(jobId: string): Promise<MotionGenerationResponse> {
    const statusUrl = `https://api.runpod.ai/v2/${this.endpointId}/status/${jobId}`
    console.log(`[RunPodMotion] Job in progress. Polling status for: ${jobId}`)

    // Tentar por até 2 minutos
    for (let i = 0; i < 24; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Esperar 5s

      const response = await fetch(statusUrl, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      })

      const data = await response.json()

      if (data.status === 'COMPLETED') {
        const videoBuffer = Buffer.from(data.output.video_base64, 'base64')
        return {
          video: {
            videoBuffer,
            duration: data.output.duration || 4,
            format: 'mp4'
          },
          provider: 'RUNPOD',
          model: 'custom-video-worker'
        }
      }

      if (data.status === 'FAILED' || data.status === 'CANCELLED') {
        throw new Error(`RunPod job ${jobId} failed with status: ${data.status}`)
      }
    }

    throw new Error(`RunPod job ${jobId} timed out after polling`)
  }
}
