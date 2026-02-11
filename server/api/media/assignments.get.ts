/**
 * GET /api/media/assignments — Retorna todos os media assignments + providers + tasks
 */
import { getAllMediaAssignments, getMediaProviders } from '../../services/media/media-factory'
import { getMediaTasks } from '../../constants/media-registry'

export default defineEventHandler(async () => {
  const assignments = await getAllMediaAssignments()
  const providers = await getMediaProviders()
  const tasks = getMediaTasks()

  // Mask API keys
  const safeProviders = providers.map(p => ({
    ...p,
    apiKey: p.apiKey ? (p.apiKey.slice(0, 3) + '...' + p.apiKey.slice(-4)) : null
  }))

  return { assignments, providers: safeProviders, tasks }
})
