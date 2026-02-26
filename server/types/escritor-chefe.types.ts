import { z } from 'zod'
import { BriefGlobalSafetySchema, DEFAULT_TEASER_GLOBAL_SAFETY } from './briefing.types'

/**
 * EscritorChefeBundleV1
 * -----------------------------------------------------------------------------
 * Substitui o EpisodeBriefBundleV1 (facts estruturados) por PROSA NARRATIVA
 * densa por episódio. O Escritor Chefe lê o dossier completo e escreve a
 * história de cada episódio em prosa, respeitando território narrativo e holdbacks.
 *
 * Geração sequencial: EP1 → EP2 (com contexto EP1) → EP3 (com contexto EP1+EP2)
 * Isso garante que holdbacks são respeitados by design.
 *
 * Downstream:
 * - Story Architect recebe a prosa como source of truth
 * - Writer recebe a prosa-resumo e EXPANDE (nunca resume)
 * - Screenwriter converte a prosa final em cenas
 */

// =============================================================================
// EpisodeProse — prosa de um episódio individual
// =============================================================================

export const EpisodeProseSchema = z.object({
  episodeNumber: z.number().int().min(1).max(3),

  /** Função narrativa canônica do episódio */
  narrativeFunction: z.string().min(5).max(1000),

  /** Arco emocional esperado */
  emotionalArc: z.string().min(5).max(1500),

  /**
   * Nível de resolução que este episódio pode oferecer.
   * - none: episódio termina em aberto (EP1)
   * - partial: revela parte da resolução (EP2)
   * - full: fecha todos os arcos (EP3)
   */
  resolutionLevel: z.enum(['none', 'partial', 'full']),

  /**
   * PROSA NARRATIVA COMPLETA do episódio.
   * Dividida em blocos Markdown (## headers).
   * Mínimo 5000 chars (~3000 palavras), máximo 80000 chars.
   */
  prose: z.string().min(5000).max(80000),

  /**
   * Contagem de palavras da prosa (calculado pós-geração, não pelo LLM).
   */
  proseWordCount: z.number().int().optional(),

  /**
   * Frase de conexão com o episódio anterior (máximo 1 frase).
   * null para EP1 (sem episódio anterior).
   */
  previousEpisodeBridge: z.string().max(300).nullable(),

  /**
   * Tópicos/procedimentos que episódios ANTERIORES já cobriram em detalhe.
   * O Story Architect e o Writer podem REFERENCIAR por nome, mas
   * NÃO devem re-descrever ou elaborar estes tópicos.
   * EP1 sempre tem array vazio (não há episódio anterior).
   */
  previouslyCoveredTopics: z.array(z.string().min(5).max(300)).min(0).max(50).default([]),
})

export type EpisodeProse = z.infer<typeof EpisodeProseSchema>

// =============================================================================
// EscritorChefeBundleV1 — bundle completo com 3 episódios
// =============================================================================

export const EscritorChefeBundleV1Schema = z.object({
  version: z.literal('escritorChefeBundleV1'),
  language: z.string().default('pt-BR'),
  theme: z.string().min(5),
  title: z.string().optional(),

  /** Regras visuais hard para toda a série */
  globalSafety: BriefGlobalSafetySchema,

  /**
   * Contexto compartilhado (background) que todos os episódios podem usar.
   * Substitui sharedFacts[] com prosa contextual.
   */
  sharedContext: z.string().min(100).max(5000),

  /** Os 3 episódios com prosa narrativa */
  episodes: z.object({
    ep1: EpisodeProseSchema,
    ep2: EpisodeProseSchema,
    ep3: EpisodeProseSchema,
  }),
})

export type EscritorChefeBundleV1 = z.infer<typeof EscritorChefeBundleV1Schema>

// =============================================================================
// DEFAULT_ESCRITOR_CHEFE_GLOBAL_SAFETY
// =============================================================================

export const DEFAULT_ESCRITOR_CHEFE_GLOBAL_SAFETY = DEFAULT_TEASER_GLOBAL_SAFETY

// =============================================================================
// Helpers de normalização
// =============================================================================

