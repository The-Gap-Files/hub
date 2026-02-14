/**
 * CostLog Service - Append-only ledger de custos de API
 * 
 * Registra o custo de cada chamada de API (imagem, motion, narração, música, script)
 * de forma desacoplada dos artefatos. Não importa se o artefato foi deletado
 * ou regenerado — o registro de custo permanece.
 */

import { prisma } from '../utils/prisma'
import type { Prisma } from '@prisma/client'
import {
  calculateReplicateOutputCost,
  calculateReplicateTimeCost,
  calculateElevenLabsCost,
  calculateLLMCost,
  estimateLLMCost,
  REPLICATE_MODEL_PRICING
} from '../constants/pricing'

// =============================================================================
// TIPOS
// =============================================================================

export type CostResource = 'outline' | 'script' | 'image' | 'narration' | 'bgm' | 'sfx' | 'motion' | 'insights' | 'thumbnail'
export type CostAction = 'create' | 'recreate'

export interface CostLogEntry {
  outputId?: string
  dossierId?: string
  resource: CostResource
  action: CostAction
  provider: string
  model?: string
  cost: number
  metadata?: Record<string, unknown>
  detail?: string
}

// =============================================================================
// SERVICE
// =============================================================================

class CostLogService {

  /**
   * Registra um custo no ledger (fire-and-forget)
   * Nunca deve bloquear ou quebrar o fluxo principal.
   */
  async log(entry: CostLogEntry): Promise<void> {
    try {
      await prisma.costLog.create({
        data: {
          outputId: entry.outputId ?? undefined,
          dossierId: entry.dossierId ?? undefined,
          resource: entry.resource,
          action: entry.action,
          provider: entry.provider,
          model: entry.model || null,
          cost: entry.cost,
          metadata: (entry.metadata as Prisma.InputJsonValue) ?? undefined,
          detail: entry.detail || null
        }
      })
      console.log(`[CostLog] ✅ ${entry.resource}/${entry.action} → $${entry.cost.toFixed(6)} (${entry.provider})`)
    } catch (error) {
      // Nunca quebrar o pipeline por causa de log de custo
      console.error('[CostLog] ❌ Falha ao registrar custo:', error)
    }
  }

  // ===========================================================================
  // HELPERS POR PROVIDER
  // ===========================================================================

  /**
   * Registra custo de geração de imagem no Replicate (output-based)
   */
  async logReplicateImage(params: {
    outputId: string
    model: string
    numImages: number
    action?: CostAction
    detail?: string
  }): Promise<void> {
    const cost = calculateReplicateOutputCost(params.model, params.numImages)
    if (cost === null) return

    await this.log({
      outputId: params.outputId,
      resource: 'image',
      action: params.action || 'create',
      provider: 'REPLICATE',
      model: params.model,
      cost,
      metadata: {
        num_images: params.numImages,
        cost_per_image: cost / params.numImages
      },
      detail: params.detail
    })
  }

  /**
   * Registra custo de geração de motion no Replicate.
   * Detecta automaticamente se o modelo é output-based ou time-based.
   */
  async logReplicateMotion(params: {
    outputId: string
    model: string
    predictTime?: number    // predict_time da API (para modelos time-based)
    numVideos?: number      // quantidade de vídeos (para modelos output-based)
    action?: CostAction
    detail?: string
  }): Promise<void> {
    const pricing = REPLICATE_MODEL_PRICING[params.model]
    let cost = 0
    let metadata: Record<string, unknown> = {}

    if (pricing?.type === 'output') {
      // Output-based: preço fixo por vídeo
      const qty = params.numVideos || 1
      cost = pricing.costPerUnit * qty
      metadata = { num_videos: qty, cost_per_video: pricing.costPerUnit, pricing_type: 'output' }
    } else if (pricing?.type === 'time' && params.predictTime) {
      // Time-based: preço por segundo de GPU
      cost = pricing.costPerSecond * params.predictTime
      metadata = { predict_time: params.predictTime, cost_per_second: pricing.costPerSecond, pricing_type: 'time', hardware: pricing.hardware }
    }

    await this.log({
      outputId: params.outputId,
      resource: 'motion',
      action: params.action || 'create',
      provider: 'REPLICATE',
      model: params.model,
      cost,
      metadata,
      detail: params.detail
    })
  }

