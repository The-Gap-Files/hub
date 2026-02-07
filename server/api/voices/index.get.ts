
import { providerManager } from '../../services/providers'

export default defineEventHandler(async (event) => {
  try {
    const ttsProvider = providerManager.getTTSProvider()
    const query = getQuery(event)
    const options = {
      cursor: query.cursor ? String(query.cursor) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      search: query.search ? String(query.search) : undefined
    }

    const result = await ttsProvider.getAvailableVoices(options)

    // Cache de 1 hora
    // Cache removido explicitamente para refletir mudanças na biblioteca em tempo real (NO_CACHE)
    setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    setResponseHeader(event, 'Pragma', 'no-cache')
    setResponseHeader(event, 'Expires', '0')

    return result
  } catch (error: any) {
    console.error('[API] Error fetching voices:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch voices',
      message: error.message
    })
  }
})
