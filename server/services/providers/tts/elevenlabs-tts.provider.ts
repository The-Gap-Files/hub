/**
 * Implementação do provedor TTS usando ElevenLabs
 * 
 * Este provedor usa a API da ElevenLabs para converter texto em áudio
 * com vozes de alta qualidade e naturalidade.
 */

import type {
  ITTSProvider,
  TTSRequest,
  TTSResponse,
  VoiceOption
} from '../../../types/ai-providers'

export class ElevenLabsTTSProvider implements ITTSProvider {
  private apiKey: string
  private baseUrl: string

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? 'https://api.elevenlabs.io/v1'
  }

  getName(): string {
    return 'elevenlabs'
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${request.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text: request.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: request.stability ?? 0.5,
            similarity_boost: request.similarity ?? 0.75,
            style: 0.5,
            use_speaker_boost: true
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`)
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())

    // Estimar duração baseado no tamanho do texto (aprox. 150 palavras/min)
    const wordCount = request.text.split(/\s+/).length
    const estimatedDuration = (wordCount / 150) * 60

    return {
      audioBuffer,
      duration: estimatedDuration,
      provider: this.getName(),
      format: 'mp3'
    }
  }

  async getAvailableVoices(): Promise<VoiceOption[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey
      }
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const data = await response.json()

    return data.voices.map((voice: {
      voice_id: string
      name: string
      labels?: { language?: string }
      preview_url?: string
    }) => ({
      id: voice.voice_id,
      name: voice.name,
      language: voice.labels?.language ?? 'en',
      preview_url: voice.preview_url
    }))
  }
}
