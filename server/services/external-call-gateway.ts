/**
 * ExternalCallGateway — Camada obrigatória para TODA chamada a API externa.
 * 
 * REGRA: Nenhum provider externo (imagem, TTS, motion, música, LLM) pode ser
 * chamado diretamente. Toda chamada DEVE passar por este gateway, que:
 * 
 * 1. Recebe o contexto obrigatório (dossierId/outputId, resource, action)
 * 2. Executa a chamada ao provider
 * 3. Registra o custo AUTOMATICAMENTE no CostLog (banco)
 * 4. Retorna o resultado ao caller
 * 
 * Se a chamada externa falhar, o custo NÃO é registrado (só paga o que usou).
 * Se o log de custo falhar, o resultado é retornado normalmente (log nunca bloqueia).
 * 
 * @see server/types/ai-providers.ts — interfaces com custo obrigatório
 * @see server/services/cost-log.service.ts — persistência no banco
 */

import { costLogService, type CostResource, type CostAction } from './cost-log.service'

// =============================================================================
// CONTRATO — O que TODA chamada externa precisa informar
// =============================================================================

/**
 * Contexto obrigatório para rastrear qualquer chamada externa.
 * Sem isso, TypeScript não compila — impossível escapar.
 */
export interface ExternalCallContext {
  /** ID do dossiê relacionado (obrigatório para chamadas no nível do dossiê) */
  dossierId?: string
  /** ID do output relacionado (obrigatório para chamadas no nível do output) */
  outputId?: string
  /** Tipo do recurso sendo gerado */
  resource: CostResource
  /** Ação: criação inicial ou recriação */
  action: CostAction
  /** Descrição legível para o log */
  detail?: string
}

/**
 * O que TODA chamada externa DEVE retornar junto com seu resultado.
 * Se o provider não souber o custo, retorna cost = 0 (mas TEM que retornar).
 */
export interface ExternalCallCostInfo {
  /** Custo em USD da operação */
  cost: number
  /** Nome do provider (ex: "REPLICATE", "ELEVENLABS", "OPENAI") */
  provider: string
  /** Modelo usado (ex: "black-forest-labs/flux-schnell") */
  model: string
  /** Metadados de cálculo (tokens, predict_time, characters, etc.) */
  metadata?: Record<string, unknown>
}

/**
 * Resultado completo de uma chamada externa: dados + informações de custo.
 * Todo provider deve retornar isso via as interfaces atualizadas.
 */
export interface ExternalCallResult<T> {
  /** Os dados retornados pelo provider (imagem, áudio, vídeo, texto, etc.) */
  data: T
  /** Informações de custo (obrigatórias) */
  costInfo: ExternalCallCostInfo
}

// =============================================================================
// GATEWAY — Executa + loga automaticamente
// =============================================================================

/**
 * Executa uma chamada a provider externo e registra o custo automaticamente.
 * 
 * @param context - Contexto obrigatório (quem paga, qual recurso, qual ação)
 * @param callFn - Função que executa a chamada real ao provider
 * @returns Os dados do provider (sem o wrapper de custo — o custo já foi logado)
 * 
 * @example
 * ```typescript
 * const images = await executeExternalCall(
 *   { outputId: 'xxx', resource: 'image', action: 'create', detail: '5 cenas' },
 *   async () => {
 *     const result = await imageProvider.generate(request)
 *     return {
 *       data: result,
 *       costInfo: { cost: 0.05, provider: 'REPLICATE', model: 'flux-schnell' }
 *     }
 *   }
 * )
 * ```
 */
export async function executeExternalCall<T>(
  context: ExternalCallContext,
  callFn: () => Promise<ExternalCallResult<T>>
): Promise<T> {
  // Validação mínima: pelo menos dossierId OU outputId
  if (!context.dossierId && !context.outputId) {
    console.warn('[ExternalCallGateway] ⚠️ Chamada sem dossierId nem outputId — custo será órfão')
  }

  // 1. Executa a chamada ao provider (se falhar, custo NÃO é registrado)
  const result = await callFn()

  // 2. Registra custo automaticamente (fire-and-forget — nunca bloqueia)
  try {
    await costLogService.log({
      dossierId: context.dossierId,
      outputId: context.outputId,
      resource: context.resource,
      action: context.action,
      provider: result.costInfo.provider,
      model: result.costInfo.model,
      cost: result.costInfo.cost,
      metadata: result.costInfo.metadata,
      detail: context.detail
    })
  } catch (logError) {
    // Log de custo NUNCA deve quebrar o fluxo principal
    console.error('[ExternalCallGateway] ❌ Falha ao registrar custo (resultado retornado normalmente):', logError)
  }

  // 3. Retorna só os dados — o caller não precisa se preocupar com custo
  return result.data
}

/**
 * Variante para chamadas em batch (ex: gerar 50 imagens, 10 narrações).
 * Registra UM log de custo com o total agregado.
 * 
 * @param context - Contexto obrigatório
 * @param callFn - Função que executa o batch e retorna custo total
 */
export async function executeExternalBatch<T>(
  context: ExternalCallContext,
  callFn: () => Promise<ExternalCallResult<T>>
): Promise<T> {
  // Mesmo fluxo — a callFn é responsável por agregar o custo do batch
  return executeExternalCall(context, callFn)
}

// =============================================================================
// HELPERS — Facilitar a criação de ExternalCallResult nos providers
// =============================================================================

/**
 * Helper para montar ExternalCallResult de forma limpa dentro dos providers.
 */
export function withCost<T>(data: T, costInfo: ExternalCallCostInfo): ExternalCallResult<T> {
  return { data, costInfo }
}
