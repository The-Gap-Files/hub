/**
 * Provider Factory - Gerenciador de provedores de IA
 * 
 * Este módulo centraliza a criação e gestão de provedores,
 * permitindo trocar implementações através de configuração.
 *
 * O Script Provider é resolvido dinamicamente via LLM Factory (banco de dados),
 * garantindo que a configuração da UI seja sempre respeitada.
 */

import type {
  IScriptGenerator,
  ITTSProvider,
  IImageGenerator,
  IMotionProvider,
  IMusicProvider,
  ISFXProvider,
  ProviderConfig
} from '../../types/ai-providers'

import { OpenAIScriptProvider } from './script/openai-script.provider'
import { AnthropicScriptProvider } from './script/anthropic-script.provider'
import { GeminiScriptProvider } from './script/gemini-script.provider'
import { GroqScriptProvider } from './script/groq-script.provider'
import { ElevenLabsTTSProvider } from './tts/elevenlabs-tts.provider'
import { ReplicateElevenLabsProvider } from './tts/replicate-elevenlabs.provider'
import { ReplicateImageProvider } from './image/replicate-image.provider'
import { GeminiImageProvider } from './image/gemini-image.provider'
import { ReplicateMotionProvider } from './motion/replicate-motion.provider'
import { RunPodMotionProvider } from './motion/runpod-motion.provider'
import { ReplicateMusicProvider } from './music/replicate-music.provider'
import { ElevenLabsSFXProvider } from './sfx/elevenlabs-sfx.provider'
import { getMediaProviderForTaskSync, getMediaProviderForTask } from '../media/media-factory'
import { getAssignment } from '../llm/llm-factory'
import { prisma } from '../../utils/prisma'

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================

const scriptProviders: Record<string, new (config: { apiKey: string; model?: string }) => IScriptGenerator> = {
  openai: OpenAIScriptProvider,
  anthropic: AnthropicScriptProvider,
  gemini: GeminiScriptProvider,
  groq: GroqScriptProvider
}

const ttsProviders: Record<string, new (config: { apiKey: string }) => ITTSProvider> = {
  elevenlabs: ElevenLabsTTSProvider,
  replicate_elevenlabs: ReplicateElevenLabsProvider
}

const imageProviders: Record<string, new (config: { apiKey: string }) => IImageGenerator> = {
  replicate: ReplicateImageProvider,
  gemini: GeminiImageProvider
}

const motionProviders: Record<string, new (config: { apiKey: string }) => IMotionProvider> = {
  replicate: ReplicateMotionProvider,
  runpod: RunPodMotionProvider
}

const musicProviders: Record<string, new (config: { apiKey: string }) => IMusicProvider> = {
  replicate: ReplicateMusicProvider
}

