/**
 * Implementação do gerador de imagens usando Replicate
 * 
 * Este provedor usa a biblioteca oficial do Replicate para acessar modelos como
 * Stable Diffusion, FLUX, etc. para geração de imagens cinematográficas.
 */

import Replicate from 'replicate'
import type {
  IImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GeneratedImage
} from '../../../types/ai-providers'

export class ReplicateImageProvider implements IImageGenerator {
  private client: Replicate
  private model: string

  constructor(config: {
    apiKey: string
    model?: string
    baseUrl?: string
  }) {
    this.client = new Replicate({
      auth: config.apiKey
    })
    // SDXL é mais compatível, FLUX Schnell é mais rápido
    this.model = config.model ?? 'stability-ai/sdxl'
  }

  getName(): string {
    return 'replicate'
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const enhancedPrompt = this.enhancePrompt(request.prompt, request.style)
    console.log(`[ReplicateImageProvider] Generating image with model ${this.model}. Prompt: ${enhancedPrompt.substring(0, 50)}...`)

    try {
      // Preparar os inputs baseados no esquema do modelo (ex: FLUX)
      const input: any = {
        prompt: enhancedPrompt,
        negative_prompt: request.negativePrompt ?? this.getDefaultNegativePrompt(),
        num_outputs: request.numVariants ?? 1,
        seed: request.seed,
        output_format: "png",
        go_fast: true,
      }

      // Se o aspect ratio for custom, usamos width/height
      // Caso contrário, usamos o preset do modelo
      if (request.aspectRatio === 'custom') {
        input.aspect_ratio = 'custom'
        input.width = request.width
        input.height = request.height
      } else {
        input.aspect_ratio = request.aspectRatio || "1:1"
        // Alguns modelos (como FLUX) ignoram width/height se aspect_ratio não for custom
        // Mas podemos passar 'resolution' para garantir qualidade
        input.resolution = "1 MP" 
      }

      const output: any = await this.client.run(this.model as any, { input })
      console.log(`[ReplicateImageProvider] Replicate returned ${Array.isArray(output) ? output.length : 1} image(s)`)

      // Output pode ser string (URL única) ou array de URLs
      const urls = Array.isArray(output) ? output : [output]

      // Baixar imagens com retry
      const images: GeneratedImage[] = await Promise.all(
        urls.map(async (url, index) => {
          return this.downloadImageWithRetry(url as string, index)
        })
      )

      return {
        images,
        provider: 'replicate',
        model: this.model
      }
    } catch (error: any) {
      console.error('[ReplicateImageProvider] Error:', error)

      if (error.response) {
        throw new Error(`Replicate API error: ${error.response.status} - ${error.message}`)
      }
      throw new Error(`Replicate error: ${error.message}`)
    }
  }

  /**
   * Baixa uma imagem com múltiplas tentativas em caso de falha de rede
   */
  private async downloadImageWithRetry(url: string, index: number, retries = 3): Promise<GeneratedImage> {
    for (let i = 0; i < retries; i++) {
      try {
        const imageResponse = await fetch(url)
        if (!imageResponse.ok) {
          throw new Error(`HTTP Error ${imageResponse.status}: ${imageResponse.statusText}`)
        }
        const buffer = Buffer.from(await imageResponse.arrayBuffer())

        return {
          buffer,
          width: 0, // Será preenchido pelo chamador se necessário, ou deixado 0
          height: 0,
          seed: undefined,
          revisedPrompt: undefined // O prompt original é capturado no nível superior se necessário
        }
      } catch (error: any) {
        console.error(`[ReplicateImageProvider] Attempt ${i + 1} failed for URL: ${url}. Error: ${error.message}`)
        if (i === retries - 1) {
          throw new Error(`Failed to download image variant ${index + 1} after ${retries} attempts: ${error.message}`)
        }
        // Espera curta antes de tentar novamente (500ms, 1000ms, 1500ms)
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)))
      }
    }
    throw new Error('Unreachable code')
  }

  /**
   * Enriquece o prompt com palavras-chave para melhor qualidade
   */
  private enhancePrompt(basePrompt: string, style?: ImageGenerationRequest['style']): string {
    const styleEnhancers: Record<string, string> = {
      cinematic: 'cinematic lighting, dramatic composition, film grain, depth of field, widescreen, professional color grading',
      photorealistic: 'photorealistic, highly detailed, 8k uhd, studio lighting, sharp focus, physically based rendering',
      artistic: 'artistic, creative interpretation, expressive, painterly, stylized',
      documentary: 'documentary style, natural lighting, authentic, journalistic, candid'
    }

    const enhancer = style ? styleEnhancers[style] ?? '' : styleEnhancers.cinematic
    return `${basePrompt}, ${enhancer}`
  }

  /**
   * Prompt negativo padrão para evitar artefatos
   */
  private getDefaultNegativePrompt(): string {
    return '3d render, photorealistic, gradient shading, blurry, high gloss, neon colors, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, signature'
  }
}
