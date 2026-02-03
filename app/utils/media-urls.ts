/**
 * Helper para gerar URLs de mídia do banco de dados
 */

export function getSceneImageUrl(sceneId: string): string {
  return `/api/scenes/${sceneId}/image`
}

export function getSceneVideoUrl(sceneId: string): string {
  return `/api/scenes/${sceneId}/video`
}

export function getVideoAudioUrl(videoId: string): string {
  return `/api/videos/${videoId}/audio`
}

export function getVideoDownloadUrl(videoId: string): string {
  return `/api/videos/${videoId}/download`
}
