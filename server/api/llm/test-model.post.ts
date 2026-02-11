/**
 * POST /api/llm/test-model
 *
 * Envia uma mensagem ao modelo configurado para uma task e retorna a resposta.
 * Body: { taskId: string, message: string }
 */
import { HumanMessage } from '@langchain/core/messages'
import { createLlmForTask } from '../../services/llm/llm-factory'
import { LLM_TASKS } from '../../constants/llm-registry'
import type { LlmTaskId } from '../../constants/llm-registry'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { taskId, message } = body as { taskId?: string; message?: string }

  if (!taskId || !message?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'taskId e message são obrigatórios'
    })
  }

  if (!LLM_TASKS[taskId as LlmTaskId]) {
    throw createError({
      statusCode: 400,
      message: `Task desconhecida: "${taskId}"`
    })
  }


  const TIMEOUT_MS = 60_000 // 60s
  const start = Date.now()
  try {
    const llm = await createLlmForTask(taskId as LlmTaskId)

    // Timeout via AbortController — funciona para qualquer provider
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await llm.invoke(
      [new HumanMessage(message.trim())],
      { signal: controller.signal }
    )
    clearTimeout(timer)

    const text = typeof response.content === 'string' ? response.content : String(response.content ?? '')
    const elapsed = `${((Date.now() - start) / 1000).toFixed(2)}s`

    return {
      success: true,
      response: text,
      elapsed
    }
  } catch (err: any) {
    const raw = err?.message || String(err)
    const elapsed = `${((Date.now() - start) / 1000).toFixed(2)}s`

    // Mensagens amigáveis para erros comuns
    let errorMessage = raw
    if (err?.name === 'AbortError' || raw.includes('aborted')) {
      errorMessage = `Timeout: o modelo não respondeu em ${TIMEOUT_MS / 1000}s. Verifique a API Key e tente novamente.`
    } else if (raw.includes('API key not valid') || raw.includes('API_KEY_INVALID') || raw.includes('401') || raw.includes('UNAUTHENTICATED')) {
      errorMessage = `API Key inválida para o provider configurado. Verifique em Settings → Providers. (Detalhe: ${raw})`
    } else if (raw.includes('timeout') || raw.includes('ETIMEDOUT') || raw.includes('ECONNABORTED')) {
      errorMessage = `Timeout na chamada ao modelo (limite: 60s). Verifique sua conexão ou tente novamente. (Detalhe: ${raw})`
    } else if (raw.includes('API Key não configurada')) {
      errorMessage = raw // Já é amigável, vem do getApiKey()
    }

    return {
      success: false,
      response: undefined,
      error: errorMessage,
      elapsed
    }
  }
})
