/**
 * Mapa de preços por modelo/provider de IA
 * 
 * Atualizado em: 2026-02-07
 * Fontes:
 *   - Replicate: https://replicate.com/pricing
 *   - ElevenLabs: https://elevenlabs.io/pricing/api
 *   - OpenAI: https://openai.com/pricing
 */

// =============================================================================
// REPLICATE - Modelos com preço fixo por output
// =============================================================================

export interface OutputBasedPricing {
  type: 'output'
  unit: 'image' | 'video_second' | 'video' | 'music'
  costPerUnit: number
}

export interface TimeBasedPricing {
  type: 'time'
  hardware: string
  costPerSecond: number
}

export type ModelPricing = OutputBasedPricing | TimeBasedPricing

/**
 * Preços por modelo do Replicate
 * Modelos output-based têm preço fixo por unidade gerada.
 * Modelos time-based cobram por segundo de GPU.
 */
export const REPLICATE_MODEL_PRICING: Record<string, ModelPricing> = {
  // === Imagem (output-based) ===
  'black-forest-labs/flux-schnell': {
    type: 'output',
    unit: 'image',
    costPerUnit: 0.003
  },
  'black-forest-labs/flux-dev': {
    type: 'output',
    unit: 'image',
    costPerUnit: 0.025
  },
  'black-forest-labs/flux-1.1-pro': {
    type: 'output',
    unit: 'image',
    costPerUnit: 0.04
  },
  'luma/photon-flash': {
    type: 'output',
    unit: 'image',
    costPerUnit: 0.01
  },
  // Flux Thumbnails v2 (LoRA fine-tuned para YouTube thumbnails com texto)
  // ~$0.017/exec, H100, ~11s avg
  'justmalhar/flux-thumbnails-v2': {
    type: 'output',
    unit: 'image',
    costPerUnit: 0.017
  },

  // === Vídeo / Motion (output-based) ===
  // wan-video/wan-2.2-5b-fast: 480p=$0.0125 | 720p=$0.025 (usamos 480p)
  'wan-video/wan-2.2-5b-fast': {
    type: 'output',
    unit: 'video',
    costPerUnit: 0.0125
  },
  'wan-video/wan-2.2-i2v-fast': {
    type: 'output',
    unit: 'video',
    costPerUnit: 0.05
  },
  // Modelos alternativos de vídeo (output-based)
  'wavespeedai/wan-2.1-i2v-480p': {
    type: 'output',
    unit: 'video_second',
    costPerUnit: 0.09
  },
  'wavespeedai/wan-2.1-i2v-720p': {
    type: 'output',
    unit: 'video_second',
    costPerUnit: 0.25
  },

  // === Música (output-based) ===
  // stability-ai/stable-audio-2.5 cobra $0.20 por execução
  'stability-ai/stable-audio-2.5': {
    type: 'output',
    unit: 'music',
    costPerUnit: 0.20
  },

  // === TTS via Replicate (time-based) ===
  'elevenlabs/v2-multilingual': {
    type: 'time',
    hardware: 'gpu-l40s',
    costPerSecond: 0.000975
  }
}

// =============================================================================
// REPLICATE - Tabela de hardware (preço por segundo)
// =============================================================================

export const REPLICATE_HARDWARE_PRICING: Record<string, number> = {
  'cpu-small': 0.000025,
  'cpu': 0.000100,
  'gpu-t4': 0.000225,
  'gpu-l40s': 0.000975,
  'gpu-l40s-2x': 0.001950,
  'gpu-a100-large': 0.001400,
  'gpu-a100-large-2x': 0.002800,
  'gpu-h100': 0.001525,
  'gpu-h100-2x': 0.003050
}

// =============================================================================
// ELEVENLABS - Preço por caractere/crédito
// =============================================================================

export interface ElevenLabsPricing {
  creditsPerCharacter: number // 1 para modelos normais, 0.5 para Flash/Turbo
  costPerCredit: number       // Depende do plano
}

/**
 * Preços do ElevenLabs por modelo
 * eleven_multilingual_v2: 1 char = 1 crédito
 * Custo por crédito varia por plano. Usando Scale ($330/2M = $0.000165)
 */
export const ELEVENLABS_PRICING: Record<string, ElevenLabsPricing> = {
  'eleven_multilingual_v2': {
    creditsPerCharacter: 1,
    costPerCredit: 0.000165  // Plano Scale: $330 / 2.000.000 créditos
  },
  'eleven_flash_v2': {
    creditsPerCharacter: 0.5,
    costPerCredit: 0.000165
  }
}

