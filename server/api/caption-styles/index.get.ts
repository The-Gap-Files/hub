import { CAPTION_STYLES, getStylesByPlatform } from '../../constants/caption-styles'

/**
 * GET /api/caption-styles
 * 
 * Lista todos os estilos de legendas disponíveis.
 * Query params opcionais:
 *   - platform: filtra por plataforma (tiktok, instagram, youtube)
 */
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const platform = query.platform as string | undefined

  const styles = platform
    ? getStylesByPlatform(platform)
    : Object.values(CAPTION_STYLES)

  return {
    total: styles.length,
    data: styles.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      platform: s.platform,
      effect: s.effect,
      recommendedFor: s.recommendedFor
    }))
  }
})
