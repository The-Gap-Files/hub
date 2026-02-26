/**
 * Normalize SEO tags from LLM output into a clean string array.
 *
 * Handles multiple formats the LLM may return:
 * - Array of strings (ideal)
 * - Single string with commas
 * - Single string with newlines
 * - Single string with space-separated tokens (heuristic)
 */
export function normalizeSeoTags(seoTags: unknown): string[] {
  const rawItems = Array.isArray(seoTags) ? seoTags : (seoTags ? [seoTags] : [])
  const tags: string[] = []

  for (const item of rawItems) {
    if (typeof item !== 'string') continue
    const text = item.trim()
    if (!text) continue

    if (text.includes(',')) {
      tags.push(...text.split(','))
      continue
    }

    if (text.includes('\n')) {
      tags.push(...text.split(/\r?\n/))
      continue
    }

    // Heuristic: LLM sometimes returns ONE string with many space-separated tags.
    // Only split when it looks like a LIST (many tokens) to avoid breaking multi-word tags.
    const tokens = text.split(/\s+/).filter(Boolean)
    if (rawItems.length === 1 && tokens.length >= 5) {
      tags.push(...tokens)
      continue
    }

    tags.push(text)
  }

  return tags
    .map((t) => t.trim().replace(/^#+/, '').trim())
    .filter(Boolean)
}
