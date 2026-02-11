/**
 * Media Registry — SEED & FALLBACK para providers e modelos de mídia.
 * 
 * Mesma lógica do llm-registry.ts: este arquivo serve APENAS como dados iniciais
 * para popular o banco na primeira execução. Após o seed, tudo é gerenciado via banco + UI.
 * 
 * @see server/services/media/media-factory.ts
 */

// ─── Tipos ──────────────────────────────────────────────────────

export type MediaProviderId = 'replicate' | 'elevenlabs' | 'runpod' | 'gemini'

export type MediaTaskId =
  | 'image-generation'    // Geração de imagens das cenas
  | 'tts-narration'       // Narração por Text-to-Speech
  | 'background-music'    // Trilha sonora (Stable Audio)
  | 'motion-video'        // Animação de imagens em vídeo
  | 'thumbnail'           // Geração de thumbnails

export interface MediaModelInputSchema {
  /** Campo onde vai o prompt principal */
  promptField: string
  /** Como lidar com dimensões: 'aspect_ratio' | 'width_height' | 'resolution' | 'none' */
  dimensionMode?: 'aspect_ratio' | 'width_height' | 'resolution' | 'none'
  /** Campo de duração (para motion/music) */
  durationField?: string
  /** Como calcular duração: 'num_frames' (frames*fps) | 'seconds' (direto) | 'none' */
  durationMode?: 'num_frames' | 'seconds' | 'none'
  /** FPS do modelo (para durationMode=num_frames) */
  fps?: number
  /** Min/max frames (para motion) */
  minFrames?: number
  maxFrames?: number
  /** Valores default enviados sempre */
  defaults?: Record<string, any>
  /** Mapeamento: campo do request → campo da API (ex: { "seed": "seed", "cfgScale": "cfg_scale" }) */
  paramMapping?: Record<string, string>
  /** Campos que o modelo NÃO aceita (para não enviar) */
  unsupportedFields?: string[]
  /** Formato do output: como extrair o resultado da API */
  outputMode?: 'url_array' | 'file_output' | 'url_string' | 'base64' | 'buffer'
  /** Campo de imagem input (para motion: image-to-video) */
  imageField?: string
  /** Formato do image input: 'buffer' | 'base64' | 'url' */
  imageInputMode?: 'buffer' | 'base64' | 'url'
}

export interface MediaModel {
  id: string                // ID do modelo na API (ex: "luma/photon-flash")
  name: string              // Nome legível
  costTier: 1 | 2 | 3 | 4 | 5
  capabilities?: string[]   // Tags descritivas
  inputSchema?: MediaModelInputSchema  // Schema de input para construção dinâmica do payload
}

export interface MediaProvider {
  id: MediaProviderId
  name: string
  description: string
  envKey: string
  iconKey: string
  category: 'media'
  models: MediaModel[]
}

export interface MediaTask {
  id: MediaTaskId
  label: string
  description: string
  iconKey: string
  defaultProvider: MediaProviderId
  defaultModel: string
}

// ─── Providers ──────────────────────────────────────────────────

