/**
 * Implementação do provedor TTS usando ElevenLabs
 * 
 * Usa o endpoint /with-timestamps para obter o áudio + alignment por caractere.
 * Os character timestamps são convertidos em word-level timestamps,
 * permitindo sincronização perfeita de legendas com a narração.
 */

import type {
  ITTSProvider,
  TTSRequest,
  TTSResponse,
  TTSCharacterAlignment,
  TTSWordTiming,
  VoiceOption,
  VoiceListOptions,
  VoiceListResponse
} from '../../../types/ai-providers'
import { calculateElevenLabsCost } from '../../../constants/pricing'

export class ElevenLabsTTSProvider implements ITTSProvider {
  private apiKey: string
  private baseUrl: string

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? 'https://api.elevenlabs.io/v1'
  }

  getName(): string {
    return 'ELEVENLABS'
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const voiceId = request.voiceId

    if (!voiceId || voiceId === 'default') {
      throw new Error('[ElevenLabs] ❌ Voice ID is required. Please select a voice from the list or provide a custom Voice ID.')
    }

    console.log(`[ElevenLabs] 🚀 Sending request to /with-timestamps. Voice: ${voiceId}, Text len: ${request.text.length}`)

    try {
      // Usar endpoint /with-timestamps para obter character-level alignment
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}/with-timestamps`,
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
              stability: request.stability ?? 0.35,
              similarity_boost: request.similarity ?? 0.8,
              style: 0.7,
              use_speaker_boost: true,
              speed: request.speed ?? 1.0
            }
          })
        }
      )

      console.log(`[ElevenLabs] 📡 Response status: ${response.status}`)

      if (!response.ok) {
        const error = await response.text()
        console.error(`[ElevenLabs] ❌ API Error: ${response.status} - ${error}`)
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`)
      }

      // Resposta é JSON com audio_base64 + alignment
      const data = await response.json() as {
        audio_base64: string
        alignment: TTSCharacterAlignment | null
        normalized_alignment: TTSCharacterAlignment | null
      }

      // Decodificar áudio de base64
      const audioBuffer = Buffer.from(data.audio_base64, 'base64')
      console.log(`[ElevenLabs] ✅ Audio decoded. Size: ${audioBuffer.length}`)

      // Usar normalized_alignment (texto normalizado) ou alignment (texto original)
      const alignment = data.normalized_alignment || data.alignment || null

      // Converter character alignment → word timings
      let wordTimings: TTSWordTiming[] | null = null
      let duration = 0

      if (alignment) {
        wordTimings = this.characterAlignmentToWordTimings(alignment)
        // Duração real = último timestamp
        const lastEnd = alignment.character_end_times_seconds
        duration = lastEnd.length > 0 ? lastEnd[lastEnd.length - 1]! : 0
        console.log(`[ElevenLabs] 📊 Alignment: ${wordTimings.length} words, duration: ${duration.toFixed(2)}s`)
      } else {
        // Fallback: estimativa
        const wordCount = request.text.split(/\s+/).length
        const speechSpeed = request.speed || 1.0
        duration = (wordCount / (150 * speechSpeed)) * 60
        console.warn(`[ElevenLabs] ⚠️ No alignment data, using estimated duration: ${duration.toFixed(2)}s`)
      }

      const model = 'eleven_multilingual_v2'
      return {
        audioBuffer,
        duration,
        provider: this.getName(),
        format: 'mp3',
        alignment,
        wordTimings,
        costInfo: {
          cost: calculateElevenLabsCost(model, request.text.length),
          provider: 'ELEVENLABS',
          model,
          metadata: { characters: request.text.length }
        }
      }
    } catch (e) {
      console.error('[ElevenLabs] 💥 Exception calling API:', e)
      throw e
    }
  }

  /**
   * Converte character-level alignment em word-level timings
   * 
   * A API retorna timestamps por caractere. Agrupamos por palavras
   * usando espaços como delimitador. Cada palavra recebe o startTime
   * do primeiro caractere e o endTime do último.
   */
  private characterAlignmentToWordTimings(alignment: TTSCharacterAlignment): TTSWordTiming[] {
    const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment
    const words: TTSWordTiming[] = []

    let currentWord = ''
    let wordStartTime = -1

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i]!
      const charStart = starts[i]!
      const charEnd = ends[i]!

      // Espaço ou quebra de linha = fim da palavra atual
      if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
        if (currentWord.trim()) {
          words.push({
            word: currentWord,
            startTime: wordStartTime,
            endTime: charStart // End time = início do espaço (antes da pausa)
          })
        }
        currentWord = ''
        wordStartTime = -1
        continue
      }

      // Acumular caractere na palavra atual
      if (wordStartTime < 0) {
        wordStartTime = charStart
      }
      currentWord += char

      // Última posição: fechar a palavra
      if (i === characters.length - 1 && currentWord.trim()) {
        words.push({
          word: currentWord,
          startTime: wordStartTime,
          endTime: charEnd
        })
      }
    }

    return words
  }

  async getAvailableVoices(options?: VoiceListOptions): Promise<VoiceListResponse> {
    const params = new URLSearchParams()
    if (options?.pageSize) params.append('page_size', options.pageSize.toString())
    if (options?.cursor) params.append('next_page_token', options.cursor)

    const url = `https://api.elevenlabs.io/v2/voices?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        'xi-api-key': this.apiKey
      }
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const data = await response.json()

    const voices = data.voices.map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name,
      language: voice.labels?.language ?? 'en',
      preview_url: voice.preview_url,
      labels: voice.labels
    }))

    return {
      voices,
      nextCursor: data.next_page_token || undefined
    }
  }
}