  /**
   * Registra custo de geração de música no Replicate.
   * Detecta automaticamente se o modelo é output-based ou time-based.
   */
  async logReplicateMusic(params: {
    outputId: string
    model: string
    predictTime?: number    // predict_time da API (para modelos time-based)
    audioDuration: number
    action?: CostAction
    detail?: string
  }): Promise<void> {
    const pricing = REPLICATE_MODEL_PRICING[params.model]
    let cost = 0
    let metadata: Record<string, unknown> = { audio_duration: params.audioDuration }

    if (pricing?.type === 'output') {
      cost = pricing.costPerUnit
      metadata = { ...metadata, cost_per_unit: pricing.costPerUnit, pricing_type: 'output' }
    } else if (pricing?.type === 'time' && params.predictTime) {
      cost = pricing.costPerSecond * params.predictTime
      metadata = { ...metadata, predict_time: params.predictTime, cost_per_second: pricing.costPerSecond, pricing_type: 'time', hardware: pricing.hardware }
    }

    await this.log({
      outputId: params.outputId,
      resource: 'bgm',
      action: params.action || 'create',
      provider: 'REPLICATE',
      model: params.model,
      cost,
      metadata,
      detail: params.detail
    })
  }

  /**
   * Registra custo de narração no ElevenLabs
   */
  async logElevenLabsTTS(params: {
    outputId: string
    model?: string
    characterCount: number
    action?: CostAction
    detail?: string
  }): Promise<void> {
    const model = params.model || 'eleven_multilingual_v2'
    const cost = calculateElevenLabsCost(model, params.characterCount)

    await this.log({
      outputId: params.outputId,
      resource: 'narration',
      action: params.action || 'create',
      provider: 'ELEVENLABS',
      model,
      cost,
      metadata: {
        characters: params.characterCount,
        model
      },
      detail: params.detail
    })
  }

  /**
   * Registra custo de TTS via Replicate (time-based)
   */
  async logReplicateTTS(params: {
    outputId: string
    model: string
    elapsedSeconds: number
    characterCount: number
    action?: CostAction
    detail?: string
  }): Promise<void> {
    const cost = calculateReplicateTimeCost(params.model, params.elapsedSeconds)

    await this.log({
      outputId: params.outputId,
      resource: 'narration',
      action: params.action || 'create',
      provider: 'REPLICATE',
      model: params.model,
      cost,
      metadata: {
        elapsed_seconds: params.elapsedSeconds,
        characters: params.characterCount
      },
      detail: params.detail
    })
  }

