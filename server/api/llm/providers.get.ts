/**
 * GET /api/llm/providers — Retorna todos os providers com seus models
 */
import { prisma } from '../../utils/prisma'

function maskApiKey(key: string | null): string | null {
  if (!key) return null
  if (key.length <= 8) return '****'
  return key.slice(0, 3) + '...' + key.slice(-4)
}

export default defineEventHandler(async () => {
  const providers = await prisma.llmProvider.findMany({
    include: {
      models: {
        where: { isActive: true },
        orderBy: { name: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  })

  // Mascarar apiKey antes de retornar
  const masked = providers.map(p => ({
    ...p,
    apiKey: maskApiKey(p.apiKey)
  }))

  console.log(`[LLM API] GET /providers — ${providers.length} providers retornados`)

  return masked
})
