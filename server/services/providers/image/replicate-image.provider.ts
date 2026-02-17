/**
 * Implementação do gerador de imagens usando Replicate
 * 
 * Este provedor usa a biblioteca oficial do Replicate para acessar modelos como
 * Luma Photon Flash (padrão), FLUX Schnell/Dev/Pro, Stable Diffusion, etc.
 * Detecta automaticamente o modelo e ajusta os parâmetros de input.
 */

import Replicate from 'replicate'
import type {
  IImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GeneratedImage,
  ProviderCostInfo
} from '../../../types/ai-providers'
import { calculateReplicateOutputCost } from '../../../constants/pricing'
import { buildImageInput, type ImageInputContext } from '../../../utils/input-schema-builder'

/**
 * Erro lançado quando o modelo de imagem rejeita o prompt por filtro de conteúdo sensível.
 * Código E005 da Replicate/Luma.
 */
export class ContentRestrictedError extends Error {
  public readonly code = 'CONTENT_RESTRICTED'
  constructor(message: string, public readonly originalPrompt: string) {
    super(message)
    this.name = 'ContentRestrictedError'
  }
}

export class ReplicateImageProvider implements IImageGenerator {
  private client: Replicate
  private model: string
  private inputSchema: any = null

  constructor(config: {
    apiKey: string
    model?: string
    baseUrl?: string
    inputSchema?: any
  }) {
    this.client = new Replicate({
      auth: config.apiKey
    })
    // Luma Photon Flash: fotorrealístico de alta qualidade (mesmo modelo das thumbnails)
    this.model = config.model ?? 'luma/photon-flash'
    this.inputSchema = config.inputSchema ?? null
  }

  getName(): string {
    return 'REPLICATE'
  }

  /**
   * Detecta se o modelo atual é Photon Flash (Luma).
   * Photon Flash não suporta negative_prompt, num_outputs, go_fast, seed, resolution.
   */
  private isPhotonFlash(): boolean {
    return this.model.includes('photon')
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const enhancedPrompt = this.enhancePrompt(request.prompt, request.style)
    console.log(`[ReplicateImageProvider] Generating image with model ${this.model}. Prompt: ${enhancedPrompt.substring(0, 50)}...`)

    try {
      let input: any

      if (this.inputSchema) {
        // Dynamic: build from schema
        input = buildImageInput(this.inputSchema, {
          prompt: enhancedPrompt,
          negativePrompt: request.negativePrompt,
          width: request.width,
          height: request.height,
          aspectRatio: request.aspectRatio,
          seed: request.seed,
          numVariants: request.numVariants
        })
      } else {
        // Fallback: existing hardcoded logic
        input = this.isPhotonFlash()
          ? this.buildPhotonFlashInput(enhancedPrompt, request)
          : this.buildFluxInput(enhancedPrompt, request)
      }

      // === IMAGE REFERENCE (Photon Flash) ===
      // Se um imageReference Buffer foi fornecido, faz upload temporário
      // via Replicate Files API e injeta como image_ref no input.
      if (request.imageReference && this.isPhotonFlash()) {
        try {
          const refUrl = await this.uploadImageReferenceBuffer(request.imageReference)
          const weight = request.imageReferenceWeight ?? 0.5
          input.image_ref = [{ url: refUrl, weight }]
          console.log(`[ReplicateImageProvider] Image reference uploaded. URL: ${refUrl.substring(0, 60)}... | weight: ${weight}`)
        } catch (refError: any) {
          console.warn(`[ReplicateImageProvider] Failed to upload image reference, generating without it: ${refError.message}`)
          // Gerar sem referência - melhor que falhar
        }
      }

      let predictTime: number | undefined
      const output: any = await this.client.run(this.model as any, { input }, (prediction: any) => {
        if (prediction.metrics?.predict_time) {
          predictTime = prediction.metrics.predict_time
        }
      })
      console.log(`[ReplicateImageProvider] Replicate returned ${Array.isArray(output) ? output.length : 1} image(s)${predictTime ? ` (predict_time: ${predictTime.toFixed(2)}s)` : ''}`)

      // Photon Flash retorna FileOutput (URL direta via .url()), FLUX retorna array de URLs
      const urls = this.extractUrls(output)

      // Baixar imagens com retry
      const images: GeneratedImage[] = await Promise.all(
        urls.map(async (url, index) => {
          return this.downloadImageWithRetry(url, index)
        })
      )

      return {
        images,
        provider: 'replicate',
        model: this.model,
        predictTime,
        costInfo: {
          cost: calculateReplicateOutputCost(this.model, images.length) ?? 0,
          provider: 'REPLICATE',
          model: this.model,
          metadata: {
            num_images: images.length,
            ...(predictTime != null && { predict_time: predictTime })
          }
        }
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error)
      console.error('[ReplicateImageProvider] Error:', errorMsg)

      // Detectar rejeição por filtro de conteúdo sensível (E005 da Replicate/Luma)
      if (errorMsg.includes('flagged as sensitive') || errorMsg.includes('E005')) {
        throw new ContentRestrictedError(
          `Content safety filter rejected the prompt: ${errorMsg}`,
          enhancedPrompt
        )
      }

      if (error.response) {
        throw new Error(`Replicate API error: ${error.response.status} - ${errorMsg}`)
      }
      throw new Error(`Replicate error: ${errorMsg}`)
    }
  }