  /**
   * Registra custo de geração de plano narrativo (outline) via LLM (Story Architect).
   * Usa tokens reais da API quando disponíveis, senão estima (~4 chars = 1 token).
   */
  async logOutlineGeneration(params: {
    outputId: string
    provider: string
    model: string
    inputCharacters: number
    outputCharacters: number
    usage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
    action?: CostAction
    detail?: string
  }): Promise<void> {
    let cost: number
    let inputTokens: number
    let outputTokens: number
    let isRealUsage: boolean

    if (params.usage && params.usage.inputTokens > 0) {
      cost = calculateLLMCost(params.model, params.usage.inputTokens, params.usage.outputTokens)
      inputTokens = params.usage.inputTokens
      outputTokens = params.usage.outputTokens
      isRealUsage = true
    } else {
      cost = estimateLLMCost(params.model, params.inputCharacters, params.outputCharacters)
      inputTokens = Math.ceil(params.inputCharacters / 4)
      outputTokens = Math.ceil(params.outputCharacters / 4)
      isRealUsage = false
    }

    await this.log({
      outputId: params.outputId,
      resource: 'outline',
      action: params.action || 'create',
      provider: params.provider,
      model: params.model,
      cost,
      metadata: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        real_usage: isRealUsage,
        input_characters: params.inputCharacters,
        output_characters: params.outputCharacters
      },
      detail: params.detail
    })
  }

  /**
   * Registra custo da análise neural (insights/curiosidades) no nível do dossier.
   * Usa tokens reais da API quando disponíveis.
   */
  async logInsightsGeneration(params: {
    dossierId: string
    provider: string
    model: string
    inputCharacters?: number
    outputCharacters?: number
    usage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
    action?: CostAction
    detail?: string
  }): Promise<void> {
    let cost: number
    let inputTokens: number
    let outputTokens: number
    let isRealUsage: boolean

    if (params.usage && params.usage.inputTokens > 0) {
      cost = calculateLLMCost(params.model, params.usage.inputTokens, params.usage.outputTokens)
      inputTokens = params.usage.inputTokens
      outputTokens = params.usage.outputTokens
      isRealUsage = true
    } else if (params.inputCharacters != null && params.outputCharacters != null) {
      cost = estimateLLMCost(params.model, params.inputCharacters, params.outputCharacters)
      inputTokens = Math.ceil(params.inputCharacters / 4)
      outputTokens = Math.ceil(params.outputCharacters / 4)
      isRealUsage = false
    } else {
      return
    }

    await this.log({
      dossierId: params.dossierId,
      resource: 'insights',
      action: params.action || 'create',
      provider: params.provider,
      model: params.model,
      cost,
      metadata: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        real_usage: isRealUsage
      },
      detail: params.detail
    })
  }

  /**
   * Registra custo de geração de script via LLM (OpenAI ou Anthropic)
   * Usa tokens reais da API quando disponíveis, senão estima (~4 chars = 1 token)
   */
  async logScriptGeneration(params: {
    outputId: string
    provider: string
    model: string
    inputCharacters: number
    outputCharacters: number
    // Token usage real retornado pela API (preferido para cálculo de custo)
    usage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
    action?: CostAction
    detail?: string
  }): Promise<void> {
    let cost: number
    let inputTokens: number
    let outputTokens: number
    let isRealUsage: boolean

    if (params.usage && params.usage.inputTokens > 0) {
      // Custo REAL baseado em tokens retornados pela API
      cost = calculateLLMCost(params.model, params.usage.inputTokens, params.usage.outputTokens)
      inputTokens = params.usage.inputTokens
      outputTokens = params.usage.outputTokens
      isRealUsage = true
    } else {
      // Fallback: estimar tokens (~4 chars = 1 token)
      cost = estimateLLMCost(params.model, params.inputCharacters, params.outputCharacters)
      inputTokens = Math.ceil(params.inputCharacters / 4)
      outputTokens = Math.ceil(params.outputCharacters / 4)
      isRealUsage = false
    }

    await this.log({
      outputId: params.outputId,
      resource: 'script',
      action: params.action || 'create',
      provider: params.provider,
      model: params.model,
      cost,
      metadata: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        real_usage: isRealUsage,
        input_characters: params.inputCharacters,
        output_characters: params.outputCharacters
      },
      detail: params.detail
    })
  }

  /**
   * Registra custo do merge de prompts (etapa de imagens) via LLM.
   * Lançado como resource 'image' para que o custo do merge some ao custo da geração de imagens.
   */
  async logImagePromptMerge(params: {
    outputId: string
    provider: string
    model: string
    inputCharacters: number
    outputCharacters: number
    usage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
    action?: CostAction
    detail?: string
  }): Promise<void> {
    let cost: number
    let inputTokens: number
    let outputTokens: number
    let isRealUsage: boolean

    if (params.usage && params.usage.inputTokens > 0) {
      cost = calculateLLMCost(params.model, params.usage.inputTokens, params.usage.outputTokens)
      inputTokens = params.usage.inputTokens
      outputTokens = params.usage.outputTokens
      isRealUsage = true
    } else {
      cost = estimateLLMCost(params.model, params.inputCharacters, params.outputCharacters)
      inputTokens = Math.ceil(params.inputCharacters / 4)
      outputTokens = Math.ceil(params.outputCharacters / 4)
      isRealUsage = false
    }

    await this.log({
      outputId: params.outputId,
      resource: 'image',
      action: params.action || 'create',
      provider: params.provider,
      model: params.model,
      cost,
      metadata: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        real_usage: isRealUsage,
        input_characters: params.inputCharacters,
        output_characters: params.outputCharacters,
        step: 'prompt_merge'
      },
      detail: params.detail
    })
  }

  /**
   * Registra custo de geração de thumbnails.
   * Inclui custo das imagens (Replicate) e opcionalmente da LLM (geração de prompts).
   */
  async logThumbnailGeneration(params: {
    outputId: string
    imageModel: string
    numImages: number
    llmModel?: string
    llmProvider?: string
    llmUsage?: {
      inputTokens: number
      outputTokens: number
    }
    action?: CostAction
  }): Promise<void> {
    // 1. Custo das imagens geradas
    const imageCost = calculateReplicateOutputCost(params.imageModel, params.numImages)
    if (imageCost !== null) {
      await this.log({
        outputId: params.outputId,
        resource: 'thumbnail',
        action: params.action || 'create',
        provider: 'REPLICATE',
        model: params.imageModel,
        cost: imageCost,
        metadata: {
          num_images: params.numImages,
          cost_per_image: imageCost / params.numImages,
          step: 'image_generation'
        },
        detail: `${params.numImages} thumbnails via ${params.imageModel}`
      })
    }

    // 2. Custo da LLM que gerou os prompts (se disponível)
    if (params.llmModel && params.llmUsage) {
      const llmCost = calculateLLMCost(
        params.llmModel,
        params.llmUsage.inputTokens,
        params.llmUsage.outputTokens
      )
      await this.log({
        outputId: params.outputId,
        resource: 'thumbnail',
        action: params.action || 'create',
        provider: params.llmProvider || 'ANTHROPIC',
        model: params.llmModel,
        cost: llmCost,
        metadata: {
          input_tokens: params.llmUsage.inputTokens,
          output_tokens: params.llmUsage.outputTokens,
          total_tokens: params.llmUsage.inputTokens + params.llmUsage.outputTokens,
          real_usage: true,
          step: 'prompt_generation'
        },
        detail: `Prompt generation via ${params.llmModel}`
      })
    }
  }

  /**
   * @deprecated Use logScriptGeneration instead
   */
  async logOpenAIScript(params: {
    outputId: string
    model: string
    inputCharacters: number
    outputCharacters: number
    action?: CostAction
    detail?: string
  }): Promise<void> {
    return this.logScriptGeneration({
      ...params,
      provider: 'OPENAI'
    })
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * Custo total de um output (todas as resources, incluindo regenerações)
   */
  async getOutputCost(outputId: string) {
    const logs = await prisma.costLog.findMany({
      where: { outputId },
      orderBy: { createdAt: 'asc' }
    })

    const total = logs.reduce((sum, log) => sum + log.cost, 0)

    const breakdown = logs.reduce((acc, log) => {
      acc[log.resource] = (acc[log.resource] || 0) + log.cost
      return acc
    }, {} as Record<string, number>)

    const byAction = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + log.cost
      return acc
    }, {} as Record<string, number>)

    // Determinar se o custo de cada recurso é real (API) ou estimado (fallback)
    const costAccuracy = logs.reduce((acc, log) => {
      const meta = log.metadata as any
      if (meta?.real_usage !== undefined) {
        // Só marca como estimado se ALGUM log do recurso for estimado
        if (!acc[log.resource]) {
          acc[log.resource] = meta.real_usage ? 'real' : 'estimated'
        } else if (!meta.real_usage) {
          acc[log.resource] = 'estimated'
        }
      }
      return acc
    }, {} as Record<string, 'real' | 'estimated'>)

    return {
      outputId,
      total,
      breakdown,
      byAction,
      costAccuracy,
      logCount: logs.length,
      logs
    }
  }

  /**
   * Custo total de um dossier (outputs + custos no nível do dossier, ex: análise neural)
   */
  async getDossierCost(dossierId: string) {
    const [outputs, dossierLogs] = await Promise.all([
      prisma.output.findMany({
        where: { dossierId },
        select: {
          id: true,
          title: true,
          status: true,
          costLogs: {
            orderBy: { createdAt: 'asc' }
          }
        }
      }),
      prisma.costLog.findMany({
        where: { dossierId },
        orderBy: { createdAt: 'asc' }
      })
    ])

    const dossierLevelTotal = dossierLogs.reduce((sum, log) => sum + log.cost, 0)

    let grandTotal = dossierLevelTotal
    const outputCosts = outputs.map(output => {
      const total = output.costLogs.reduce((sum, log) => sum + log.cost, 0)
      grandTotal += total
      return {
        outputId: output.id,
        title: output.title,
        status: output.status,
        total,
        logCount: output.costLogs.length
      }
    })

    return {
      dossierId,
      grandTotal,
      dossierLevelCost: dossierLevelTotal,
      outputs: outputCosts
    }
  }
}

export const costLogService = new CostLogService()
