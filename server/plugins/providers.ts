/**
 * Plugin de inicialização dos provedores de IA
 * 
 * Configura os provedores no início da aplicação com base
 * nas variáveis de ambiente.
 */

import { providerManager } from '../services/providers'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()

  // Configurar provedores
  const providers = []

  // Script Provider (OpenAI, Anthropic, etc.)
  if (config.providers.script.apiKey) {
    providers.push({
      type: 'script' as const,
      name: config.providers.script.name,
      apiKey: config.providers.script.apiKey
    })
  }

  // TTS Provider (ElevenLabs)
  if (config.providers.tts.apiKey) {
    providers.push({
      type: 'tts' as const,
      name: config.providers.tts.name,
      apiKey: config.providers.tts.apiKey
    })
  }

  // Image Provider (Replicate)
  if (config.providers.image.apiKey) {
    providers.push({
      type: 'image' as const,
      name: config.providers.image.name,
      apiKey: config.providers.image.apiKey,
      model: config.providers.image.model
    })
  }

  // Motion Provider (RunPod ou Replicate)
  if (config.providers.motion.apiKey || config.providers.image.apiKey) {
    const motionProviderName = config.providers.motion.name || 'replicate'
    const motionApiKey = config.providers.motion.apiKey || config.providers.image.apiKey

    providers.push({
      type: 'motion' as const,
      name: motionProviderName,
      apiKey: motionApiKey,
      endpointId: config.providers.motion.endpointId
    })
  }

  if (providers.length > 0) {
    providerManager.configure(providers)
    console.log(`[TheGapFiles] Configured ${providers.length} AI providers`)
  } else {
    console.warn('[TheGapFiles] No AI providers configured. Check your .env file.')
  }
})
