import { describe, it, expect } from 'vitest'
import { migrateFullVideoToEpisodesV1 } from '../../services/monetization-plan-migrations'

describe('migrateFullVideoToEpisodesV1', () => {
  it('migrates legacy planData.fullVideo into planData.fullVideos[3] and marks needsReview', () => {
    const legacy = {
      title: 'Caso X',
      hook: 'Hook',
      angle: 'Angle',
      structure: 'Structure',
      keyPoints: ['a', 'b', 'c'],
      emotionalArc: 'Arc',
      estimatedViews: 1,
      platform: 'YouTube',
      format: 'full-youtube',
      scriptStyleId: 'documentary',
      scriptStyleName: 'Documentary',
      editorialObjectiveId: 'hidden-truth',
      editorialObjectiveName: 'Hidden Truth',
      visualPrompt: 'Prompt',
      sceneCount: 150
    }

    const input = { fullVideo: legacy, teasers: [] }
    const out = migrateFullVideoToEpisodesV1(input)

    expect(out).toBeTruthy()
    expect(out.fullVideo).toBeUndefined()
    expect(out.needsReview).toBe(true)
    expect(Array.isArray(out.fullVideos)).toBe(true)
    expect(out.fullVideos).toHaveLength(3)
    expect(out.fullVideos[0].episodeNumber).toBe(1)
    expect(out.fullVideos[1].episodeNumber).toBe(2)
    expect(out.fullVideos[2].episodeNumber).toBe(3)
    expect(out.fullVideos[0].angleCategory).toBe('episode-1')
    expect(out.fullVideos[1].angleCategory).toBe('episode-2')
    expect(out.fullVideos[2].angleCategory).toBe('episode-3')
    expect(out._migrations?.fullVideoToEpisodesV1?.originalFullVideo?.title).toBe('Caso X')
  })

  it('is a no-op when fullVideos already exists', () => {
    const input = { fullVideos: [{}, {}, {}], teasers: [] }
    expect(migrateFullVideoToEpisodesV1(input)).toBeNull()
  })
})

