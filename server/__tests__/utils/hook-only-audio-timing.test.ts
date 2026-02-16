import { describe, it, expect } from 'vitest'
import {
  resolveHookOnlyTotalDurationSeconds,
  computeHookOnlySceneBudgetsSeconds,
  computeSpeedForBudget,
  stripInlineAudioTags,
  stripSsmlBreakTags,
  appendPauseTagsForV3
} from '../../../server/utils/hook-only-audio-timing'

describe('hook-only-audio-timing', () => {
  it('resolveHookOnlyTotalDurationSeconds: fallback 20 fora de 16–22', () => {
    expect(resolveHookOnlyTotalDurationSeconds(undefined)).toBe(20)
    expect(resolveHookOnlyTotalDurationSeconds(null)).toBe(20)
    expect(resolveHookOnlyTotalDurationSeconds(10)).toBe(20)
    expect(resolveHookOnlyTotalDurationSeconds(30)).toBe(20)
  })

  it('resolveHookOnlyTotalDurationSeconds: respeita 16–22', () => {
    expect(resolveHookOnlyTotalDurationSeconds(16)).toBe(16)
    expect(resolveHookOnlyTotalDurationSeconds(20)).toBe(20)
    expect(resolveHookOnlyTotalDurationSeconds(22)).toBe(22)
  })

  it('computeHookOnlySceneBudgetsSeconds: soma ~total', () => {
    const b20 = computeHookOnlySceneBudgetsSeconds(20)
    expect(b20.reduce((a, b) => a + b, 0)).toBeCloseTo(20, 6)

    const b16 = computeHookOnlySceneBudgetsSeconds(16)
    expect(b16.reduce((a, b) => a + b, 0)).toBeCloseTo(16, 6)

    const b22 = computeHookOnlySceneBudgetsSeconds(22)
    expect(b22.reduce((a, b) => a + b, 0)).toBeCloseTo(22, 6)
  })

  it('stripSsmlBreakTags remove <break>, preserva audio tags v3', () => {
    expect(stripSsmlBreakTags('Oi <break time="1s"/> mundo')).toBe('Oi  mundo')
    expect(stripSsmlBreakTags('Oi [pause] mundo')).toBe('Oi [pause] mundo')
  })

  it('stripInlineAudioTags remove <break> e [tags]', () => {
    expect(stripInlineAudioTags('Oi <break time="1s"/> [pause] mundo')).toBe('Oi mundo')
  })

  it('computeSpeedForBudget calcula speed clamp 0.7–1.2', () => {
    expect(computeSpeedForBudget(12, 5)).toBeCloseTo(0.96, 2) // 12 / (5*2.5)
    expect(computeSpeedForBudget(100, 5)).toBe(1.2) // clamp
    expect(computeSpeedForBudget(1, 20)).toBe(0.7) // clamp
  })

  it('appendPauseTagsForV3 adiciona [pause] ao final', () => {
    expect(appendPauseTagsForV3('The Gap Files.', 0)).toBe('The Gap Files.')
    expect(appendPauseTagsForV3('The Gap Files.', 2)).toBe('The Gap Files. [pause] [pause]')
  })
})