/** Pricing default para ElevenLabs quando modelo não está mapeado */
export const ELEVENLABS_DEFAULT_PRICING: ElevenLabsPricing = {
  creditsPerCharacter: 1,
  costPerCredit: 0.000165
}

// =============================================================================
// LLM SCRIPT PROVIDERS - Preço por token (input/output)
// Suporta OpenAI e Anthropic (Claude)
// =============================================================================

export interface LLMPricing {
  costPerInputToken: number
  costPerOutputToken: number
}

/** @deprecated Use LLM_PRICING instead */
export type OpenAIPricing = LLMPricing

export const LLM_PRICING: Record<string, LLMPricing> = {
  // === OpenAI ===
  'gpt-4o': {
    costPerInputToken: 0.0000025,   // $2.50/1M input tokens
    costPerOutputToken: 0.00001     // $10.00/1M output tokens
  },
  'gpt-4o-mini': {
    costPerInputToken: 0.00000015,  // $0.15/1M input tokens
    costPerOutputToken: 0.0000006   // $0.60/1M output tokens
  },
  'gpt-4-turbo': {
    costPerInputToken: 0.00001,     // $10.00/1M input tokens
    costPerOutputToken: 0.00003     // $30.00/1M output tokens
  },
  'gpt-4-turbo-preview': {
    costPerInputToken: 0.00001,     // $10.00/1M input tokens
    costPerOutputToken: 0.00003     // $30.00/1M output tokens
  },

  // === Anthropic (Claude) ===
  'claude-opus-4-6': {
    costPerInputToken: 0.000005,    // $5.00/1M input tokens
    costPerOutputToken: 0.000025    // $25.00/1M output tokens
  },
  'claude-sonnet-4-20250514': {
    costPerInputToken: 0.000003,    // $3.00/1M input tokens
    costPerOutputToken: 0.000015    // $15.00/1M output tokens
  },
  'claude-3-5-haiku-20241022': {
    costPerInputToken: 0.0000008,   // $0.80/1M input tokens
    costPerOutputToken: 0.000004    // $4.00/1M output tokens
  },
  'claude-haiku-4-5': {
    costPerInputToken: 0.0000008,   // Haiku 4.5 - mesmo tier do 3.5 Haiku
    costPerOutputToken: 0.000004
  },

  // === Google (Gemini) ===
  'gemini-3-flash-preview': {
    costPerInputToken: 0.0000001,   // ~$0.10/1M input (preview pricing — atualizar quando GA)
    costPerOutputToken: 0.0000004   // ~$0.40/1M output
  },
  'gemini-1.5-flash': {
    costPerInputToken: 0.000000075, // $0.075/1M input tokens (<= 128k context)
    costPerOutputToken: 0.0000003   // $0.30/1M output tokens (<= 128k context)
  },
  'gemini-2.0-flash-exp': {
    costPerInputToken: 0.000000075, // Estimativa baseada no Flash 1.5 (Free tier available)
    costPerOutputToken: 0.0000003
  },
  'gemini-2.0-flash': {
    costPerInputToken: 0.0000001,   // ~$0.10/1M input (Estimativa conservadora)
    costPerOutputToken: 0.0000004
  }
}

/** @deprecated Use LLM_PRICING instead */
export const OPENAI_PRICING = LLM_PRICING

/** Pricing default quando modelo LLM não está mapeado (usa preço do Claude Opus 4.6) */
export const LLM_DEFAULT_PRICING: LLMPricing = {
  costPerInputToken: 0.000005,
  costPerOutputToken: 0.000025
}

/** @deprecated Use LLM_DEFAULT_PRICING instead */
export const OPENAI_DEFAULT_PRICING = LLM_DEFAULT_PRICING

// =============================================================================
// VALIDAÇÃO OBRIGATÓRIA - Bloqueia execução se modelo não está mapeado
// =============================================================================

export class PricingNotConfiguredError extends Error {
  public code = 'PRICING_NOT_CONFIGURED'
  public model: string
  public provider: string
  public configUrl: string

  constructor(model: string, provider: string) {
    const configUrl = provider === 'REPLICATE'
      ? `https://replicate.com/${model}`
      : provider === 'ELEVENLABS'
        ? 'https://elevenlabs.io/pricing/api'
        : provider === 'ANTHROPIC'
          ? 'https://www.anthropic.com/pricing#api'
          : 'https://openai.com/pricing'

    super(
      `Modelo "${model}" (${provider}) não tem preço configurado no sistema. ` +
      `Acesse ${configUrl} para verificar o tipo de cobrança e atualize o mapa de preços em server/constants/pricing.ts antes de continuar.`
    )

    this.model = model
    this.provider = provider
    this.configUrl = configUrl
  }
}

