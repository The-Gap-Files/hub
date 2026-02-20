
import type {
  IImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GeneratedImage,
  ProviderCostInfo
} from '../../../types/ai-providers'

/** Erro lançado quando o safety filter do Gemini bloqueia a geração */
export class GeminiContentFilteredError extends Error {
  public readonly reasons: string[]
  constructor(reasons: string[]) {
    super(`Gemini Image: bloqueado pelo safety filter. ${reasons.join('; ')}`)
    this.name = 'GeminiContentFilteredError'
    this.reasons = reasons
  }
}

/**
 * Gemini Image Provider
 *
 * Suporta dois backends:
 *   1. AI Studio (default): generativelanguage.googleapis.com — usa GEMINI_API_KEY
 *   2. Vertex AI Express: aiplatform.googleapis.com — usa VERTEX_API_KEY
 *
 * Vertex AI oferece parâmetros extras: enhancePrompt, negativePrompt, seed, imageSize 2K.
 * Se VERTEX_API_KEY estiver no .env, usa Vertex automaticamente.
 */
export class GeminiImageProvider implements IImageGenerator {
  private apiKey: string
  private model: string
  private useVertex: boolean
  private vertexApiKey: string | undefined

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey

    // Normalização de IDs de modelo (Safety net)
    const rawModel = config.model ?? 'imagen-4.0-generate-001'

    if (rawModel.includes('gemini') || rawModel.includes('preview') || rawModel.includes('3.0')) {
      console.warn(`[Gemini Image] ⚠️ Modelo "${rawModel}" parece incorreto ou indisponível. Usando "imagen-4.0-generate-001" automaticamente.`)
      this.model = 'imagen-4.0-generate-001'
    } else {
      this.model = rawModel
    }

    // Detectar Vertex AI Express — se tiver VERTEX_API_KEY, usa Vertex
    this.vertexApiKey = process.env.VERTEX_API_KEY
    this.useVertex = !!this.vertexApiKey

    if (this.useVertex) {
      console.log(`[Gemini Image] 🔷 Usando Vertex AI Express (parâmetros extras disponíveis)`)
    }
  }

  getName(): string {
    return 'GEMINI'
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now()

    // 1. Mapear Aspect Ratio para string aceita pelo Imagen
    let aspectRatio = request.aspectRatio || '16:9'

    if (aspectRatio.includes('x')) {
      const [w, h] = aspectRatio.split('x').map(Number)
      if (w && h) {
        const ratio = w / h
        if (Math.abs(ratio - 1) < 0.1) aspectRatio = '1:1'
        else if (Math.abs(ratio - 16 / 9) < 0.1) aspectRatio = '16:9'
        else if (Math.abs(ratio - 9 / 16) < 0.1) aspectRatio = '9:16'
        else if (Math.abs(ratio - 4 / 3) < 0.1) aspectRatio = '4:3'
        else if (Math.abs(ratio - 3 / 4) < 0.1) aspectRatio = '3:4'
        else aspectRatio = '1:1'
      } else {
        aspectRatio = '16:9'
      }
    }

    // 2. Construir URL e payload conforme o backend
    const url = this.useVertex
      ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${this.model}:predict?key=${this.vertexApiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predict?key=${this.apiKey}`

    const fullPrompt = request.style
      ? `${request.style}. ${request.prompt}`
      : request.prompt

    // Parâmetros base (ambos backends)
    const parameters: Record<string, any> = {
      sampleCount: request.numVariants || 1,
      aspectRatio: aspectRatio,
      safetyFilterLevel: 'block_only_high',
      personGeneration: 'allow_adult',
      includeRaiReason: true
    }

    // Parâmetros extras do Vertex AI
    if (this.useVertex) {
      parameters.enhancePrompt = false
    }

    const payload = {
      instances: [{ prompt: fullPrompt }],
      parameters
    }

    const backend = this.useVertex ? 'Vertex' : 'AI Studio'
    console.log(`[Gemini Image] 🎨 ${backend} | modelo ${this.model}`)
    console.log(`[Gemini Image] Prompt: "${fullPrompt.substring(0, 50)}..."`)
    console.log(`[Gemini Image] Aspect Ratio: ${aspectRatio}`)

    try {
      // Fetch com retry para 429 (rate limit)
      const MAX_RETRIES = 3
      let data: any
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (response.status === 429 && attempt < MAX_RETRIES) {
          const wait = (attempt + 1) * 5000 // 5s, 10s, 15s
          console.warn(`[Gemini Image] ⏳ Rate limit (429). Retry ${attempt + 1}/${MAX_RETRIES} em ${wait / 1000}s...`)
          await new Promise(r => setTimeout(r, wait))
          continue
        }

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Gemini Image API Error (${response.status}): ${errorText}`)
        }

        data = await response.json()
        break
      }

      // 3. Processar resposta
      const predictions = data.predictions
      if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
        throw new Error('Gemini Image API retornou lista de predictions vazia. Provável bloqueio de safety filter (prompt sensível).')
      }

      // Separar predictions válidas de filtradas
      const validPredictions: any[] = []
      const filteredReasons: string[] = []

      for (const pred of predictions) {
        if (pred.raiFilteredReason) {
          filteredReasons.push(pred.raiFilteredReason)
          console.warn(`[Gemini Image] ⚠️ Prediction filtrada: ${pred.raiFilteredReason}`)
        } else if (pred.bytesBase64Encoded) {
          validPredictions.push(pred)
        } else {
          console.warn('[Gemini Image] ⚠️ Prediction sem bytesBase64Encoded e sem raiFilteredReason')
        }
      }

      if (validPredictions.length === 0) {
        throw new GeminiContentFilteredError(
          filteredReasons.length > 0 ? filteredReasons : ['Sem motivo retornado pelo API']
        )
      }

      if (filteredReasons.length > 0) {
        console.warn(`[Gemini Image] ⚠️ ${filteredReasons.length} de ${predictions.length} predictions filtradas. Continuando com ${validPredictions.length} válida(s).`)
      }

      const images: GeneratedImage[] = validPredictions.map((pred: any) => {
        return {
          buffer: Buffer.from(pred.bytesBase64Encoded, 'base64'),
          width: aspectRatio === '16:9' ? 1792 : (aspectRatio === '9:16' ? 1024 : 1024),
          height: aspectRatio === '16:9' ? 1024 : (aspectRatio === '9:16' ? 1792 : 1024),
          revisedPrompt: pred.prompt || fullPrompt
        }
      })

      const elapsed = (Date.now() - startTime) / 1000

      console.log(`[Gemini Image] ✅ Sucesso: ${images.length} imagem(ns) gerada(s) em ${elapsed.toFixed(2)}s (${backend})`)

      const costPerImage = this.model.includes('fast') ? 0.02 : 0.04
      const totalCost = images.length * costPerImage

      const costInfo: ProviderCostInfo = {
        provider: 'GEMINI',
        model: this.model,
        cost: totalCost,
        metadata: {
          predict_time: elapsed,
          sampleCount: images.length,
          backend
        }
      }

      return {
        images,
        provider: 'GEMINI',
        model: this.model,
        predictTime: elapsed,
        costInfo
      }

    } catch (error) {
      console.error('[Gemini Image] ❌ Erro ao gerar imagem:', error)
      throw error
    }
  }
}
