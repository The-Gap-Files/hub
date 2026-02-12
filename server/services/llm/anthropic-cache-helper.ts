/**
 * Anthropic Cache Helper
 *
 * Constrói mensagens LangChain com cache_control para prompt caching da Anthropic.
 *
 * Estratégia de mensagens:
 *   SystemMessage: System prompt da tarefa (varia por etapa — NÃO cacheado)
 *   HumanMessage:  [content multi-part]
 *     → Part 0: Dossiê canônico (cache_control: ephemeral) ← CACHEADO
 *     → Part 1: Instruções específicas da tarefa             ← NÃO cacheado
 *     → Part N: Imagens multimodal (se houver)              ← NÃO cacheado
 *
 * O dossiê vai como primeiro content block do HumanMessage com cache_control,
 * permitindo que o system prompt mude livremente entre chamadas (monetization,
 * story-architect, script) sem invalidar o cache do dossiê.
 *
 * @see docs/roadmap/08-prompt-caching-pipeline.md
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import type { BaseMessage, MessageContentComplex } from '@langchain/core/messages'
import { estimateDossierTokens, MIN_CACHE_TOKENS } from '../../utils/dossier-prompt-block'

// =============================================================================
// TIPOS
// =============================================================================

export interface CacheablePromptConfig {
  /** Bloco canônico do dossiê (será cacheado) */
  dossierBlock: string
  /** System prompt da tarefa (skill + parâmetros técnicos) */
  systemPrompt: string
  /** Instruções específicas (monetizationContext, storyOutline, formato, etc.) */
  taskPrompt: string
  /** Imagens multimodal (não-cacheáveis) */
  images?: Array<{ data: any; mimeType: string; title?: string }>
  /** Provider atual (só aplica cache se for Anthropic) */
  providerName?: string
}

export interface CacheableResult {
  messages: BaseMessage[]
  cacheEnabled: boolean
  estimatedCacheTokens: number
}

// =============================================================================
// FEATURE FLAG
// =============================================================================

/**
 * Verifica se o prompt caching está habilitado.
 * Controlado pela env ENABLE_PROMPT_CACHING (default: true).
 */
export function isPromptCachingEnabled(): boolean {
  const flag = process.env.ENABLE_PROMPT_CACHING
  if (flag === undefined || flag === '') return true // Default: habilitado
  return flag.toLowerCase() === 'true' || flag === '1'
}

/**
 * Verifica se deve aplicar cache para um provider específico.
 * Só Anthropic suporta cache_control.
 */
export function shouldApplyCache(providerName?: string): boolean {
  if (!isPromptCachingEnabled()) return false
  if (!providerName) return false
  return providerName.toLowerCase().includes('anthropic') || providerName.toLowerCase().includes('claude')
}

// =============================================================================
// MESSAGE BUILDER
// =============================================================================

/**
 * Constrói mensagens com cache_control para Anthropic.
 *
 * Se caching NÃO está habilitado ou provider NÃO é Anthropic,
 * retorna mensagens normais (sem cache_control).
 */
export function buildCacheableMessages(config: CacheablePromptConfig): CacheableResult {
  const estimatedTokens = estimateDossierTokens(config.dossierBlock)
  const applyCache = shouldApplyCache(config.providerName) && estimatedTokens >= MIN_CACHE_TOKENS

  // System message (sempre igual, sem cache_control)
  const systemMessage = new SystemMessage(config.systemPrompt)

  if (applyCache) {
    // ── COM CACHE ────────────────────────────────────────────────────
    // HumanMessage com content multi-part (array de blocos)
    const contentParts: MessageContentComplex[] = [
      // Part 0: Dossiê canônico → CACHEADO
      {
        type: 'text' as const,
        text: `📦 DOSSIÊ DO CONTEÚDO (BASE DE CONHECIMENTO):\n\n${config.dossierBlock}`,
        // cache_control via additionalKwargs do LangChain → passado direto à API Anthropic
        cache_control: { type: 'ephemeral' }
      } as any,
      // Part 1: Instruções da tarefa → NÃO cacheado
      {
        type: 'text' as const,
        text: config.taskPrompt
      }
    ]

    // Parts adicionais: imagens multimodal
    if (config.images && config.images.length > 0) {
      for (const img of config.images) {
        if (!img.data) continue
        const base64 = Buffer.isBuffer(img.data)
          ? img.data.toString('base64')
          : Buffer.from(img.data).toString('base64')

        // Normalizar media_type para Anthropic (image/jpg → image/jpeg)
        let mediaType = img.mimeType || 'image/jpeg'
        if (mediaType === 'image/jpg') mediaType = 'image/jpeg'

        // Validar media_type aceito pelo Anthropic
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!validTypes.includes(mediaType)) {
          console.warn(`[PromptCache] ⚠️ Pulando imagem com media_type não suportado: ${mediaType} (Anthropic aceita: jpeg, png, gif, webp)`)
          continue // Pular esta imagem
        }

        // Formato nativo do Anthropic (não image_url)
        contentParts.push({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType,
            data: base64
          }
        } as any)
      }
    }

    const humanMessage = new HumanMessage({ content: contentParts as any })

    console.log(`[PromptCache] ✅ Cache HABILITADO — dossiê: ~${estimatedTokens} tokens (mín: ${MIN_CACHE_TOKENS})`)

    return {
      messages: [systemMessage, humanMessage],
      cacheEnabled: true,
      estimatedCacheTokens: estimatedTokens
    }
  } else {
    // ── SEM CACHE (provider não-Anthropic ou dossiê muito pequeno) ──
    const reason = !shouldApplyCache(config.providerName)
      ? `provider=${config.providerName || 'unknown'}`
      : `tokens=${estimatedTokens} < mín=${MIN_CACHE_TOKENS}`

    console.log(`[PromptCache] ⏭️ Cache DESABILITADO (${reason})`)

    // Mensagem simples: dossiê + instruções concatenados
    const fullPrompt = `${config.dossierBlock}\n\n${config.taskPrompt}`
    const humanMessage = new HumanMessage(fullPrompt)

    return {
      messages: [systemMessage, humanMessage],
      cacheEnabled: false,
      estimatedCacheTokens: 0
    }
  }
}

// =============================================================================
// LOGGING HELPER
// =============================================================================

/**
 * Extrai e loga métricas de cache da resposta do LLM Anthropic.
 * Chamado após cada invoke() para observabilidade.
 */
export function logCacheMetrics(
  stage: string,
  rawMessage: any
): { cacheCreationTokens: number; cacheReadTokens: number; inputTokens: number } {
  const usage = rawMessage?.usage_metadata
    || rawMessage?.response_metadata?.usage
    || rawMessage?.usage
    || {}

  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0
  const inputTokens = usage.input_tokens ?? 0

  if (cacheCreationTokens > 0 || cacheReadTokens > 0) {
    const hitRate = cacheReadTokens > 0
      ? ((cacheReadTokens / (cacheReadTokens + inputTokens)) * 100).toFixed(1)
      : '0.0'

    console.log(
      `[PromptCache] 📊 ${stage} — ` +
      `cache_write: ${cacheCreationTokens}, ` +
      `cache_read: ${cacheReadTokens}, ` +
      `input: ${inputTokens}, ` +
      `hit_rate: ${hitRate}%`
    )
  }

  return { cacheCreationTokens, cacheReadTokens, inputTokens }
}
