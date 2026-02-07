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
      apiKey: config.providers.script.apiKey,
      model: config.providers.script.model
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
  // Só configura RunPod se tiver Endpoint ID e API Key. Caso contrário, tenta Replicate.
  const motionProviderName = config.providers.motion.name?.toLowerCase()
  const runpodKey = config.providers.motion.apiKey || process.env.RUNPOD_API_KEY
  const runpodEndpoint = config.providers.motion.endpointId || process.env.RUNPOD_ENDPOINT_ID

  if (motionProviderName === 'runpod' && runpodKey && runpodEndpoint) {
    providers.push({
      type: 'motion' as const,
      name: 'runpod',
      apiKey: runpodKey,
      endpointId: runpodEndpoint
    })
  } else if (config.providers.image.apiKey || process.env.REPLICATE_API_KEY) {
    // Fallback para Replicate (usando a chave de imagem se a de motion for vazia)
    providers.push({
      type: 'motion' as const,
      name: 'replicate',
      apiKey: config.providers.image.apiKey || process.env.REPLICATE_API_KEY || ''
    })
  }

  if (providers.length > 0) {
    providerManager.configure(providers)
    console.log(`[TheGapFiles] Configured ${providers.length} AI providers`)
  } else {
    console.warn('[TheGapFiles] No AI providers configured. Check your .env file.')
  }
})
