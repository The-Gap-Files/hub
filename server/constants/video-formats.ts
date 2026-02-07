/**
 * Formatos de vídeo suportados pela plataforma
 * Cada formato define a plataforma-alvo, aspect ratio,
 * orientação e duração padrão
 */

export type VideoFormatId = 'teaser-tiktok' | 'full-youtube' | 'teaser-reels'

export interface VideoFormat {
  id: VideoFormatId
  name: string
  platform: string
  aspectRatio: string
  orientation: 'VERTICAL' | 'HORIZONTAL'
  defaultDuration: number       // em segundos
  maxDuration: number           // limite máximo em segundos
  description: string
  recommendedCaptionStyle: string  // id do caption style recomendado
  isActive: boolean
}

export const TIKTOK_TEASER: VideoFormat = {
  id: 'teaser-tiktok',
  name: 'TikTok Teaser',
  platform: 'TikTok',
  aspectRatio: '9:16',
  orientation: 'VERTICAL',
  defaultDuration: 60,
  maxDuration: 180,
  description: 'Vídeo curto e vertical otimizado para TikTok. Formato ideal para teasers virais e conteúdo de alto engajamento.',
  recommendedCaptionStyle: 'tiktok',
  isActive: true
}

export const YOUTUBE_CINEMATIC: VideoFormat = {
  id: 'full-youtube',
  name: 'YouTube Cinematic',
  platform: 'YouTube',
  aspectRatio: '16:9',
  orientation: 'HORIZONTAL',
  defaultDuration: 600,
  maxDuration: 3600,
  description: 'Vídeo longo e horizontal para YouTube. Formato cinematográfico para documentários, investigações aprofundadas e conteúdo narrativo completo.',
  recommendedCaptionStyle: 'youtube_long',
  isActive: true
}

export const INSTAGRAM_REELS: VideoFormat = {
  id: 'teaser-reels',
  name: 'Instagram Reels',
  platform: 'Instagram',
  aspectRatio: '9:16',
  orientation: 'VERTICAL',
  defaultDuration: 30,
  maxDuration: 90,
  description: 'Vídeo ultra-curto e vertical para Instagram Reels. Foco em impacto imediato e retenção nos primeiros segundos.',
  recommendedCaptionStyle: 'youtube_shorts',
  isActive: true
}

export const VIDEO_FORMATS: Record<VideoFormatId, VideoFormat> = {
  'teaser-tiktok': TIKTOK_TEASER,
  'full-youtube': YOUTUBE_CINEMATIC,
  'teaser-reels': INSTAGRAM_REELS
}

/**
 * Retorna todos os formatos ativos ordenados por duração padrão
 */
export function getActiveFormats(): VideoFormat[] {
  return Object.values(VIDEO_FORMATS)
    .filter(f => f.isActive)
    .sort((a, b) => a.defaultDuration - b.defaultDuration)
}

/**
 * Busca um formato pelo ID
 */
export function getVideoFormatById(id: string): VideoFormat | undefined {
  return VIDEO_FORMATS[id as VideoFormatId]
}
