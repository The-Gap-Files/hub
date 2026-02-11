/**
 * GET /api/media/status — Status dos providers de mídia (API key configurada?)
 */
import { getMediaProviders } from '../../services/media/media-factory'

export default defineEventHandler(async () => {
  const providers = await getMediaProviders()

  const status = providers.map(p => ({
    id: p.id,
    name: p.name,
    available: !!p.apiKey,
    iconKey: p.iconKey,
    modelCount: p.models?.length ?? 0
  }))

  return {
    providers: status,
    availableCount: status.filter(s => s.available).length,
    totalCount: status.length
  }
})
