import { getScriptStylesList } from '../../constants/storytelling/script-styles'

/**
 * GET /api/script-styles
 * Retorna todos os estilos de roteiro ativos (constantes, não mais do DB).
 */
export default defineEventHandler(() => {
  return {
    success: true,
    data: getScriptStylesList()
  }
})