export const MEDIA_PROVIDERS: Record<MediaProviderId, MediaProvider> = {
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    description: 'Plataforma serverless para modelos de IA — imagens (Luma Photon Flash, FLUX), vídeo (Wan2.1), música (Stable Audio)',
    envKey: 'REPLICATE_API_KEY',
    iconKey: 'image',
    category: 'media',
    models: [
      {
        id: 'luma/photon-flash', name: 'Luma Photon Flash', costTier: 2,
        capabilities: ['image', 'photorealistic', 'fast'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'aspect_ratio',
          defaults: {},
          unsupportedFields: ['negative_prompt', 'num_outputs', 'seed', 'go_fast', 'width', 'height'],
          outputMode: 'file_output'
        }
      },
      {
        id: 'luma/photon', name: 'Luma Photon', costTier: 3,
        capabilities: ['image', 'photorealistic', 'quality'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'aspect_ratio',
          defaults: {},
          unsupportedFields: ['negative_prompt', 'num_outputs', 'seed', 'go_fast', 'width', 'height'],
          outputMode: 'file_output'
        }
      },
      {
        id: 'black-forest-labs/flux-schnell', name: 'FLUX Schnell', costTier: 1,
        capabilities: ['image', 'fast'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'width_height',
          defaults: { num_outputs: 1, output_format: 'png', go_fast: true },
          paramMapping: { negativePrompt: 'negative_prompt', seed: 'seed', numVariants: 'num_outputs' },
          outputMode: 'url_array'
        }
      },
      {
        id: 'black-forest-labs/flux-dev', name: 'FLUX Dev', costTier: 2,
        capabilities: ['image', 'quality'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'width_height',
          defaults: { num_outputs: 1, output_format: 'png', go_fast: true },
          paramMapping: { negativePrompt: 'negative_prompt', seed: 'seed', numVariants: 'num_outputs' },
          outputMode: 'url_array'
        }
      },
      {
        id: 'wan-video/wan-2.2-i2v-fast', name: 'Wan2.2 I2V Fast', costTier: 2,
        capabilities: ['motion', '480p', 'fast'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'none',
          durationMode: 'num_frames',
          durationField: 'num_frames',
          fps: 16,
          minFrames: 81,
          maxFrames: 121,
          imageField: 'image',
          imageInputMode: 'buffer',
          defaults: { resolution: '480p', frames_per_second: 16, go_fast: true, sample_shift: 12, disable_safety_checker: false },
          outputMode: 'file_output'
        }
      },
      {
        id: 'wan-ai/wan2.1-i2v-480p', name: 'Wan2.1 I2V 480p', costTier: 2,
        capabilities: ['motion', '480p'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'none',
          durationMode: 'num_frames',
          durationField: 'num_frames',
          fps: 16,
          minFrames: 81,
          maxFrames: 121,
          imageField: 'image',
          imageInputMode: 'buffer',
          defaults: { resolution: '480p', frames_per_second: 16, go_fast: true, sample_shift: 12, disable_safety_checker: false },
          outputMode: 'file_output'
        }
      },
      {
        id: 'wan-ai/wan2.1-i2v-720p', name: 'Wan2.1 I2V 720p', costTier: 3,
        capabilities: ['motion', '720p'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'none',
          durationMode: 'num_frames',
          durationField: 'num_frames',
          fps: 16,
          minFrames: 81,
          maxFrames: 121,
          imageField: 'image',
          imageInputMode: 'buffer',
          defaults: { resolution: '720p', frames_per_second: 16, go_fast: true, sample_shift: 8, disable_safety_checker: false },
          outputMode: 'file_output'
        }
      },
      {
        id: 'stability-ai/stable-audio-2.5', name: 'Stable Audio 2.5', costTier: 2,
        capabilities: ['music', 'bgm'],
        inputSchema: {
          promptField: 'prompt',
          durationMode: 'seconds',
          durationField: 'duration',
          defaults: {},
          paramMapping: { seed: 'seed', steps: 'steps', cfgScale: 'cfg_scale' },
          outputMode: 'file_output'
        }
      }
    ]
  },
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Narração de alta qualidade com vozes multilíngues naturais',
    envKey: 'ELEVENLABS_API_KEY',
    iconKey: 'mic',
    category: 'media',
    models: [
      {
        id: 'eleven_multilingual_v2', name: 'Multilingual v2', costTier: 3,
        capabilities: ['tts', 'multilingual', 'quality'],
        inputSchema: {
          promptField: 'text',
          defaults: {
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true }
          },
          paramMapping: { stability: 'voice_settings.stability', similarity: 'voice_settings.similarity_boost', speed: 'voice_settings.speed' },
          outputMode: 'base64'
        }
      },
      {
        id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', costTier: 2,
        capabilities: ['tts', 'fast', 'multilingual'],
        inputSchema: {
          promptField: 'text',
          defaults: {
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true }
          },
          paramMapping: { stability: 'voice_settings.stability', similarity: 'voice_settings.similarity_boost', speed: 'voice_settings.speed' },
          outputMode: 'base64'
        }
      }
    ]
  },
  runpod: {
    id: 'runpod',
    name: 'RunPod',
    description: 'GPU serverless de alta performance — Wan2.1 com controle de endpoint dedicado',
    envKey: 'RUNPOD_API_KEY',
    iconKey: 'server',
    category: 'media',
    models: [
      {
        id: 'wan2.1-i2v-720p', name: 'Wan2.1 I2V 720p (RunPod)', costTier: 3,
        capabilities: ['motion', '720p', 'dedicated'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'width_height',
          durationMode: 'num_frames',
          durationField: 'num_frames',
          fps: 16,
          minFrames: 81,
          maxFrames: 161,
          imageField: 'image_base64',
          imageInputMode: 'base64',
          defaults: {
            negative_prompt: 'blurry, low quality, distorted, watermark',
            width: 1280, height: 720,
            num_inference_steps: 40,
            guidance_scale: 5.0,
            fps: 16
          },
          paramMapping: { negativePrompt: 'negative_prompt', guidanceScale: 'guidance_scale', numInferenceSteps: 'num_inference_steps' },
          outputMode: 'base64'
        }
      }
    ]
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Geração de imagens via Imagen 3 (Google DeepMind). Alta fidelidade e prompt adherence.',
    envKey: 'GOOGLE_API_KEY',
    iconKey: 'sparkles', // Usando um icone generico disponivel
    category: 'media',
    models: [
      {
        id: 'imagen-4.0-generate-001', name: 'Imagen 4 (Quality)', costTier: 2,
        capabilities: ['image', 'photorealistic', 'quality'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'aspect_ratio',
          defaults: {
            aspectRatio: '16:9',
            sampleCount: 1,
            personGeneration: 'allow_adult',
            safetyFilterLevel: 'block_only_high'
          },
          paramMapping: { numVariants: 'sampleCount' },
          outputMode: 'base64'
        }
      },
      {
        id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast', costTier: 1,
        capabilities: ['image', 'fast'],
        inputSchema: {
          promptField: 'prompt',
          dimensionMode: 'aspect_ratio',
          defaults: {
            aspectRatio: '16:9',
            sampleCount: 1
          },
          paramMapping: { numVariants: 'sampleCount' },
          outputMode: 'base64'
        }
      }
    ]
  }
}

