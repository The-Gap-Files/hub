
import type {
  IImageGenerator,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GeneratedImage,
  ProviderCostInfo
} from '../../../types/ai-providers'

/**
 * Gemini Image Provider
 * 
 * Implementação para o modelo Imagen 3 via API "Google Generative AI"
 * Documentação: https://ai.google.dev/api/imagen
 * Endpoints:
 *   - models/imagen-3.0-generate-001:predict
 *   - models/imagen-3.0-fast-generate-001:predict
 * 
 * A API AI Studio é ligeiramente diferente da Vertex AI.
 * Para simplificar, usamos fetch direto no endpoint REST com a API Key.
 */
export class GeminiImageProvider implements IImageGenerator {
  private apiKey: string
  private model: string
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models'

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey

    // Normalização de IDs de modelo (Safety net)
    // Se o usuário configurar "Gemini 1.5 Pro" ou nomes incorretos para imagem,
    // ou se tentar usar o antigo Imagen 3 (não disponível), redirecionamos para o Imagen 4.
    const rawModel = config.model ?? 'imagen-4.0-generate-001'

    if (rawModel.includes('gemini') || rawModel.includes('preview') || rawModel.includes('3.0')) {
      console.warn(`[Gemini Image] ⚠️ Modelo "${rawModel}" parece incorreto ou indisponível. Usando "imagen-4.0-generate-001" automaticamente.`)
      this.model = 'imagen-4.0-generate-001'
    } else {
      this.model = rawModel
    }
  }

  getName(): string {
    return 'GEMINI'
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now()

    // 1. Mapear Aspect Ratio para string aceita pelo Imagen
    // Aceita: "1:1", "3:4", "4:3", "9:16", "16:9"
    let aspectRatio = request.aspectRatio || '16:9'

    // Fallback se vier "1024x1024" ou algo assim do request
    if (aspectRatio.includes('x')) {
      const [w, h] = aspectRatio.split('x').map(Number)
      if (w && h) {
        const ratio = w / h
        if (Math.abs(ratio - 1) < 0.1) aspectRatio = '1:1'
        else if (Math.abs(ratio - 16 / 9) < 0.1) aspectRatio = '16:9'
        else if (Math.abs(ratio - 9 / 16) < 0.1) aspectRatio = '9:16'
        else if (Math.abs(ratio - 4 / 3) < 0.1) aspectRatio = '4:3'
        else if (Math.abs(ratio - 3 / 4) < 0.1) aspectRatio = '3:4'
        else aspectRatio = '1:1' // Default seguro
      } else {
        aspectRatio = '16:9' // Default fallback se split falhar
      }
    }

    // 2. Construir payload
    // Documentação de AI Studio para Imagen 3 (beta)
    // POST https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=API_KEY
    const url = `${this.baseUrl}/${this.model}:predict?key=${this.apiKey}`

    // Prompt includes style if present
    const fullPrompt = request.style
      ? `${request.style}. ${request.prompt}`
      : request.prompt

    const payload = {
      instances: [
        {
          prompt: fullPrompt
        }
      ],
      parameters: {
        sampleCount: request.numVariants || 1,
        aspectRatio: aspectRatio,
        // Opcionais comuns
        safetyFilterLevel: 'block_only_high',
        personGeneration: 'allow_adult'
      }
    }

    console.log(`[Gemini Image] 🎨 Gerando imagem com modelo ${this.model}...`)
    console.log(`[Gemini Image] Prompt: "${fullPrompt.substring(0, 50)}..."`)
    console.log(`[Gemini Image] Aspect Ratio: ${aspectRatio}`)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini Image API Error (${response.status}): ${errorText}`)
      }

      const data = await response.json()

      // 3. Processar resposta
      // Estrutura esperada:
      // {
      //   "predictions": [
      //     {
      //       "bytesBase64Encoded": "...",
      //       "mimeType": "image/png"
      //     }
      //   ]
      // }

      if (!data.predictions || !Array.isArray(data.predictions) || data.predictions.length === 0) {
        throw new Error('Gemini Image API retornou lista de predictions vazia.')
      }

      const images: GeneratedImage[] = data.predictions.map((pred: any) => {
        if (!pred.bytesBase64Encoded) {
          throw new Error('Prediction sem bytesBase64Encoded.')
        }
        return {
          buffer: Buffer.from(pred.bytesBase64Encoded, 'base64'),
          // Imagen 3 gera 1024x1024 (1:1), 1792x1024 (16:9) etc.
          // Não retorna dimensões exatas na response, assumimos com base no aspect ratio pedido
          width: aspectRatio === '16:9' ? 1792 : (aspectRatio === '9:16' ? 1024 : 1024),
          height: aspectRatio === '16:9' ? 1024 : (aspectRatio === '9:16' ? 1792 : 1024),
          revisedPrompt: fullPrompt // Imagen não devolve revised prompt ainda
        }
      })

      const elapsed = (Date.now() - startTime) / 1000

      console.log(`[Gemini Image] ✅ Sucesso: ${images.length} imagem(ns) gerada(s) em ${elapsed.toFixed(2)}s`)

      // Custo estimado (Imagen 3 custa ~$0.04 por imagem no Vertex, AI Studio pode ser free tier ou paid)
      // Vamos assumir $0.04 para consistência com o tier do media-registry
      const costPerImage = this.model.includes('fast') ? 0.02 : 0.04
      const totalCost = images.length * costPerImage

      const costInfo: ProviderCostInfo = {
        provider: 'GEMINI',
        model: this.model,
        cost: totalCost,
        metadata: {
          predict_time: elapsed,
          sampleCount: images.length
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
