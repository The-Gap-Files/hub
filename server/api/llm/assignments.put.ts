/**
 * PUT /api/llm/assignments — Atualiza o assignment de uma task
 * 
 * Body: { taskId, provider, model, temperature? }
 */
import { setAssignment, getDbProviders } from '../../services/llm/llm-factory'
import { type LlmTaskId, type LlmProviderId, LLM_TASKS } from '../../constants/llm-registry'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { taskId, provider, model, temperature } = body as {
    taskId: string
    provider: string
    model: string
    temperature?: number
  }

  // Validações
  if (!taskId || !provider || !model) {
    throw createError({ statusCode: 400, message: 'taskId, provider e model são obrigatórios' })
  }

  if (!LLM_TASKS[taskId as LlmTaskId]) {
    throw createError({ statusCode: 400, message: `Task desconhecida: "${taskId}"` })
  }

  // Validar contra o banco (não contra o registry estático)
  const dbProviders = await getDbProviders()
  const dbProvider = dbProviders.find((p: any) => p.id === provider)
  if (!dbProvider) {
    throw createError({ statusCode: 400, message: `Provider "${provider}" não encontrado` })
  }

  const dbModel = dbProvider.models?.find((m: any) => m.modelId === model)
  if (!dbModel) {
    throw createError({
      statusCode: 400,
      message: `Modelo "${model}" não encontrado no provider "${provider}"`
    })
  }

  if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
    throw createError({ statusCode: 400, message: 'Temperature deve estar entre 0 e 2' })
  }

  await setAssignment(
    taskId as LlmTaskId,
    provider as LlmProviderId,
    model,
    temperature
  )

  return { success: true, taskId, provider, model, temperature }
})
