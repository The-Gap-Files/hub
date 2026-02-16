/**
 * LLM Invoke Wrapper — Wrapper centralizado para chamadas structuredLlm.invoke()
 * 
 * Intercepta tanto respostas bem-sucedidas quanto erros de qualquer chamada LLM,
 * logando tudo em arquivo (.llm-logs/) automaticamente.
 * 
 * Uso:
 *   const result = await invokeWithLogging(structuredLlm, messages, {
 *     taskId: 'story-architect',
 *     provider: assignment.provider,
 *     model: assignment.model
 *   })
 */
import { logLlmResponse, logLlmError } from './llm-debug-logger'
import { handleGroqJsonValidateError, type GroqErrorHandlerResult } from './groq-error-handler'

export interface InvokeLogContext {
  taskId: string
  provider: string
  model: string
}

/**
 * Invoca um LLM com structured output e loga o resultado em arquivo.
 * NÃO trata erros — apenas loga e re-lança.
 */
export async function invokeWithLogging(
  structuredLlm: any,
  messages: any[],
  ctx: InvokeLogContext
): Promise<{ parsed: any; raw: any }> {
  try {
    const result = await structuredLlm.invoke(messages)

    // Logar resposta bem-sucedida em arquivo
    logLlmResponse(ctx.taskId, {
      provider: ctx.provider,
      model: ctx.model,
      requestMessages: messages,
      parsed: result.parsed,
      raw: result.raw
    }).catch(() => { })

    return result
  } catch (error: any) {
    // Logar erro em arquivo
    logLlmError(ctx.taskId, {
      provider: ctx.provider,
      model: ctx.model,
      requestMessages: messages,
      error
    }).catch(() => { })

    throw error
  }
}
