import Replicate from 'replicate'
import type {
  ITTSProvider,
  TTSRequest,
  TTSResponse,
  VoiceOption
} from '../../../types/ai-providers'
import { calculateReplicateTimeCost } from '../../../constants/pricing'

export class ReplicateElevenLabsProvider implements ITTSProvider {
  private replicate: Replicate

  constructor(config: { apiKey: string }) {
    this.replicate = new Replicate({
      auth: config.apiKey,
    })
  }

  getName(): string {
    return 'ELEVENLABS' // Masquerade as ElevenLabs to satisfy Prisma AIProvider Enum
  }

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    console.log(`[ReplicateElevenLabs] 🚀 Sending request. Voice: ${request.voiceId || 'Rachel'}`)

    try {
      // Replicate NÃO entende tags inline do Eleven v3 nem SSML.
      // Para evitar que o modelo "leia" tokens como "[pause]" ou "<break .../>",
      // removemos essas marcações do texto enviado.
      const cleanedText = String(request.text || '')
        .replace(/<break\b[^>]*\/?>/gi, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Lista de vozes suportadas pelo Replicate
      const supportedVoices = [
        "Rachel", "Drew", "Clyde", "Paul", "Aria", "Domi", "Dave", "Roger", "Fin", "Sarah",
        "James", "Jane", "Juniper", "Arabella", "Hope", "Bradford", "Reginald", "Gaming",
        "Austin", "Kuon", "Blondie", "Priyanka", "Alexandra", "Monika", "Mark", "Grimblewood"
      ]

      let voice = request.voiceId || 'Rachel'

      // Check for environment variable override
      if (process.env.ELEVENLABS_REPLICATE_VOICE_NAME) {
        voice = process.env.ELEVENLABS_REPLICATE_VOICE_NAME
        console.log(`[ReplicateElevenLabs] 🧪 Overriding voice with env var: ${voice}`)
      }

      // Se a voz solicitada não estiver na lista suportada, logar warning e usar 'Aria' (Exemplo comum)
      if (!supportedVoices.includes(voice)) {
        console.warn(`[ReplicateElevenLabs] ⚠️ Voice ID "${voice}" not supported by Replicate model. Formatting to 'Aria' for test.`)
        voice = 'Aria' // Fallback seguro
      }

      // Mapear request para o schema do Replicate
      const input = {
        prompt: cleanedText,
        voice: voice,
        language_code: request.language?.split('-')[0] || 'pt', // 'pt-BR' -> 'pt'
        stability: request.stability ?? 0.35, // Default Mistério
        similarity_boost: request.similarity ?? 0.8,
        style: 0.7, // Estilo Mistério Hardcoded para o teste
        speed: request.speed ?? 1.0,
      }

      console.log('[ReplicateElevenLabs] 📡 Input:', JSON.stringify(input, null, 2))

      // Modelo elevenlabs/v2-multilingual
      const model = 'elevenlabs/v2-multilingual'
      let predictTime: number | undefined
      const output = await this.replicate.run(
        model as `${string}/${string}`,
        { input },
        (prediction: any) => {
          if (prediction.metrics?.predict_time) {
            predictTime = prediction.metrics.predict_time
          }
        }
      ) as any

      console.log(`[ReplicateElevenLabs] 📥 Output received (Stream/URL):`, output)

      // Replicate retorna um ReadableStream ou URL.
      // Se for stream, precisamos converter p/ Buffer.
      let audioBuffer: Buffer

      if (output instanceof ReadableStream) {
        // @ts-ignore
        const arrayBuffer = await new Response(output).arrayBuffer()
        audioBuffer = Buffer.from(arrayBuffer)
      } else if (typeof output === 'string' && output.startsWith('http')) {
        // Se retornar URL
        const res = await fetch(output)
        audioBuffer = Buffer.from(await res.arrayBuffer())
      } else {
        // Caso devolva array buffer direto
        audioBuffer = Buffer.from(output)
      }

      console.log(`[ReplicateElevenLabs] ✅ Buffer created. Size: ${audioBuffer.length}`)

      // Estimar duração (fallback)
      const wordCount = cleanedText.split(/\s+/).filter(Boolean).length
      const estimatedDuration = (wordCount / (150 * (request.speed || 1.0))) * 60

      // predictTime da API ou estimativa baseada na duração do áudio (proxy para GPU time)
      const predictTimeForCost = predictTime ?? estimatedDuration

      return {
        audioBuffer,
        duration: estimatedDuration,
        provider: this.getName(),
        format: 'mp3',
        costInfo: {
          cost: calculateReplicateTimeCost(model, predictTimeForCost),
          provider: 'REPLICATE',
          model,
          metadata: { characters: cleanedText.length, predict_time: predictTimeForCost }
        }
      }

    } catch (e) {
      console.error('[ReplicateElevenLabs] 💥 Error:', e)
      throw e
    }
  }

  async getAvailableVoices(options?: any): Promise<{ voices: VoiceOption[], nextCursor?: string }> {
    // Replicate não tem endpoint de listar vozes dinamicamente como a API oficial.
    // Retornamos a lista hardcoded do schema.
    const voices = [
      "Rachel", "Drew", "Clyde", "Paul", "Aria", "Domi", "Dave", "Roger", "Fin", "Sarah",
      "James", "Jane", "Juniper", "Arabella", "Hope", "Bradford", "Reginald", "Gaming",
      "Austin", "Kuon", "Blondie", "Priyanka", "Alexandra", "Monika", "Mark", "Grimblewood"
    ]

    const mappedVoices = voices.map(v => ({
      id: v,
      name: v,
      language: 'en', // Assumido, já que é multilingual
      preview_url: ''
    }))

    return {
      voices: mappedVoices,
      nextCursor: undefined
    }
  }
}
