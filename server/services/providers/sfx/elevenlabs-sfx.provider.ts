/**
 * ElevenLabs Sound Effects Provider
 *
 * Gera efeitos sonoros (SFX) a partir de prompts textuais usando
 * a API de Sound Effects v2 do ElevenLabs.
 * 
 * POST https://api.elevenlabs.io/v1/sound-generation
 * Body: { text, duration_seconds?, prompt_influence? }
 * Response: audio/mpeg (binary)
 * 
 * Pricing: 40 créditos/segundo de áudio gerado (com duração especificada)
 *          100 créditos por geração (sem duração especificada)
 */

import type {
  ISFXProvider,
  SFXGenerationRequest,
  SFXGenerationResponse,
  ProviderCostInfo
} from '../../../types/ai-providers'

/** Custo SFX do ElevenLabs (Plano Scale: $330 / 2M créditos = $0.000165/crédito) */
const COST_PER_CREDIT = 0.000165
const CREDITS_PER_SECOND = 40
const CREDITS_FIXED = 100 // quando não especifica duração

export class ElevenLabsSFXProvider implements ISFXProvider {
  private apiKey: string
  private baseUrl: string
  private model = 'eleven_text_to_sound_v2'

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? 'https://api.elevenlabs.io/v1'
  }

  getName(): string {
    return 'ELEVENLABS'
  }

  async generate(request: SFXGenerationRequest): Promise<SFXGenerationResponse> {
    console.log(`[ElevenLabs SFX] 🔊 Generating SFX: "${request.prompt.slice(0, 80)}..." duration=${request.durationSeconds ?? 'auto'}s`)

    const body: Record<string, unknown> = {
      text: request.prompt,
      prompt_influence: request.promptInfluence ?? 0.3
    }

    // Duração opcional (0.1-30s)
    if (request.durationSeconds !== undefined) {
      body.duration_seconds = Math.max(0.1, Math.min(30, request.durationSeconds))
    }

    const response = await fetch(`${this.baseUrl}/sound-generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[ElevenLabs SFX] ❌ API Error: ${response.status} - ${errorText}`)
      throw new Error(`ElevenLabs SFX API error: ${response.status} - ${errorText}`)
    }

    // Response é audio binário direto (audio/mpeg)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    console.log(`[ElevenLabs SFX] ✅ SFX generated: ${(audioBuffer.length / 1024).toFixed(0)} KB`)

    // Estimar duração do áudio gerado (mp3, ~128kbps = 16KB/s)
    const estimatedDuration = request.durationSeconds ?? (audioBuffer.length / (128 * 1024 / 8))

    // Calcular custo
    const credits = request.durationSeconds
      ? CREDITS_PER_SECOND * request.durationSeconds
      : CREDITS_FIXED
    const cost = credits * COST_PER_CREDIT

    const costInfo: ProviderCostInfo = {
      cost,
      provider: 'ELEVENLABS',
      model: this.model,
      metadata: {
        credits,
        durationSeconds: request.durationSeconds ?? 'auto',
        promptLength: request.prompt.length,
        audioSizeKB: Math.round(audioBuffer.length / 1024)
      }
    }

    return {
      audioBuffer,
      duration: estimatedDuration,
      format: 'mp3',
      provider: this.getName(),
      model: this.model,
      costInfo
    }
  }
}
