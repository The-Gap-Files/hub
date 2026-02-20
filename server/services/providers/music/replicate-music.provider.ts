import Replicate from 'replicate'
import type {
  IMusicProvider,
  MusicGenerationRequest,
  MusicGenerationResponse,
  ProviderCostInfo
} from '../../../types/ai-providers'
import {
  calculateReplicateOutputCost,
  calculateReplicateTimeCost
} from '../../../constants/pricing'
import { buildMusicInput, type MusicInputContext } from '../../../utils/input-schema-builder'

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
  private inputSchema: any = null

  constructor(config: { apiKey: string; model?: string; inputSchema?: any }) {
    if (!config.apiKey) {
      throw new Error('Replicate API key is required for Music Provider')
    }
    this.client = new Replicate({ auth: config.apiKey })
    this.model = config.model || 'stability-ai/stable-audio-2.5'
    this.inputSchema = config.inputSchema ?? null
  }

  getName(): string {
    return 'REPLICATE'
  }

  private async withNetworkRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
    let lastError: unknown
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (err: any) {
        lastError = err
        const isNetworkError = err?.cause?.code === 'ECONNRESET' ||
          err?.cause?.code === 'ETIMEDOUT' ||
          err?.cause?.code === 'ENOTFOUND' ||
          err?.message?.includes('fetch failed') ||
          err?.message?.includes('network') ||
          err?.message?.includes('ECONNREFUSED')
        if (!isNetworkError || attempt === maxRetries) throw err
        const delay = 2000 * attempt
        console.warn(`[ReplicateMusic] ⚠️ ${label} — tentativa ${attempt}/${maxRetries} falhou (${err?.message}). Retry em ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
    throw lastError
  }

  async generate(request: MusicGenerationRequest): Promise<MusicGenerationResponse> {
    try {
      // Validar duração (Stable Audio 2.5 suporta 1-190s)
      const duration = Math.min(190, Math.max(1, Math.round(request.duration)))

      console.log(`[ReplicateMusic] 🎵 Gerando música de fundo...`)
      console.log(`[ReplicateMusic] Prompt: "${request.prompt}"`)
      console.log(`[ReplicateMusic] Duração: ${duration}s`)

      let input: Record<string, unknown>

      if (this.inputSchema) {
        // Dynamic: build from schema
        input = buildMusicInput(this.inputSchema, {
          prompt: request.prompt,
          duration,
          seed: request.seed,
          steps: request.steps,
          cfgScale: request.cfgScale
        })
      } else {
        // Fallback: existing hardcoded logic
        input = { prompt: request.prompt, duration }
        if (request.seed !== undefined) input.seed = request.seed
        if (request.steps !== undefined) input.steps = Math.min(8, Math.max(4, request.steps))
        if (request.cfgScale !== undefined) input.cfg_scale = Math.min(25, Math.max(1, request.cfgScale))
      }

      const startTime = Date.now()

      let predictTime: number | undefined
      const output = await this.withNetworkRetry(
        () => this.client.run(this.model as `${string}/${string}`, { input }, (prediction: any) => {
          if (prediction.metrics?.predict_time) {
            predictTime = prediction.metrics.predict_time
          }
        }),
        'client.run'
      )

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[ReplicateMusic] 📥 Resposta recebida em ${elapsed}s (predict_time: ${predictTime?.toFixed(2) ?? 'N/A'}s)`)

      // O output do Replicate é um FileOutput com .url()
      let audioBuffer: Buffer

      if (output && typeof (output as any).url === 'function') {
        // FileOutput - buscar o URL e baixar o conteúdo
        const fileUrl = (output as any).url()
        console.log(`[ReplicateMusic] 🔗 Baixando áudio de: ${fileUrl}`)

        const arrayBuffer = await this.withNetworkRetry(async () => {
          const response = await fetch(fileUrl)
          if (!response.ok) throw new Error(`Falha ao baixar áudio: ${response.status} ${response.statusText}`)
          return response.arrayBuffer()
        }, 'download FileOutput')
        audioBuffer = Buffer.from(arrayBuffer)
      } else if (Buffer.isBuffer(output)) {
        audioBuffer = output
      } else if (typeof output === 'string') {
        // URL direta
        console.log(`[ReplicateMusic] 🔗 Baixando áudio de URL: ${output}`)
        const arrayBuffer = await this.withNetworkRetry(async () => {
          const response = await fetch(output)
          if (!response.ok) throw new Error(`Falha ao baixar áudio: ${response.status} ${response.statusText}`)
          return response.arrayBuffer()
        }, 'download URL')
        audioBuffer = Buffer.from(arrayBuffer)
      } else {
        throw new Error(`[ReplicateMusic] Formato de output inesperado: ${typeof output}`)
      }

      console.log(`[ReplicateMusic] ✅ Música gerada com sucesso! Tamanho: ${(audioBuffer.length / 1024).toFixed(0)}KB`)

      const outputCost = calculateReplicateOutputCost(this.model, 1)
      const cost = outputCost != null ? outputCost : (predictTime != null ? calculateReplicateTimeCost(this.model, predictTime) : 0)

      return {
        audioBuffer,
        duration,
        format: 'mp3',
        provider: this.getName(),
        model: this.model,
        predictTime,
        costInfo: {
          cost,
          provider: 'REPLICATE',
          model: this.model,
          metadata: { audio_duration: duration, predict_time: predictTime }
        }
      }
    } catch (error) {
      console.error('[ReplicateMusic] ❌ Erro na geração de música:', error)
      throw error
    }
  }
}
