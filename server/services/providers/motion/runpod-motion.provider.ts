import fs from 'node:fs/promises'
import type {
  IMotionProvider,
  MotionGenerationRequest,
  MotionGenerationResponse,
  GeneratedMotion
} from '../../../types/ai-providers'

/**
 * RunPod Motion Provider
 * Consome o worker 'wlsdml1114/generate_video' (Wan2.2 ComfyUI) no RunPod.
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
    return 'REPLICATE'
  }

  async generate(request: MotionGenerationRequest): Promise<MotionGenerationResponse> {
    if (!this.endpointId) {
      throw new Error('RunPod Endpoint ID is not configured')
    }

    try {
      console.log(`[RunPodMotion] Generating video from image`)

      // Usar buffer se disponível, senão ler do path
      let imageBuffer: Buffer
      if (request.imageBuffer) {
        imageBuffer = request.imageBuffer
      } else if (request.imagePath) {
        imageBuffer = await fs.readFile(request.imagePath)
      } else {
        throw new Error('Either imageBuffer or imagePath must be provided')
      }

      const imageBase64 = imageBuffer.toString('base64')

      let endImageBase64: string | undefined
      if (request.endImagePath) {
        const endImageBuffer = await fs.readFile(request.endImagePath)
        endImageBase64 = endImageBuffer.toString('base64')
      }

      // Nosso worker suporta 'end_image_base64' para transições.
      const url = `https://api.runpod.ai/v2/${this.endpointId}/runsync`

      // Mapeamento de Payload para o Worker wlsdml1114/generate_video
      const payload = {
        input: {
          image_base64: imageBase64,
          end_image_base64: endImageBase64, // O nosso worker suporta end_image!

          prompt: request.prompt,
          negative_prompt: request.negativePrompt || 'blurry, low quality, distorted, watermark',

          // Resolução Wan2.2
          width: request.aspectRatio === '9:16' ? 720 : 1280,
          height: request.aspectRatio === '9:16' ? 1280 : 720,

          // Parâmetros Diffusers (Padrão do nosso handler.py)
          num_frames: request.duration === 10 ? 161 : 81,
          num_inference_steps: request.numInferenceSteps || 40,
          guidance_scale: request.guidanceScale || 5.0,
          fps: 16
        }
      }

      console.log(`[RunPodMotion] Calling RunPod endpoint: ${this.endpointId} (Wan2.2 ComfyUI)`)

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

      // Tratamento da Resposta
      if (data.status === 'COMPLETED') {
        return this.processCompletedJob(data)
      } else if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') {
        // Polling para jobs demorados
        return this.pollJobStatus(data.id)
      }

      throw new Error(`RunPod generation failed with initial status: ${data.status}`)

    } catch (error: any) {
      console.error('[RunPodMotion] Error:', error)
      throw new Error(`RunPod motion generation failed: ${error.message}`)
    }
  }

  /**
   * Processa o resultado de um job bem-sucedido
   */
  private processCompletedJob(data: any): MotionGenerationResponse {
    // O worker wlsdml1114 retorna: output: { message: "Video generated successfully", video_base64: "..." }
    // As vezes retorna video_url se configurado bucket S3, mas base64 é o padrão sem bucket.

    if (!data.output || !data.output.video_base64) {
      console.error("RunPod Output:", JSON.stringify(data.output).substring(0, 200))
      throw new Error("RunPod job completed but output is missing 'video_base64'")
    }

    const videoBuffer = Buffer.from(data.output.video_base64, 'base64')

    const motion: GeneratedMotion = {
      videoBuffer,
      duration: 5, // Estimado (Wan2.2 gera ~5s com 81 frames)
      format: 'mp4'
    }

    return {
      video: motion,
      provider: 'RUNPOD',
      model: 'wan-2.2-comfy-worker'
    }
  }

  /**
   * Faz polling para obter o resultado caso o runsync não retorne imediatamente
   */
  private async pollJobStatus(jobId: string): Promise<MotionGenerationResponse> {
    const statusUrl = `https://api.runpod.ai/v2/${this.endpointId}/status/${jobId}`
    console.log(`[RunPodMotion] Job assigned (${jobId}). Polling status...`)

    // Loop de polling (timeout de 5 minutos = 60 * 5s)
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const response = await fetch(statusUrl, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      })

      const data = await response.json()

      if (data.status === 'COMPLETED') {
        return this.processCompletedJob(data)
      }

      if (data.status === 'FAILED' || data.status === 'CANCELLED') {
        // Tentar extrair erro detalhado
        const errorMsg = data.error || JSON.stringify(data)
        throw new Error(`RunPod job ${jobId} failed: ${errorMsg}`)
      }
    }

    throw new Error(`RunPod job ${jobId} timed out after polling`)
  }
}
