/**
 * Groq Error Handler — Tratamento centralizado de json_validate_failed
 * 
 * Quando o Groq jsonSchema strict rejeita JSON válido (campos nullable não preenchidos
 * ou modelo retorna schema ao invés de dados), extrai failed_generation e usa como fallback.
 */
import { logLlmError } from './llm-debug-logger'

export interface GroqFailedGenerationResult<T> {
  success: true
  data: T
  isPartial: boolean
}

export interface GroqErrorResult {
  success: false
  shouldRethrow: true
}

export type GroqErrorHandlerResult<T> = GroqFailedGenerationResult<T> | GroqErrorResult

/**
 * Trata erros json_validate_failed do Groq extraindo failed_generation.
 * 
 * @param error - O erro capturado do catch
 * @param logPrefix - Prefixo para logs (ex: '[StoryArchitect]')
 * @param taskId - ID da task (opcional, para logging em arquivo)
 * @param validateData - Função opcional para validar se failed_generation contém dados válidos
 * @returns Resultado com dados parciais ou indicação para re-throw
 */
export function handleGroqJsonValidateError<T>(
  error: any,
  logPrefix: string,
  taskIdOrValidator?: string | ((data: any) => boolean),
  validateData?: (data: any) => boolean
): GroqErrorHandlerResult<T> {
  // Suporte a assinatura antiga: (error, logPrefix, validateData?)
  let taskId = 'unknown'
  let validator = validateData
  if (typeof taskIdOrValidator === 'function') {
    validator = taskIdOrValidator
    taskId = logPrefix.replace(/[\[\]]/g, '').trim().toLowerCase().replace(/\s+/g, '-')
  } else if (typeof taskIdOrValidator === 'string') {
    taskId = taskIdOrValidator
  } else {
    taskId = logPrefix.replace(/[\[\]]/g, '').trim().toLowerCase().replace(/\s+/g, '-')
  }

  // Estrutura do erro Groq SDK:
  // APIError → this.error = errJSON (o body inteiro parseado)
  // Body da API: { "error": { "message": "...", "code": "...", "failed_generation": "..." } }
  // Portanto: error.error = { error: { ... } }  →  error.error.error = { code, failed_generation }
  const errorBody = error?.error?.error || error?.error || error?.response?.body?.error || {}
  const errorMessage = typeof error?.message === 'string' ? error.message : ''

  // Verificar se é json_validate_failed
  if (errorBody?.code !== 'json_validate_failed' && !errorMessage.includes('json_validate_failed')) {
    return { success: false, shouldRethrow: true }
  }

  // Extrair failed_generation de múltiplos caminhos possíveis
  const failedGen = errorBody?.failed_generation
    || error?.response?.body?.failed_generation
    || error?.failed_generation

  if (!failedGen) {
    console.warn(`${logPrefix} ⚠️ json_validate_failed mas sem failed_generation`)
    // Logar erro completo em arquivo para debug
    logLlmError(taskId, { provider: 'groq', model: 'unknown', error }).catch(() => { })
    return { success: false, shouldRethrow: true }
  }

  try {
    const partial = typeof failedGen === 'string' ? JSON.parse(failedGen) : failedGen

    // Verificar se é o schema JSON Schema ao invés de dados
    if (partial?.$schema || (partial?.properties && partial?.type === 'object')) {
      console.error(`${logPrefix} ❌ Modelo retornou JSON Schema ao invés de dados. Schema muito complexo para este modelo.`)
      logLlmError(taskId, {
        provider: 'groq', model: 'unknown', error,
        failedGeneration: partial
      }).catch(() => { })
      return { success: false, shouldRethrow: true }
    }

    // Validação customizada (se fornecida)
    if (validator && !validator(partial)) {
      console.warn(`${logPrefix} ⚠️ failed_generation não passou na validação customizada`)
      logLlmError(taskId, {
        provider: 'groq', model: 'unknown', error,
        failedGeneration: partial
      }).catch(() => { })
      return { success: false, shouldRethrow: true }
    }

    console.warn(`${logPrefix} ⚠️ Groq json_validate_failed — usando failed_generation como resposta parcial`)

    // Logar como partial em arquivo para inspeção
    logLlmError(taskId, {
      provider: 'groq', model: 'unknown', error,
      failedGeneration: partial
    }).catch(() => { })

    return {
      success: true,
      data: partial as T,
      isPartial: true
    }
  } catch (parseErr) {
    console.error(`${logPrefix} ❌ Falha ao parsear failed_generation:`, parseErr)
    logLlmError(taskId, { provider: 'groq', model: 'unknown', error }).catch(() => { })
    return { success: false, shouldRethrow: true }
  }
}
