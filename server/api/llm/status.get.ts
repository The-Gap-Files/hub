/**
 * GET /api/llm/status — Verifica quais providers têm API Key configurada
 * Agora lê do banco (LlmProvider) com fallback para process.env
 */
import { getDbProviders } from '../../services/llm/llm-factory'

export default defineEventHandler(async () => {
  const providers = await getDbProviders()

  const status = providers.map(p => ({
    id: p.id,
    name: p.name,
    available: !!p.apiKey, // apiKey vem do cache (já preenchida no seed com env var)
    iconKey: p.iconKey,
    modelCount: p.models?.length ?? 0
  }))

  const availableCount = status.filter(s => s.available).length

  return {
    providers: status,
    availableCount,
    totalCount: providers.length
  }
})
