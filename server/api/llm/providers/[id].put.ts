/**
 * PUT /api/llm/providers/:id — Atualiza um provider existente
 *
 * Body: { name?, description?, apiKey?, baseUrl?, iconKey?, isActive? }
 * - Se apiKey for string vazia, define como null (limpa)
 * - Se apiKey não for enviada, mantém o valor atual
 */
import { prisma } from '../../../utils/prisma'
import { invalidateMediaCache } from '../../../services/media/media-factory'

function maskApiKey(key: string | null): string | null {
  if (!key) return null
  if (key.length <= 8) return '****'
  return key.slice(0, 3) + '...' + key.slice(-4)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Provider ID é obrigatório'
    })
  }

  const body = await readBody(event)
  const { name, description, apiKey, baseUrl, iconKey, isActive } = body as {
    name?: string
    description?: string
    apiKey?: string
    baseUrl?: string
    iconKey?: string
    isActive?: boolean
  }

  // Verificar se o provider existe
  const existing = await prisma.llmProvider.findUnique({ where: { id } })
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: `Provider "${id}" não encontrado`
    })
  }

  // Montar objeto de update apenas com campos enviados
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (description !== undefined) data.description = description || null
  if (baseUrl !== undefined) data.baseUrl = baseUrl || null
  if (iconKey !== undefined) data.iconKey = iconKey
  if (isActive !== undefined) data.isActive = isActive

  // Lógica especial para apiKey
  if (apiKey !== undefined) {
    data.apiKey = apiKey === '' ? null : apiKey
  }

  const provider = await prisma.llmProvider.update({
    where: { id },
    data
  })

  invalidateMediaCache()
  console.log(`[LLM API] PUT /providers/${id} — Provider atualizado`)

  return {
    ...provider,
    apiKey: maskApiKey(provider.apiKey)
  }
})