export function normalizeEscritorChefeBundleV1(input: unknown): EscritorChefeBundleV1 {
  const parsed = EscritorChefeBundleV1Schema.parse(input)

  // Garante globalSafety mínimo
  const forbidden = new Set([
    ...(parsed.globalSafety?.forbiddenElements || []),
    ...DEFAULT_ESCRITOR_CHEFE_GLOBAL_SAFETY.forbiddenElements,
  ])
  const allowed = new Set([
    ...(parsed.globalSafety?.allowedArtifacts || []),
    ...DEFAULT_ESCRITOR_CHEFE_GLOBAL_SAFETY.allowedArtifacts,
  ])

  // Calcular word count para cada episódio
  const withWordCount = (ep: EpisodeProse): EpisodeProse => ({
    ...ep,
    proseWordCount: ep.prose.split(/\s+/).length,
  })

  return {
    ...parsed,
    globalSafety: {
      ...parsed.globalSafety,
      forbiddenElements: Array.from(forbidden),
      allowedArtifacts: Array.from(allowed),
      forbiddenNarrationTerms: parsed.globalSafety.forbiddenNarrationTerms || [],
      notes: parsed.globalSafety.notes || [],
    },
    episodes: {
      ep1: withWordCount(parsed.episodes.ep1),
      ep2: withWordCount(parsed.episodes.ep2),
      ep3: withWordCount(parsed.episodes.ep3),
    },
  }
}

// =============================================================================
// Formatadores para prompt
// =============================================================================

/**
 * Formata a prosa de um episódio específico como bloco textual para o LLM.
 * Este bloco substitui o dossier bruto no Story Architect e no Writer.
 */
export function formatEpisodeProseForPrompt(
  bundle: EscritorChefeBundleV1,
  episodeNumber: 1 | 2 | 3
): string {
  const epKey = `ep${episodeNumber}` as 'ep1' | 'ep2' | 'ep3'
  const ep = bundle.episodes[epKey]
  const lines: string[] = []

  lines.push(`📋 TEMA: ${bundle.theme}`)
  if (bundle.title) lines.push(`📋 TÍTULO DO DOSSIER: ${bundle.title}`)
  lines.push(`🎬 PROSA EP${episodeNumber} — Escritor Chefe (v1)`)
  lines.push(`🎭 Função narrativa: ${ep.narrativeFunction}`)
  lines.push(`💫 Arco emocional: ${ep.emotionalArc}`)
  lines.push(`📊 Nível de resolução: ${ep.resolutionLevel}`)
  if (ep.proseWordCount) {
    lines.push(`📊 Volume: ~${ep.proseWordCount} palavras`)
  }

  // Contexto compartilhado (background)
  lines.push(`\n🌐 CONTEXTO COMPARTILHADO (background para todos os EPs)`)
  lines.push(bundle.sharedContext)

  // Prosa narrativa do episódio
  lines.push(`\n📖 PROSA NARRATIVA DO EP${episodeNumber} (fonte da verdade — use como base)`)
  lines.push(ep.prose)

  // Tópicos já cobertos por episódios anteriores
  const coveredTopics = ep.previouslyCoveredTopics || []
  if (coveredTopics.length > 0) {
    lines.push(`\n⛔ TÓPICOS JÁ COBERTOS EM EPISÓDIOS ANTERIORES (NÃO RE-DESCREVER)`)
    lines.push(`🚨 Os seguintes tópicos foram descritos em DETALHE em episódios anteriores.`)
    lines.push(`Você pode REFERENCIAR por nome, mas PROIBIDO re-descrever ou elaborar.`)
    coveredTopics.forEach((topic, i) => lines.push(`${i + 1}. ⏭️ ${topic}`))
  }

  // Ponte com episódio anterior
  if (ep.previousEpisodeBridge) {
    lines.push(`\n🔗 PONTE COM EPISÓDIO ANTERIOR`)
    lines.push(`"${ep.previousEpisodeBridge}"`)
  }

  // Segurança visual global
  lines.push(`\n🛡️ REGRAS VISUAIS GLOBAIS`)
  for (const f of bundle.globalSafety.forbiddenElements.slice(0, 20)) {
    lines.push(`- ❌ ${f}`)
  }
  lines.push(`\n🧰 ARTEFATOS VISUAIS PERMITIDOS`)
  for (const a of bundle.globalSafety.allowedArtifacts.slice(0, 20)) {
    lines.push(`- ✅ ${a}`)
  }

  return lines.join('\n')
}

// =============================================================================
// Summary formatter (para exibição na UI)
// =============================================================================

export function formatEscritorChefeBundleV1AsSummary(bundle: EscritorChefeBundleV1): string {
  const eps = [bundle.episodes.ep1, bundle.episodes.ep2, bundle.episodes.ep3]
  const lines: string[] = [
    `📖 Escritor Chefe — ${bundle.theme}`,
    '',
  ]
  for (const ep of eps) {
    const words = ep.proseWordCount || ep.prose.split(/\s+/).length
    lines.push(`EP${ep.episodeNumber}: ${ep.narrativeFunction} (${words} palavras, ${ep.resolutionLevel})`)
  }
  return lines.join('\n')
}
