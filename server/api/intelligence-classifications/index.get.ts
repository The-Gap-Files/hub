import { getActiveClassifications } from '../../constants/intelligence-classifications'

/**
 * GET /api/intelligence-classifications
 * Retorna classificações ativas ordenadas (para seleção no output).
 */
export default defineEventHandler(() => {
  return {
    data: getActiveClassifications()
  }
})
