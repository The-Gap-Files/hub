type LegacyFullVideo = Record<string, any>

function buildEpisodeTitle(baseTitle: unknown, episodeNumber: number) {
  const t = typeof baseTitle === 'string' ? baseTitle.trim() : ''
  if (!t) return `EP${episodeNumber}`
  if (/\bEP\s*\d+\b/i.test(t)) return t
  return `${t} — EP${episodeNumber}`
}

export function migrateFullVideoToEpisodesV1(planData: any) {
  if (!planData || typeof planData !== 'object') return null
  if (!planData.fullVideo) return null
  if (Array.isArray(planData.fullVideos)) return null

  const legacy = planData.fullVideo as LegacyFullVideo
  const now = new Date().toISOString()

  const ep1 = {
    ...legacy,
    title: buildEpisodeTitle(legacy?.title, 1),
    episodeNumber: 1,
    angleCategory: 'episode-1',
    sceneCount: 150
  }
  const ep2 = {
    ...legacy,
    title: buildEpisodeTitle(legacy?.title, 2),
    episodeNumber: 2,
    angleCategory: 'episode-2',
    sceneCount: 150
  }
  const ep3 = {
    ...legacy,
    title: buildEpisodeTitle(legacy?.title, 3),
    episodeNumber: 3,
    angleCategory: 'episode-3',
    sceneCount: 150
  }

  const migrated = {
    ...planData,
    fullVideos: [ep1, ep2, ep3],
    needsReview: true,
    _migrations: {
      ...(planData._migrations || {}),
      fullVideoToEpisodesV1: {
        migratedAt: now,
        originalFullVideo: legacy
      }
    }
  }

  delete (migrated as any).fullVideo
  return migrated
}