const sfxProviders: Record<string, new (config: { apiKey: string }) => ISFXProvider> = {
  elevenlabs: ElevenLabsSFXProvider
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

export function createImageProvider(name: string, apiKey: string, model?: string, inputSchema?: any): IImageGenerator {
  const ProviderClass = imageProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`Image provider "${name}" not found. Available: ${Object.keys(imageProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey, model, inputSchema } as any)
}

export function createMotionProvider(name: string, apiKey: string, model?: string, inputSchema?: any): IMotionProvider {
  const ProviderClass = motionProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`Motion provider "${name}" not found. Available: ${Object.keys(motionProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey, model, inputSchema } as any)
}

export function createMusicProvider(name: string, apiKey: string, model?: string, inputSchema?: any): IMusicProvider {
  const ProviderClass = musicProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`Music provider "${name}" not found. Available: ${Object.keys(musicProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey, model, inputSchema } as any)
}

export function createSFXProvider(name: string, apiKey: string): ISFXProvider {
  const ProviderClass = sfxProviders[name.toLowerCase()]
  if (!ProviderClass) {
    throw new Error(`SFX provider "${name}" not found. Available: ${Object.keys(sfxProviders).join(', ')}`)
  }
  return new ProviderClass({ apiKey })
}

// =============================================================================
// PROVIDER MANAGER (Singleton para uso em toda a aplicação)
// =============================================================================

class ProviderManager {
  private ttsProvider: ITTSProvider | null = null
  private imageProvider: IImageGenerator | null = null
  private motionProvider: IMotionProvider | null = null
  private musicProvider: IMusicProvider | null = null
  private sfxProvider: ISFXProvider | null = null

  configure(configs: ProviderConfig[]): void {
    for (const config of configs) {
      switch (config.type) {
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
        case 'sfx':
          this.sfxProvider = createSFXProvider(config.name, config.apiKey!)
          break
      }
    }
  }

  /**
   * Invalida todas as instâncias de provider em cache.
   * Na próxima chamada a getXxxProvider(), o provider será recriado
   * com a configuração mais recente do banco (via media-factory).
   */
  invalidateProviders(): void {
    this.imageProvider = null
    this.ttsProvider = null
    this.motionProvider = null
    this.musicProvider = null
    this.sfxProvider = null
    console.log('[ProviderManager] All provider instances invalidated')
  }

  /**
   * Resolve o Script Provider dinamicamente via LLM Factory (banco de dados).
   * Sempre consulta o assignment 'script' no banco para respeitar a configuração da UI.
   */
  async getScriptProvider(): Promise<IScriptGenerator> {
    const assignment = await getAssignment('script')

    // Buscar API key do provider no banco
    const dbProvider = await prisma.llmProvider.findUnique({
      where: { id: assignment.provider },
      select: { apiKey: true }
    })

    let apiKey = dbProvider?.apiKey || ''

    // Fallback: env vars
    if (!apiKey) {
      const envMap: Record<string, string> = {
        openai: 'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        groq: 'GROQ_API_KEY',
        gemini: 'GOOGLE_API_KEY'
      }
      apiKey = process.env[envMap[assignment.provider] || '']?.replace(/"/g, '') || ''
    }

    if (!apiKey) {
      throw new Error(
        `[ProviderManager] API Key não configurada para script provider "${assignment.provider}". ` +
        `Configure via UI (Settings → Providers).`
      )
    }

    console.log(`[ProviderManager] Script → ${assignment.provider}/${assignment.model} (LLM Factory)`)
    return createScriptProvider(assignment.provider, apiKey, assignment.model)
  }

  getTTSProvider(): ITTSProvider {
    if (!this.ttsProvider) {
      const config = getMediaProviderForTaskSync('tts-narration')
      if (config?.apiKey) {
        console.log(`[ProviderManager] TTS → ${config.providerId}/${config.model} (Media Factory)`)
        this.ttsProvider = createTTSProvider(config.providerId, config.apiKey)
        return this.ttsProvider
      }

      throw new Error(
        'TTS provider not configured. Configure via UI (Settings → Providers) ou defina ELEVENLABS_API_KEY no .env.'
      )
    }
    return this.ttsProvider
  }

  getImageProvider(): IImageGenerator {
    if (!this.imageProvider) {
      const config = getMediaProviderForTaskSync('image-generation')
      if (config?.apiKey) {
        console.log(`[ProviderManager] Image → ${config.providerId}/${config.model} (Media Factory)`)
        this.imageProvider = createImageProvider(config.providerId, config.apiKey, config.model, config.inputSchema)
        return this.imageProvider
      }

      throw new Error(
        'Image provider not configured. Configure via UI (Settings → Providers) ou defina REPLICATE_API_KEY no .env.'
      )
    }
    return this.imageProvider
  }

  getMotionProvider(): IMotionProvider {
    if (!this.motionProvider) {
      const config = getMediaProviderForTaskSync('motion-video')
      if (config?.apiKey) {
        // RunPod precisa do endpointId via extraConfig
        if (config.providerId === 'runpod' && config.extraConfig?.endpointId) {
          process.env.RUNPOD_ENDPOINT_ID = config.extraConfig.endpointId as string
        }
        console.log(`[ProviderManager] Motion → ${config.providerId}/${config.model} (Media Factory)`)
        this.motionProvider = createMotionProvider(config.providerId, config.apiKey, config.model, config.inputSchema)
        return this.motionProvider
      }

      throw new Error(
        'Motion provider not configured. Configure via UI (Settings → Providers) ou defina RUNPOD_API_KEY ou REPLICATE_API_KEY no .env.'
      )
    }
    return this.motionProvider
  }

  getMusicProvider(): IMusicProvider {
    if (!this.musicProvider) {
      const config = getMediaProviderForTaskSync('background-music')
      if (config?.apiKey) {
        console.log(`[ProviderManager] Music → ${config.providerId}/${config.model} (Media Factory)`)
        this.musicProvider = createMusicProvider(config.providerId, config.apiKey, config.model, config.inputSchema)
        return this.musicProvider
      }

      throw new Error(
        'Music provider not configured. Configure via UI (Settings → Providers) ou defina REPLICATE_API_KEY no .env.'
      )
    }
    return this.musicProvider
  }

  getSFXProvider(): ISFXProvider {
    if (!this.sfxProvider) {
      // SFX usa a mesma API key do TTS (ElevenLabs)
      const config = getMediaProviderForTaskSync('sfx')
      if (config?.apiKey) {
        console.log(`[ProviderManager] SFX → ${config.providerId}/${config.model || 'default'} (Media Factory)`)
        this.sfxProvider = createSFXProvider(config.providerId, config.apiKey)
        return this.sfxProvider
      }

      // Fallback: tentar usar a mesma key do TTS
      const ttsConfig = getMediaProviderForTaskSync('tts-narration')
      if (ttsConfig?.apiKey) {
        console.log(`[ProviderManager] SFX → elevenlabs (fallback da key TTS)`)
        this.sfxProvider = createSFXProvider('elevenlabs', ttsConfig.apiKey)
        return this.sfxProvider
      }

      throw new Error(
        'SFX provider not configured. Configure via UI (Settings → Providers) ou defina ELEVENLABS_API_KEY no .env.'
      )
    }
    return this.sfxProvider
  }
}

// Singleton exportado
export const providerManager = new ProviderManager()

// Re-exportar provedores para uso direto se necessário
export { OpenAIScriptProvider } from './script/openai-script.provider'
export { AnthropicScriptProvider } from './script/anthropic-script.provider'
export { GeminiScriptProvider } from './script/gemini-script.provider'
export { GroqScriptProvider } from './script/groq-script.provider'
export { ElevenLabsTTSProvider } from './tts/elevenlabs-tts.provider'
export { ReplicateElevenLabsProvider } from './tts/replicate-elevenlabs.provider'
export { ReplicateImageProvider } from './image/replicate-image.provider'
export { ReplicateMotionProvider } from './motion/replicate-motion.provider'
export { RunPodMotionProvider } from './motion/runpod-motion.provider'
export { ReplicateMusicProvider } from './music/replicate-music.provider'
export { ElevenLabsSFXProvider } from './sfx/elevenlabs-sfx.provider'