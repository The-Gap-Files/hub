/**
 * Utilitários de thumbnail: dimensões por plataforma.
 * 
 * Os prompts de imagem agora são gerados pela LLM em generate-thumbnails.post.ts
 * usando a skill thumbnail-creation.md + contexto narrativo do vídeo.
 */

export interface ThumbnailDimensions {
  width: number
  height: number
  aspectRatio: string
}

/** Mapeia aspect ratio para dimensões por plataforma (YouTube 16:9, Shorts/TikTok 9:16) */
export function getThumbnailDimensions(aspectRatio: string | null): ThumbnailDimensions {
  if (aspectRatio === '9:16') {
    return { width: 1080, height: 1920, aspectRatio: '9:16' }
  }
  // 16:9 ou padrão
  return { width: 1280, height: 720, aspectRatio: '16:9' }
}