// ─── Tasks ──────────────────────────────────────────────────────

export const MEDIA_TASKS: Record<MediaTaskId, MediaTask> = {
  'image-generation': {
    id: 'image-generation',
    label: 'Geração de Imagens',
    description: 'Gera imagens das cenas do roteiro. Modelos fotorrealistas ou estilizados.',
    iconKey: 'image',
    defaultProvider: 'replicate',
    defaultModel: 'luma/photon-flash'
  },
  'tts-narration': {
    id: 'tts-narration',
    label: 'Narração (TTS)',
    description: 'Converte texto em narração de áudio com vozes naturais.',
    iconKey: 'mic',
    defaultProvider: 'elevenlabs',
    defaultModel: 'eleven_multilingual_v2'
  },
  'background-music': {
    id: 'background-music',
    label: 'Trilha Sonora',
    description: 'Gera trilha de fundo via IA baseada em prompts musicais.',
    iconKey: 'music',
    defaultProvider: 'replicate',
    defaultModel: 'stability-ai/stable-audio-2.5'
  },
  'motion-video': {
    id: 'motion-video',
    label: 'Vídeo Motion',
    description: 'Anima imagens estáticas em vídeo com movimento natural.',
    iconKey: 'video',
    defaultProvider: 'runpod',
    defaultModel: 'wan2.1-i2v-720p'
  },
  'thumbnail': {
    id: 'thumbnail',
    label: 'Thumbnails',
    description: 'Gera thumbnails otimizadas para YouTube, TikTok, etc.',
    iconKey: 'layout',
    defaultProvider: 'replicate',
    defaultModel: 'luma/photon-flash'
  }
}

// ─── Helpers ────────────────────────────────────────────────────

export function getMediaProviders(): MediaProvider[] {
  return Object.values(MEDIA_PROVIDERS)
}

export function getMediaTasks(): MediaTask[] {
  return Object.values(MEDIA_TASKS)
}

export function getMediaModel(providerId: string, modelId: string): MediaModel | undefined {
  const provider = MEDIA_PROVIDERS[providerId as MediaProviderId]
  return provider?.models.find(m => m.id === modelId)
}

export function isValidMediaConfig(providerId: string, modelId: string): boolean {
  return !!getMediaModel(providerId, modelId)
}
