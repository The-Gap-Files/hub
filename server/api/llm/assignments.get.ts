/**
 * GET /api/llm/assignments — Retorna todos os assignments LLM atuais
 * Providers/modelos agora vêm do DB; tasks permanecem estáticas (são constantes de código)
 */
import {
  getAllAssignments,
  getDbProviders
} from '../../services/llm/llm-factory'
import { getLlmTasks } from '../../constants/llm-registry'

export default defineEventHandler(async () => {
  const dbProviders = await getDbProviders()
  const assignments = await getAllAssignments()

  // Mascarar API keys antes de enviar ao frontend
  const providers = dbProviders.map(p => ({
    ...p,
    apiKey: undefined, // Não enviar API key neste endpoint
    models: p.models?.filter((m: any) => m.isActive !== false) ?? []
  }))

  const availableProviders = dbProviders
    .filter(p => !!p.apiKey && p.isActive !== false)
    .map(p => p.id)

  return {
    assignments,
    providers,
    tasks: getLlmTasks(),
    availableProviders
  }
})
