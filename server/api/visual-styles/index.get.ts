import { getVisualStylesList } from '../../constants/visual-styles'

/**
 * GET /api/visual-styles
 * Retorna todos os estilos visuais ativos (constantes, não mais do DB).
 */
export default defineEventHandler(() => {
  return {
    success: true,
    data: getVisualStylesList()
  }
})
