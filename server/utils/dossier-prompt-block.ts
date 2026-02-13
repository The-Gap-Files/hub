/**
 * Dossier Prompt Block — Bloco Canônico para Prompt Caching
 *
 * Gera uma string determinística e estável contendo o conteúdo do dossiê.
 * Usado como bloco cacheable nas chamadas Anthropic (monetization, story-architect, script).
 *
 * REGRAS:
 * 1. Ordem fixa: THEME → SOURCES → NOTES → PERSONS → NEURAL_INSIGHTS
 * 2. Sources ordenadas por peso descendente (sort estável)
 * 3. Reutiliza formatPersonsForPrompt e formatNeuralInsightsForPrompt
 * 4. Mesma entrada → mesma saída byte a byte (determinístico)
 * 5. NÃO inclui campos que variam entre etapas (monetizationContext, storyOutline, etc.)
 *
 * ⚠️ ATENÇÃO: Alterações neste formato invalidam o cache entre chamadas.
 *    Mudanças devem ser conscientes e documentadas.
 *
 * @see docs/roadmap/08-prompt-caching-pipeline.md
 */

import type { PersonContext, NeuralInsightContext } from './format-intelligence-context'
import { formatPersonsForPrompt, formatNeuralInsightsForPrompt } from './format-intelligence-context'

// =============================================================================
// TIPOS
// =============================================================================

export interface DossierCacheInput {
  theme: string
  title?: string
  visualIdentityContext?: string
  sources?: Array<{ title: string; content: string; type: string; weight?: number }>
  userNotes?: string[]
  imageDescriptions?: string[]
  persons?: PersonContext[]
  neuralInsights?: NeuralInsightContext[]
}

// =============================================================================
// BUILDER
// =============================================================================

/**
 * Constrói o bloco canônico do dossiê para prompt caching.
 *
 * Retorna uma string determinística: mesma entrada → mesma saída byte a byte.
 * A ordem é fixa: THEME → SOURCES → NOTES → PERSONS → NEURAL_INSIGHTS
 */
export function buildDossierBlock(dossier: DossierCacheInput): string {
  const parts: string[] = []

  // ── THEME ──────────────────────────────────────────────────────────
  parts.push(`📋 TEMA: ${dossier.theme}`)
  if (dossier.title) {
    parts.push(`📋 TÍTULO: ${dossier.title}`)
  }

  // ── VISUAL IDENTITY CONTEXT (Warning Protocol) ─────────────────────
  if (dossier.visualIdentityContext) {
    parts.push(`🎨 DIRETRIZES DE IDENTIDADE DO UNIVERSO (WARNING PROTOCOL):\n${dossier.visualIdentityContext}`)
  }

  // ── SOURCES (ordenadas por peso descendente) ───────────────────────
  if (dossier.sources && dossier.sources.length > 0) {
    const sorted = [...dossier.sources].sort((a, b) => (b.weight ?? 1.0) - (a.weight ?? 1.0))
    let sourcesBlock = `📚 FONTES DO DOSSIÊ (ordenadas por peso/relevância):\n`
    sorted.forEach((source, i) => {
      const weightLabel = (source.weight ?? 1.0) !== 1.0 ? ` [peso: ${source.weight}]` : ''
      sourcesBlock += `[${i + 1}] (${source.type}) ${source.title}${weightLabel}\n${source.content}\n---\n`
    })
    parts.push(sourcesBlock)
  }

  // ── USER NOTES ─────────────────────────────────────────────────────
  if (dossier.userNotes && dossier.userNotes.length > 0) {
    let notesBlock = `🧠 INSIGHTS E NOTAS DO DOSSIÊ:\n`
    dossier.userNotes.forEach((note) => {
      notesBlock += `- ${note}\n`
    })
    parts.push(notesBlock)
  }

  // ── PERSONS ────────────────────────────────────────────────────────
  const personsBlock = formatPersonsForPrompt(dossier.persons || [])
  if (personsBlock) {
    parts.push(personsBlock)
  }

  // ── IMAGE DESCRIPTIONS (Assets Visuais do Dossiê) ──────────────────
  if (dossier.imageDescriptions && dossier.imageDescriptions.length > 0) {
    let imagesBlock = `🖼️ ASSETS VISUAIS DO DOSSIÊ (${dossier.imageDescriptions.length} imagens de referência):\n`
    dossier.imageDescriptions.forEach((desc, i) => {
      imagesBlock += `[${i + 1}] ${desc}\n`
    })
    parts.push(imagesBlock)
  }

  // ── NEURAL INSIGHTS ────────────────────────────────────────────────
  const insightsBlock = formatNeuralInsightsForPrompt(dossier.neuralInsights || [])
  if (insightsBlock) {
    parts.push(insightsBlock)
  }

  return parts.join('\n\n')
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Estima a quantidade de tokens de um bloco de texto.
 * Usa a heurística padrão de ~4 caracteres por token.
 */
export function estimateDossierTokens(block: string): number {
  return Math.ceil(block.length / 4)
}

/**
 * Limite mínimo de tokens para cache ser efetivo.
 * Claude Sonnet 4 / Opus 4: 1024 tokens
 * Claude Opus 4.5/4.6: 4096 tokens
 */
export const MIN_CACHE_TOKENS = 1024
