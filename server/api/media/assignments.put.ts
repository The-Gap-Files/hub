/**
 * PUT /api/media/assignments — Atualiza um media assignment
 *
 * Body: { taskId, provider, model, extraConfig? }
 */
import { setMediaAssignment, getMediaProviders } from '../../services/media/media-factory'
import { MEDIA_TASKS } from '../../constants/media-registry'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { taskId, provider, model, extraConfig } = body

  if (!taskId || !provider || !model) {
    throw createError({ statusCode: 400, message: 'taskId, provider and model are required' })
  }

  if (!MEDIA_TASKS[taskId as keyof typeof MEDIA_TASKS]) {
    throw createError({ statusCode: 400, message: `Task desconhecida: "${taskId}"` })
  }

  // Validar contra o banco (não contra o registry estático)
  const dbProviders = await getMediaProviders()
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

  const result = await setMediaAssignment(taskId, provider, model, extraConfig)
  return { success: true, assignment: result }
})
