import Replicate from 'replicate'
import type {
  IMusicProvider,
  MusicGenerationRequest,
  MusicGenerationResponse
} from '../../../types/ai-providers'

/**
 * Replicate Music Provider
 * Uses Stable Audio 2.5 via Replicate API
 * Model: stability-ai/stable-audio-2.5
 * 
 * Gera música de fundo a partir de prompts textuais.
 * Suporta duração de 1 a 190 segundos.
 */
export class ReplicateMusicProvider implements IMusicProvider {
  private client: Replicate
  private model: string

  constructor(config: { apiKey: string; model?: string }) {
    if (!config.apiKey) {
      throw new Error('Replicate API key is required for Music Provider')
    }
    this.client = new Replicate({ auth: config.apiKey })
    this.model = config.model || 'stability-ai/stable-audio-2.5'
  }

  getName(): string {
    return 'REPLICATE'
  }

  async generate(request: MusicGenerationRequest): Promise<MusicGenerationResponse> {
    try {
      // Validar duração (Stable Audio 2.5 suporta 1-190s)
      const duration = Math.min(190, Math.max(1, Math.round(request.duration)))

      console.log(`[ReplicateMusic] 🎵 Gerando música de fundo...`)
      console.log(`[ReplicateMusic] Prompt: "${request.prompt}"`)
      console.log(`[ReplicateMusic] Duração: ${duration}s`)

      const input: Record<string, unknown> = {
        prompt: request.prompt,
        duration
      }

      // Parâmetros opcionais
      if (request.seed !== undefined) {
        input.seed = request.seed
      }
      if (request.steps !== undefined) {
        input.steps = Math.min(8, Math.max(4, request.steps))
      }
      if (request.cfgScale !== undefined) {
        input.cfg_scale = Math.min(25, Math.max(1, request.cfgScale))
      }

      const startTime = Date.now()

      let predictTime: number | undefined
      const output = await this.client.run(this.model as `${string}/${string}`, { input }, (prediction: any) => {
        if (prediction.metrics?.predict_time) {
          predictTime = prediction.metrics.predict_time
        }
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[ReplicateMusic] 📥 Resposta recebida em ${elapsed}s (predict_time: ${predictTime?.toFixed(2) ?? 'N/A'}s)`)

      // O output do Replicate é um FileOutput com .url()
      let audioBuffer: Buffer

      if (output && typeof (output as any).url === 'function') {
        // FileOutput - buscar o URL e baixar o conteúdo
        const fileUrl = (output as any).url()
        console.log(`[ReplicateMusic] 🔗 Baixando áudio de: ${fileUrl}`)

        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`Falha ao baixar áudio: ${response.status} ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        audioBuffer = Buffer.from(arrayBuffer)
      } else if (Buffer.isBuffer(output)) {
        audioBuffer = output
      } else if (typeof output === 'string') {
        // URL direta
        console.log(`[ReplicateMusic] 🔗 Baixando áudio de URL: ${output}`)
        const response = await fetch(output)
        if (!response.ok) {
          throw new Error(`Falha ao baixar áudio: ${response.status} ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        audioBuffer = Buffer.from(arrayBuffer)
      } else {
        throw new Error(`[ReplicateMusic] Formato de output inesperado: ${typeof output}`)
      }

      console.log(`[ReplicateMusic] ✅ Música gerada com sucesso! Tamanho: ${(audioBuffer.length / 1024).toFixed(0)}KB`)

      return {
        audioBuffer,
        duration,
        format: 'mp3',
        provider: this.getName(),
        model: this.model,
        predictTime
      }
    } catch (error) {
      console.error('[ReplicateMusic] ❌ Erro na geração de música:', error)
      throw error
    }
  }
}
