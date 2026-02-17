/**
 * Input Schema Builder — Constrói payloads de API a partir do inputSchema do modelo.
 * 
 * Cada modelo de mídia no banco tem um campo `inputSchema` (JSON) que descreve
 * como montar o payload para a API. Este builder lê o schema e monta dinamicamente.
 * 
 * Se o modelo não tiver inputSchema, retorna null — o provider usa fallback hardcoded.
 * Isso garante backward compatibility total.
 * 
 * @see server/constants/media-registry.ts — definição do MediaModelInputSchema
 */

import type { MediaModelInputSchema } from '../constants/media-registry'

// =============================================================================
// IMAGE — Monta payload para geradores de imagem
// =============================================================================

export interface ImageInputContext {
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  aspectRatio?: string
  seed?: number
  numVariants?: number
  style?: string
}

export function buildImageInput(
  schema: MediaModelInputSchema,
  ctx: ImageInputContext
): Record<string, any> {
  const input: Record<string, any> = {}

  // Prompt
  input[schema.promptField] = ctx.prompt

  // Dimensões
  if (schema.dimensionMode === 'aspect_ratio') {
    input.aspect_ratio = ctx.aspectRatio || '16:9'
  } else if (schema.dimensionMode === 'width_height') {
    if (ctx.aspectRatio && ctx.aspectRatio !== 'custom') {
      input.aspect_ratio = ctx.aspectRatio
    } else {
      input.width = ctx.width
      input.height = ctx.height
    }
  }

  // Param mapping (negativePrompt → negative_prompt, seed → seed, etc.)
  if (schema.paramMapping) {
    for (const [requestKey, apiKey] of Object.entries(schema.paramMapping)) {
      const value = (ctx as any)[requestKey]
      if (value !== undefined && value !== null) {
        input[apiKey] = value
      }
    }
  }

  // Defaults (aplicados por baixo — não sobrescrevem o que já foi setado)
  if (schema.defaults) {
    for (const [key, value] of Object.entries(schema.defaults)) {
      if (input[key] === undefined) {
        input[key] = value
      }
    }
  }

  // Remover campos não suportados
  if (schema.unsupportedFields) {
    for (const field of schema.unsupportedFields) {
      delete input[field]
    }
  }

  return input
}

// =============================================================================
// MOTION — Monta payload para geradores de vídeo (image-to-video)
// =============================================================================

export interface MotionInputContext {
  imageBuffer?: Buffer
  endImageBuffer?: Buffer
  imagePath?: string
  prompt?: string
  duration?: number
  negativePrompt?: string
  aspectRatio?: string
  guidanceScale?: number
  numInferenceSteps?: number
}

export function buildMotionInput(
  schema: MediaModelInputSchema,
  ctx: MotionInputContext
): { input: Record<string, any>; calculatedDuration: number } {
  const input: Record<string, any> = {}

  // Prompt
  input[schema.promptField] = ctx.prompt || 'Natural, smooth camera movement. Cinematic lighting.'

  // Imagem
  if (schema.imageField && ctx.imageBuffer) {
    if (schema.imageInputMode === 'base64') {
      input[schema.imageField] = ctx.imageBuffer.toString('base64')
    } else {
      // buffer direto (Replicate aceita Buffer)
      input[schema.imageField] = ctx.imageBuffer
    }
  }

  // End Image (last frame para transição)
  if (ctx.endImageBuffer) {
    const endField = schema.endImageField || 'last_image'
    if (schema.imageInputMode === 'base64') {
      input[endField] = ctx.endImageBuffer.toString('base64')
    } else {
      input[endField] = ctx.endImageBuffer
    }
  }

  // Duração / frames
  let calculatedDuration = ctx.duration ?? 5
  if (schema.durationMode === 'num_frames' && schema.durationField && schema.fps) {
    const fps = schema.fps
    const minF = schema.minFrames ?? 81
    const maxF = schema.maxFrames ?? 121
    const frames = Math.min(maxF, Math.max(minF, Math.round(calculatedDuration * fps)))
    input[schema.durationField] = frames
    calculatedDuration = frames / fps
  } else if (schema.durationMode === 'seconds' && schema.durationField) {
    input[schema.durationField] = calculatedDuration
  }

  // Dimensões (RunPod usa width/height, Replicate usa resolution)
  if (schema.dimensionMode === 'width_height') {
    if (ctx.aspectRatio === '9:16') {
      input.width = 720
      input.height = 1280
    } else {
      input.width = input.width ?? 1280
      input.height = input.height ?? 720
    }
  }

  // Param mapping
  if (schema.paramMapping) {
    for (const [requestKey, apiKey] of Object.entries(schema.paramMapping)) {
      const value = (ctx as any)[requestKey]
      if (value !== undefined && value !== null) {
        input[apiKey] = value
      }
    }
  }

  // Defaults
  if (schema.defaults) {
    for (const [key, value] of Object.entries(schema.defaults)) {
      if (input[key] === undefined) {
        input[key] = value
      }
    }
  }

  return { input, calculatedDuration }
}

// =============================================================================
// MUSIC — Monta payload para geradores de música
// =============================================================================

export interface MusicInputContext {
  prompt: string
  duration: number
  seed?: number
  steps?: number
  cfgScale?: number
}

export function buildMusicInput(
  schema: MediaModelInputSchema,
  ctx: MusicInputContext
): Record<string, any> {
  const input: Record<string, any> = {}

  // Prompt
  input[schema.promptField] = ctx.prompt

  // Duração
  if (schema.durationField) {
    input[schema.durationField] = ctx.duration
  }

  // Param mapping (seed, steps, cfgScale → cfg_scale)
  if (schema.paramMapping) {
    for (const [requestKey, apiKey] of Object.entries(schema.paramMapping)) {
      const value = (ctx as any)[requestKey]
      if (value !== undefined && value !== null) {
        input[apiKey] = value
      }
    }
  }

  // Defaults
  if (schema.defaults) {
    for (const [key, value] of Object.entries(schema.defaults)) {
      if (input[key] === undefined) {
        input[key] = value
      }
    }
  }

  return input
}
