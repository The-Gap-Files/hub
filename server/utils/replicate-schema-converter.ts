/**
 * Converte o JSON Schema do Replicate para o formato MediaModelInputSchema interno.
 *
 * O Replicate retorna schemas no formato JSON Schema padrão (type, properties, required).
 * Este conversor extrai as informações necessárias para construir payloads via input-schema-builder.
 *
 * @see server/constants/media-registry.ts — MediaModelInputSchema
 * @see server/utils/input-schema-builder.ts
 */

import type { MediaModelInputSchema } from '../constants/media-registry'

interface ReplicateJsonSchemaProperty {
  type?: string
  title?: string
  description?: string
  default?: unknown
  enum?: string[] | number[]
  format?: string
  deprecated?: boolean
  minimum?: number
  maximum?: number
}

interface ReplicateJsonSchema {
  type?: string
  title?: string
  required?: string[]
  properties?: Record<string, ReplicateJsonSchemaProperty>
}

/** Mapeamento: API key (Replicate) → nosso context key (request) */
const PARAM_MAPPING_FROM_SCHEMA: Record<string, string> = {
  negative_prompt: 'negativePrompt',
  seed: 'seed',
  num_outputs: 'numVariants',
  steps: 'steps',
  cfg_scale: 'cfgScale',
}

/** Campos que tipicamente identificam o prompt principal */
const PROMPT_CANDIDATES = ['prompt', 'text', 'input', 'prompt_text']

/** Campos que indicam image-to-video (input de imagem) */
const IMAGE_FIELD_CANDIDATES = ['image', 'input_image', 'image_base64', 'init_image']

/**
 * Converte JSON Schema do Replicate para MediaModelInputSchema.
 * Retorna null se o schema não for válido ou não tiver as informações mínimas.
 */
export function convertReplicateJsonSchemaToMediaModelInputSchema(
  jsonSchema: unknown
): MediaModelInputSchema | null {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return null
  }

  const schema = jsonSchema as ReplicateJsonSchema
  const props = schema.properties
  if (!props || typeof props !== 'object') {
    return null
  }

  const propKeys = Object.keys(props)

  // 1. promptField — required[0] ou primeiro candidato encontrado em properties
  const promptField = resolvePromptField(schema, propKeys)
  if (!promptField) {
    return null
  }

  // 2. dimensionMode
  const dimensionMode = resolveDimensionMode(props)

  // 3. defaults — extrair default de cada property
  const defaults: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(props)) {
    if (prop?.default !== undefined && prop?.default !== null && !prop.deprecated) {
      defaults[key] = prop.default
    }
  }

  // 4. paramMapping — para ImageInputContext: nosso campo → campo da API
  const paramMapping: Record<string, string> = {}
  for (const [apiKey, contextKey] of Object.entries(PARAM_MAPPING_FROM_SCHEMA)) {
    if (apiKey in props && !(props[apiKey] as ReplicateJsonSchemaProperty)?.deprecated) {
      paramMapping[contextKey] = apiKey
    }
  }

  // 5. durationField / durationMode (motion, music)
  const { durationField, durationMode } = resolveDuration(props)

  // 6. imageField (motion: image-to-video)
  const imageField = resolveImageField(propKeys)
  const imageInputMode = imageField === 'image_base64' ? 'base64' : 'buffer'

  // 7. outputMode — não inferível do input schema, default seguro
  const outputMode: MediaModelInputSchema['outputMode'] = 'file_output'

  const result: MediaModelInputSchema = {
    promptField,
    defaults: Object.keys(defaults).length > 0 ? defaults : undefined,
    outputMode,
  }

  if (dimensionMode) result.dimensionMode = dimensionMode
  if (Object.keys(paramMapping).length > 0) result.paramMapping = paramMapping
  if (durationField) result.durationField = durationField
  if (durationMode) result.durationMode = durationMode
  if (imageField) {
    result.imageField = imageField
    result.imageInputMode = imageInputMode
  }

  // fps, minFrames, maxFrames — apenas para motion com num_frames
  if (durationMode === 'num_frames') {
    result.fps = 16
    result.minFrames = 81
    result.maxFrames = 121
  }

  return result
}

function resolvePromptField(schema: ReplicateJsonSchema, propKeys: string[]): string | null {
  // Prioridade 1: required[0] se for candidato de prompt
  const required = schema.required
  if (Array.isArray(required) && required.length > 0) {
    const first = required[0]
    if (typeof first === 'string' && PROMPT_CANDIDATES.includes(first)) {
      return first
    }
  }

  // Prioridade 2: primeiro candidato em properties
  for (const candidate of PROMPT_CANDIDATES) {
    if (propKeys.includes(candidate)) {
      const prop = schema.properties?.[candidate]
      if (prop?.type === 'string') return candidate
    }
  }

  // Prioridade 3: primeiro required
  if (Array.isArray(required) && required[0]) {
    return required[0] as string
  }

  return null
}

function resolveDimensionMode(
  props: Record<string, ReplicateJsonSchemaProperty>
): MediaModelInputSchema['dimensionMode'] {
  if ('aspect_ratio' in props && Array.isArray(props.aspect_ratio?.enum)) {
    return 'aspect_ratio'
  }
  if ('width' in props && 'height' in props) {
    return 'width_height'
  }
  if ('resolution' in props) {
    return 'resolution'
  }
  return 'none'
}

function resolveDuration(
  props: Record<string, ReplicateJsonSchemaProperty>
): { durationField?: string; durationMode?: MediaModelInputSchema['durationMode'] } {
  if ('num_frames' in props) {
    return { durationField: 'num_frames', durationMode: 'num_frames' }
  }
  if ('duration' in props) {
    return { durationField: 'duration', durationMode: 'seconds' }
  }
  return {}
}

function resolveImageField(propKeys: string[]): string | null {
  for (const candidate of IMAGE_FIELD_CANDIDATES) {
    if (propKeys.includes(candidate)) return candidate
  }
  return null
}

/**
 * Verifica se o JSON parece ser um schema do Replicate (JSON Schema com properties).
 */
export function looksLikeReplicateJsonSchema(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return (
    (o.type === 'object' || !o.type) &&
    typeof o.properties === 'object' &&
    o.properties !== null
  )
}
