/**
 * POST /api/llm/providers — Cria um novo provider
 *
 * Body: { id, name, description?, apiKey?, baseUrl?, iconKey? }
 */
import { prisma } from '../../utils/prisma'
import { invalidateMediaCache } from '../../services/media/media-factory'

function maskApiKey(key: string | null): string | null {
  if (!key) return null
  if (key.length <= 8) return '****'
  return key.slice(0, 3) + '...' + key.slice(-4)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { id, name, description, apiKey, baseUrl, iconKey } = body as {
    id: string
    name: string
    description?: string
    apiKey?: string
    baseUrl?: string
    iconKey?: string
  }

  // Validações
  if (!id || !name) {
    throw createError({
      statusCode: 400,
      message: 'id e name são obrigatórios'
    })
  }

  if (id.length > 30) {
    throw createError({
      statusCode: 400,
      message: 'id deve ter no máximo 30 caracteres'
    })
  }

  const provider = await prisma.llmProvider.create({
    data: {
      id,
      name,
      description: description || null,
      apiKey: apiKey || null,
      baseUrl: baseUrl || null,
      iconKey: iconKey || 'brain'
    }
  })

  invalidateMediaCache()
  console.log(`[LLM API] POST /providers — Provider "${provider.id}" criado`)

  return {
    ...provider,
    apiKey: maskApiKey(provider.apiKey)
  }
})
