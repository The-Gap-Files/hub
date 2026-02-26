/**
 * Clean narration text for display — mirrors the backend pipeline
 * preprocessing before sending to ElevenLabs TTS.
 *
 * Removes SSML <break> tags (TTS uses inline v3 tags like [pause]).
 */
export function ttsTextForScene(narration: string | null | undefined): string {
  if (!narration) return ''
  return String(narration).replace(/<break\b[^>]*\/?>/gi, '').trim()
}
