const BASE_WORDS_PER_SECOND_AT_SPEED_1 = 150 / 60 // 2.5

export function resolveHookOnlyTotalDurationSeconds(duration: number | null | undefined): number {
  const d = typeof duration === 'number' ? duration : undefined
  if (d !== undefined && Number.isFinite(d) && d >= 16 && d <= 22) return d
  return 20
}

/**
 * Budgets por cena (4 cenas) escalados a partir de um perfil base de 20s:
 * [4.5, 5.0, 5.0, 5.5] = 20s
 */
export function computeHookOnlySceneBudgetsSeconds(totalSeconds: number): [number, number, number, number] {
  const safeTotal = Number.isFinite(totalSeconds) ? Math.max(16, Math.min(22, totalSeconds)) : 20
  const scale = safeTotal / 20

  const b1 = 4.5 * scale
  const b2 = 5.0 * scale
  const b3 = 5.0 * scale
  const b4 = 5.5 * scale

  return [b1, b2, b3, b4]
}

export function stripSsmlBreakTags(text: string): string {
  return String(text || '').replace(/<break\b[^>]*\/?>/gi, '')
}

export function stripInlineAudioTags(text: string): string {
  // Remove qualquer token no formato [ ... ] (Eleven v3 audio tags), preservando o resto.
  return stripSsmlBreakTags(text)
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function countWords(text: string): number {
  const t = String(text || '').trim()
  if (!t) return 0
  return t.split(/\s+/).filter(Boolean).length
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Calcula `voice_settings.speed` para encaixar `wordCount` dentro de `budgetSeconds`,
 * assumindo baseline 150 WPM em speed=1.0 (2.5 palavras/s).
 *
 * Retorna clampado para o range oficial do ElevenLabs: 0.7 a 1.2.
 */
export function computeSpeedForBudget(wordCount: number, budgetSeconds: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 1.0
  const b = Number.isFinite(budgetSeconds) && budgetSeconds > 0 ? budgetSeconds : 5
  const speed = wordCount / (b * BASE_WORDS_PER_SECOND_AT_SPEED_1)
  return clamp(speed, 0.7, 1.2)
}

export function estimateSpeechSeconds(wordCount: number, speed: number): number {
  const s = Number.isFinite(speed) && speed > 0 ? speed : 1.0
  return wordCount / (BASE_WORDS_PER_SECOND_AT_SPEED_1 * s)
}

export function appendPauseTagsForV3(text: string, pauseCount: number): string {
  const base = String(text || '').trim()
  if (!base) return base
  const n = Math.max(0, Math.floor(pauseCount))
  if (n === 0) return base
  return `${base} ${Array.from({ length: n }).map(() => '[pause]').join(' ')}`.trim()
}

