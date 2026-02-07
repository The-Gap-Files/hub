/**
 * Provider Factory - Gerenciador de provedores de IA
 * 
 * Este módulo centraliza a criação e gestão de provedores,
 * permitindo trocar implementações através de configuração.
 */

import type {
  IScriptGenerator,
  ITTSProvider,
  IImageGenerator,
  IMotionProvider,
  IMusicProvider,
  ProviderConfig
} from '../../types/ai-providers'

import { OpenAIScriptProvider } from './script/openai-script.provider'
import { AnthropicScriptProvider } from './script/anthropic-script.provider'
import { ElevenLabsTTSProvider } from './tts/elevenlabs-tts.provider'
import { ReplicateElevenLabsProvider } from './tts/replicate-elevenlabs.provider'
import { ReplicateImageProvider } from './image/replicate-image.provider'
import { ReplicateMotionProvider } from './motion/replicate-motion.provider'
import { RunPodMotionProvider } from './motion/runpod-motion.provider'
import { ReplicateMusicProvider } from './music/replicate-music.provider'

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================

const scriptProviders: Record<string, new (config: { apiKey: string; model?: string }) => IScriptGenerator> = {
  openai: OpenAIScriptProvider,
  anthropic: AnthropicScriptProvider
}

const ttsProviders: Record<string, new (config: { apiKey: string }) => ITTSProvider> = {
  elevenlabs: ElevenLabsTTSProvider,
  replicate_elevenlabs: ReplicateElevenLabsProvider
}

const imageProviders: Record<string, new (config: { apiKey: string }) => IImageGenerator> = {
  replicate: ReplicateImageProvider
}

const motionProviders: Record<string, new (config: { apiKey: string }) => IMotionProvider> = {
  replicate: ReplicateMotionProvider,
  runpod: RunPodMotionProvider
}

const musicProviders: Record<string, new (config: { apiKey: string }) => IMusicProvider> = {
  replicate: ReplicateMusicProvider
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

export function createScriptProvider(name: string, apiKey: string, model?: string): IScriptGenerator {
  const ProviderClass = scriptProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`Script provider "${name}" not found. Available: ${Object.keys(scriptProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey, model })
}

export function createTTSProvider(name: string, apiKey: string): ITTSProvider {
  const ProviderClass = ttsProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`TTS provider "${name}" not found. Available: ${Object.keys(ttsProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey })
}

export function createImageProvider(name: string, apiKey: string, model?: string): IImageGenerator {
  const ProviderClass = imageProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`Image provider "${name}" not found. Available: ${Object.keys(imageProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey, model } as any)
}

export function createMotionProvider(name: string, apiKey: string, model?: string): IMotionProvider {
  const ProviderClass = motionProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`Motion provider "${name}" not found. Available: ${Object.keys(motionProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey, model } as any)
}

export function createMusicProvider(name: string, apiKey: string, model?: string): IMusicProvider {
  const ProviderClass = musicProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`Music provider "${name}" not found. Available: ${Object.keys(musicProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey, model } as any)
}

// =============================================================================
// PROVIDER MANAGER (Singleton para uso em toda a aplicação)
// =============================================================================

class ProviderManager {
  private scriptProvider: IScriptGenerator | null = null
  private ttsProvider: ITTSProvider | null = null
  private imageProvider: IImageGenerator | null = null
  private motionProvider: IMotionProvider | null = null
  private musicProvider: IMusicProvider | null = null

  configure(configs: ProviderConfig[]): void {
    for (const config of configs) {
      switch (config.type) {
        case 'script':
          this.scriptProvider = createScriptProvider(config.name, config.apiKey!, config.model)
          break
        case 'tts':
          this.ttsProvider = createTTSProvider(config.name, config.apiKey!)
          break
        case 'image':
          this.imageProvider = createImageProvider(config.name, config.apiKey!, config.model)
          break
        case 'motion':
          this.motionProvider = createMotionProvider(config.name, config.apiKey!, config.model)
          break
        case 'music':
          this.musicProvider = createMusicProvider(config.name, config.apiKey!, config.model)
          break
      }
    }
  }

  getScriptProvider(): IScriptGenerator {
    if (!this.scriptProvider) {
      throw new Error('Script provider not configured. Call configure() first.')
    }
    return this.scriptProvider
  }

  getTTSProvider(): ITTSProvider {
    if (!this.ttsProvider) {
      throw new Error('TTS provider not configured. Call configure() first.')
    }
    return this.ttsProvider
  }

  getImageProvider(): IImageGenerator {
    if (!this.imageProvider) {
      // Auto-configure fallback
      const replicateKey = process.env.REPLICATE_API_KEY?.replace(/"/g, '')
      if (replicateKey) {
        console.log('[ProviderManager] Auto-configuring Image Provider with Replicate (ENV)')
        this.imageProvider = createImageProvider('replicate', replicateKey)
        return this.imageProvider
      }

      throw new Error('Image provider not configured. Call configure() first.')
    }
    return this.imageProvider
  }

  getMotionProvider(): IMotionProvider {
    if (!this.motionProvider) {
      // Auto-configure fallback if API Key exists in env
      // Valida se a chave existe e não é uma string vazia (ou literal "")
      const runpodKey = process.env.RUNPOD_API_KEY?.replace(/"/g, '')
      const runpodEndpoint = process.env.RUNPOD_ENDPOINT_ID?.replace(/"/g, '')

      if (runpodKey && runpodEndpoint) {
        this.motionProvider = createMotionProvider('runpod', runpodKey)
        return this.motionProvider
      }

      const replicateKey = process.env.REPLICATE_API_KEY?.replace(/"/g, '')
      if (replicateKey) {
        this.motionProvider = createMotionProvider('replicate', replicateKey)
        return this.motionProvider
      }

      throw new Error('Motion provider not configured. Call configure() first.')
    }
    return this.motionProvider
  }

  getMusicProvider(): IMusicProvider {
    if (!this.musicProvider) {
      // Auto-configure fallback com Replicate (mesmo provider de image/motion)
      const replicateKey = process.env.REPLICATE_API_KEY?.replace(/"/g, '')
      if (replicateKey) {
        console.log('[ProviderManager] Auto-configuring Music Provider with Replicate (Stable Audio 2.5)')
        this.musicProvider = createMusicProvider('replicate', replicateKey)
        return this.musicProvider
      }

      throw new Error('Music provider not configured. Call configure() first or set REPLICATE_API_KEY.')
    }
    return this.musicProvider
  }
}

// Singleton exportado
export const providerManager = new ProviderManager()

// Re-exportar provedores para uso direto se necessário
export { OpenAIScriptProvider } from './script/openai-script.provider'
export { AnthropicScriptProvider } from './script/anthropic-script.provider'
export { ElevenLabsTTSProvider } from './tts/elevenlabs-tts.provider'
export { ReplicateElevenLabsProvider } from './tts/replicate-elevenlabs.provider'
export { ReplicateImageProvider } from './image/replicate-image.provider'
export { ReplicateMotionProvider } from './motion/replicate-motion.provider'
export { RunPodMotionProvider } from './motion/runpod-motion.provider'
export { ReplicateMusicProvider } from './music/replicate-music.provider'
