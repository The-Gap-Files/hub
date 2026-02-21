import { prisma } from '../../../utils/prisma'
import { CAPTION_STYLES, getRecommendedStyle, getStylesByPlatform } from '../../../constants/cinematography/caption-styles'

/**
 * GET /api/outputs/[id]/caption-styles
 * 
 * Retorna os estilos de legendas disponíveis com recomendação baseada no
 * aspect ratio e plataforma do output.
 * 
 * Response:
 *   - aspectRatio: string
 *   - platform: string | null
 *   - recommendedStyleId: CaptionStyleId
 *   - styles: Array<{ id, name, description, platform, effect, isRecommended }>
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID é obrigatório'
    })
  }

  const output = await prisma.output.findUnique({
    where: { id },
    select: {
      aspectRatio: true,
      platform: true
    }
  })

  if (!output) {
    throw createError({
      statusCode: 404,
      message: 'Output não encontrado'
    })
  }

  // Determinar estilo recomendado
  const recommendedStyleId = getRecommendedStyle(
    output.aspectRatio || '16:9',
    output.platform || undefined
  )

  // Retornar todos os estilos com metadados
  const styles = Object.values(CAPTION_STYLES).map(style => ({
    id: style.id,
    name: style.name,
    description: style.description,
    platform: style.platform,
    effect: style.effect,
    recommendedFor: style.recommendedFor,
    isRecommended: style.id === recommendedStyleId
  }))

  return {
    aspectRatio: output.aspectRatio,
    platform: output.platform,
    recommendedStyleId,
    styles
  }
})