  /**
   * Inputs para Luma Photon Flash — aceita prompt + aspect_ratio.
   * image_ref é injetado separadamente no método generate() após upload.
   */
  private buildPhotonFlashInput(prompt: string, request: ImageGenerationRequest): Record<string, any> {
    const aspectRatio = request.aspectRatio === 'custom'
      ? '1:1'
      : this.mapToPhotonAspectRatio(request.aspectRatio || '1:1')

    return { prompt, aspect_ratio: aspectRatio }
  }

  /**
   * Faz upload de um buffer de imagem para o Replicate Files API.
   * Retorna a URL temporária que pode ser usada como image_ref.
   * 
   * @see https://replicate.com/docs/topics/predictions/create-a-prediction#files
   */
  private async uploadImageReferenceBuffer(buffer: Buffer): Promise<string> {
    // Replicate Files API: cria um arquivo temporário e retorna URL pública
    const blob = new Blob([buffer as any], { type: 'image/png' })
    const file = new File([blob], 'image-reference.png', { type: 'image/png' })

    // Usar a API do Replicate para upload
    // O client.files.create retorna um objeto com .urls.get
    const uploaded = await (this.client as any).files.create(file, {
      content_type: 'image/png',
      filename: 'image-reference.png'
    })

    // O Replicate Files API retorna a URL no campo urls.get
    const url = uploaded?.urls?.get || uploaded?.url
    if (!url) {
      throw new Error('Replicate Files API did not return a valid URL')
    }

    return url
  }

  /**
   * Inputs para FLUX Schnell/Dev/Pro — suporta payload completo.
   */
  private buildFluxInput(prompt: string, request: ImageGenerationRequest): Record<string, any> {
    const input: any = {
      prompt,
      negative_prompt: request.negativePrompt ?? this.getDefaultNegativePrompt(),
      num_outputs: request.numVariants ?? 1,
      seed: request.seed,
      output_format: "png",
      go_fast: true,
    }

    if (request.aspectRatio === 'custom') {
      input.aspect_ratio = 'custom'
      input.width = request.width
      input.height = request.height
    } else {
      input.aspect_ratio = request.aspectRatio || "1:1"
      input.resolution = "1 MP"
    }

    return input
  }

  /**
   * Extrai URLs do output do Replicate.
   * Photon Flash retorna FileOutput (com .url()), FLUX retorna array de strings.
   */
  private extractUrls(output: any): string[] {
    if (Array.isArray(output)) {
      return output.map(item => typeof item === 'string' ? item : (item?.url?.() || String(item)))
    }
    const url = typeof output === 'string'
      ? output
      : (output?.url?.() || String(output))
    return [url]
  }

  /**
   * Mapeia aspect ratio para formatos aceitos pelo Photon Flash.
   * Suportados: 1:1, 3:4, 4:3, 9:16, 16:9, 9:21, 21:9
   */
  private mapToPhotonAspectRatio(aspectRatio: string): string {
    const mapping: Record<string, string> = {
      '16:9': '16:9', '9:16': '9:16', '1:1': '1:1',
      '4:3': '4:3', '3:4': '3:4', '21:9': '21:9', '9:21': '9:21'
    }
    return mapping[aspectRatio] || '16:9'
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
   * Garante âncora de estilo no prompt enviado ao modelo de imagem.
   * - Se style for o baseStyle completo (ex.: Ghibli Sombrio), é preposto para fixar o look.
   * - Se for uma chave conhecida (cinematic, photorealistic...), usa o enhancer curto.
   * - Se nenhum style for passado MAS o prompt já contém âncora de estilo
   *   (cenário normal: a LLM embutiu o estilo no visualDescription), NÃO adiciona fallback.
   */
  private enhancePrompt(basePrompt: string, style?: ImageGenerationRequest['style']): string {
    const styleEnhancers: Record<string, string> = {
      cinematic: 'cinematic lighting, dramatic composition, film grain, depth of field, widescreen, professional color grading',
      photorealistic: 'photorealistic, highly detailed, 8k uhd, studio lighting, sharp focus, physically based rendering',
      artistic: 'artistic, creative interpretation, expressive, painterly, stylized',
      documentary: 'documentary style, natural lighting, authentic, journalistic, candid'
    }

    // baseStyle completo (ex.: de visual-styles.ts) — usar como âncora no início do prompt
    if (style && style.length > 50 && !styleEnhancers[style]) {
      return `${style}, ${basePrompt}`
    }

    // Chave curta explícita (cinematic, photorealistic, etc.)
    if (style && styleEnhancers[style]) {
      return `${basePrompt}, ${styleEnhancers[style]}`
    }

    // Sem style passado — verificar se o prompt já contém âncora de estilo embutida pela LLM.
    // Indicadores: termos de estilo visual que mostram que o roteirista já incluiu a âncora.
    const styleAnchors = ['cinematic', 'photorealistic', 'ghibli', 'illustration', 'oil painting', 'cyberpunk', 'anime', 'painterly', 'documentary film']
    const promptLower = basePrompt.toLowerCase()
    const hasStyleAnchor = styleAnchors.some(anchor => promptLower.includes(anchor))

    if (hasStyleAnchor) {
      // O prompt já é auto-suficiente — retornar sem modificar
      return basePrompt
    }

    // Fallback: prompt genérico sem âncora — adicionar enhancer cinematic
    const enhancer = styleEnhancers.cinematic
    return `${basePrompt}, ${enhancer}`
  }

  /**
   * Prompt negativo padrão para evitar artefatos
   */
  private getDefaultNegativePrompt(): string {
    return '3d render, photorealistic, gradient shading, blurry, high gloss, neon colors, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, signature'
  }
}