/**
 * Valida se um modelo Replicate tem preço configurado.
 * DEVE ser chamado ANTES de executar qualquer geração.
 * Lança PricingNotConfiguredError se o modelo não está no mapa.
 */
export function validateReplicatePricing(model: string): ModelPricing {
  const pricing = REPLICATE_MODEL_PRICING[model]
  if (!pricing) {
    throw new PricingNotConfiguredError(model, 'REPLICATE')
  }
  return pricing
}

/** Providers que calculam custo internamente (não precisam de mapa de preços) */
const SELF_PRICING_PROVIDERS = new Set(['GEMINI', 'gemini'])

/**
 * Valida pricing de um media provider.
 * Replicate: exige modelo no mapa REPLICATE_MODEL_PRICING.
 * Gemini/outros com custo interno: sempre passa (custo é calculado no provider).
 * Lança PricingNotConfiguredError apenas se Replicate e modelo não mapeado.
 */
export function validateMediaPricing(model: string, providerName: string): void {
  if (SELF_PRICING_PROVIDERS.has(providerName)) return
  if (providerName.toLowerCase() === 'replicate') {
    validateReplicatePricing(model)
    return
  }
  // Providers desconhecidos: warn mas não bloqueia
  console.warn(`[Pricing] ⚠️ Provider "${providerName}" não tem validação de pricing. Modelo: ${model}`)
}

/**
 * Valida se um modelo ElevenLabs tem preço configurado.
 */
export function validateElevenLabsPricing(model: string): ElevenLabsPricing {
  const pricing = ELEVENLABS_PRICING[model]
  if (!pricing) {
    throw new PricingNotConfiguredError(model, 'ELEVENLABS')
  }
  return pricing
}

// =============================================================================
// HELPERS DE CÁLCULO (só chamam após validação)
// =============================================================================

/**
 * Calcula custo de uma geração no Replicate (output-based)
 * Retorna null se o modelo não é output-based (é time-based).
 */
export function calculateReplicateOutputCost(
  model: string,
  quantity: number
): number | null {
  const pricing = REPLICATE_MODEL_PRICING[model]
  if (!pricing || pricing.type !== 'output') return null
  return pricing.costPerUnit * quantity
}

/**
 * Calcula custo de uma geração no Replicate (time-based)
 * Lança erro se modelo não está mapeado.
 */
export function calculateReplicateTimeCost(
  model: string,
  predictTimeSeconds: number
): number {
  const pricing = REPLICATE_MODEL_PRICING[model]
  if (!pricing) {
    throw new PricingNotConfiguredError(model, 'REPLICATE')
  }
  if (pricing.type === 'time') {
    return pricing.costPerSecond * predictTimeSeconds
  }
  // Se é output-based, o custo não depende de tempo
  return 0
}

/**
 * Calcula custo de uma síntese TTS no ElevenLabs
 * Usa pricing default se modelo não está mapeado (ElevenLabs tem padrão fixo).
 */
export function calculateElevenLabsCost(
  model: string,
  characterCount: number
): number {
  const pricing = ELEVENLABS_PRICING[model] || ELEVENLABS_DEFAULT_PRICING
  const credits = characterCount * pricing.creditsPerCharacter
  return credits * pricing.costPerCredit
}

/**
 * Calcula custo REAL de uma geração de script via LLM usando tokens reais da API.
 * Preferido sobre estimateLLMCost quando tokens reais estão disponíveis.
 */
export function calculateLLMCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = LLM_PRICING[model] || LLM_DEFAULT_PRICING
  return (inputTokens * pricing.costPerInputToken) + (outputTokens * pricing.costPerOutputToken)
}

/**
 * Estima custo de uma geração de script via LLM (fallback)
 * Usa quando tokens reais não estão disponíveis.
 * ~4 caracteres = 1 token (média para inglês/português)
 */
export function estimateLLMCost(
  model: string,
  inputCharacters: number,
  outputCharacters: number
): number {
  const inputTokens = Math.ceil(inputCharacters / 4)
  const outputTokens = Math.ceil(outputCharacters / 4)
  return calculateLLMCost(model, inputTokens, outputTokens)
}

/** @deprecated Use estimateLLMCost instead */
export const estimateOpenAICost = estimateLLMCost
