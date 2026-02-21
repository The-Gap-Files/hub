/**
 * Constants Barrel — Re-exporta todas as constantes organizadas por domínio.
 *
 * Estrutura:
 *   content/         → O QUE é contado (gênero, ângulo, papel, objetivo)
 *   storytelling/    → COMO é contado (estilos de roteiro)
 *   cinematography/  → COMO se parece (estilos visuais, legendas)
 *   distribution/    → ONDE é publicado (formatos de vídeo)
 *   providers/       → QUEM executa (LLMs, media providers)
 *   pricing.ts       → QUANTO custa (transversal)
 */

// ── Content (O QUE é contado) ────────────────────────────────────
export * from './content/intelligence-classifications'
export * from './content/narrative-angles'
export * from './content/narrative-roles'
export * from './content/editorial-objectives'

// ── Storytelling (COMO é contado) ────────────────────────────────
export * from './storytelling/script-styles'

// ── Cinematography (COMO se parece) ──────────────────────────────
export * from './cinematography/visual-styles'
export * from './cinematography/caption-styles'

// ── Distribution (ONDE é publicado) ──────────────────────────────
export * from './distribution/video-formats'

// ── Providers (QUEM executa) ─────────────────────────────────────
export * from './providers/llm-registry'
export * from './providers/media-registry'

// ── Pricing (QUANTO custa) ───────────────────────────────────────
export * from './pricing'
