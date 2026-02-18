import { z } from 'zod'
import { BriefFactSchema, BriefGlobalSafetySchema, DEFAULT_TEASER_GLOBAL_SAFETY } from './briefing.types'

/**
 * EpisodeBriefBundleV1
 * -----------------------------------------------------------------------------
 * Contrato estável para briefs de EPISÓDIOS COMPLETOS (EP1, EP2, EP3).
 * Objetivo: distribuir os fatos do dossiê bruto entre os 3 episódios,
 * definindo o que cada episódio pode revelar, o que deve guardar e os
 * ganchos abertos que conectam a série — eliminando alucinação e choque
 * de assuntos entre episódios no Story Architect.
 *
 * Separação de responsabilidades (ISP):
 * - BriefBundleV1     → exclusivo para teasers (gateway / deep-dive / hook-only)
 * - EpisodeBriefBundleV1 → exclusivo para episódios completos (fullVideo)
 */

// =============================================================================
// EpisodeBrief — brief de um episódio individual
// =============================================================================

export const EpisodeBriefSchema = z.object({
  episodeNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),

  /** Função narrativa canônica do episódio */
  narrativeFunction: z.string().min(5).max(200),
  // ex: "Origem + Ascensão", "Grande Virada", "Desfecho + Legado"

  /** Arco emocional esperado */
  emotionalArc: z.string().min(5).max(200),
  // ex: "suspense → tensão crescente → cliffhanger"

  /**
   * Nível de resolução que este episódio pode oferecer.
   * - none: episódio termina em aberto (EP1 e EP2)
   * - partial: revela parte da resolução (EP2 pode indicar a virada)
   * - full: fecha todos os arcos (EP3)
   */
  resolutionLevel: z.enum(['none', 'partial', 'full']),

  /**
   * Fatos EXCLUSIVOS deste episódio — o que este EP pode revelar.
   * São selecionados do dossier bruto e curados para o escopo narrativo deste EP.
   */
  exclusiveFacts: z.array(BriefFactSchema).min(10).max(40),

  /**
   * Fatos que este episódio DEVE GUARDAR para os próximos.
   * O Story Architect e o roteirista NÃO devem revelar estes fatos aqui.
   */
  holdbackFacts: z.array(BriefFactSchema).min(3).max(20),

  /**
   * Perguntas abertas que este episódio levanta mas não fecha.
   * Funcionam como ganchos de retenção entre episódios.
   */
  suggestedOpenLoops: z.array(z.string().min(10).max(200)).min(2).max(6),

  /**
   * O que este episódio PROIBIDO de resolver.
   * Evita que o roteirista queime revelações de episódios futuros.
   */
  forbiddenResolutions: z.array(z.string().min(5).max(200)).min(2).max(10),

  /**
   * Frase de conexão com o episódio anterior (máximo 1 frase).
   * null para EP1 (sem episódio anterior).
   */
  previousEpisodeBridge: z.string().min(5).max(300).nullable(),
})

export type EpisodeBrief = z.infer<typeof EpisodeBriefSchema>

// =============================================================================
// EpisodeBriefBundleV1 — bundle completo com os 3 episódios
// =============================================================================

export const EpisodeBriefBundleV1Schema = z.object({
  version: z.enum(['episodeBriefBundleV1']),
  language: z.string().default('pt-BR'),
  theme: z.string().min(5),
  title: z.string().optional(),

  /**
   * Regras visuais globais — compartilhadas com os teasers.
   * Reutiliza BriefGlobalSafety sem duplicar definição (ISP).
   */
  globalSafety: BriefGlobalSafetySchema,

  /**
   * Fatos de BACKGROUND compartilhados entre todos os episódios.
   * São fatos de contexto geral que qualquer EP pode mencionar sem spoiler.
   * Ex: localização, época, identidade pública dos personagens, informações históricas.
   */
  sharedFacts: z.array(BriefFactSchema).min(5).max(30),

  /** Briefs individuais por episódio */
  episodes: z.object({
    ep1: EpisodeBriefSchema,
    ep2: EpisodeBriefSchema,
    ep3: EpisodeBriefSchema,
  }),
})

export type EpisodeBriefBundleV1 = z.infer<typeof EpisodeBriefBundleV1Schema>

// =============================================================================
// DEFAULT_EPISODE_GLOBAL_SAFETY — fallback mínimo para episódios
// =============================================================================

/**
 * Reutiliza os defaults dos teasers como base.
 * Episódios completos têm mais liberdade narrativa mas
 * mantêm as mesmas restrições visuais da plataforma.
 */
export const DEFAULT_EPISODE_GLOBAL_SAFETY = DEFAULT_TEASER_GLOBAL_SAFETY

// =============================================================================
// Helpers de normalização
// =============================================================================

export function normalizeEpisodeBriefBundleV1(input: unknown): EpisodeBriefBundleV1 {
  const parsed = EpisodeBriefBundleV1Schema.parse(input)

  // Garante globalSafety mínimo (mesma lógica do BriefBundleV1)
  const forbidden = new Set([
    ...(parsed.globalSafety?.forbiddenElements || []),
    ...DEFAULT_EPISODE_GLOBAL_SAFETY.forbiddenElements,
  ])
  const allowed = new Set([
    ...(parsed.globalSafety?.allowedArtifacts || []),
    ...DEFAULT_EPISODE_GLOBAL_SAFETY.allowedArtifacts,
  ])

  return {
    ...parsed,
    globalSafety: {
      ...parsed.globalSafety,
      forbiddenElements: Array.from(forbidden),
      allowedArtifacts: Array.from(allowed),
      forbiddenNarrationTerms: parsed.globalSafety.forbiddenNarrationTerms || [],
      notes: parsed.globalSafety.notes || [],
    },
  }
}

// =============================================================================
// Formatadores para prompt
// =============================================================================

/**
 * Formata o brief de um episódio específico como bloco textual para o LLM.
 * Este bloco substitui o dossier bruto no Story Architect e no roteirista.
 */
export function formatEpisodeBriefForPrompt(
  bundle: EpisodeBriefBundleV1,
  episodeNumber: 1 | 2 | 3
): string {
  const epKey = `ep${episodeNumber}` as 'ep1' | 'ep2' | 'ep3'
  const ep = bundle.episodes[epKey]
  const lines: string[] = []

  lines.push(`📋 TEMA: ${bundle.theme}`)
  if (bundle.title) lines.push(`📋 TÍTULO DO DOSSIER: ${bundle.title}`)
  lines.push(`🎬 EPISODE BRIEF — EP${episodeNumber} (versão: ${bundle.version})`)
  lines.push(`🎭 Função narrativa: ${ep.narrativeFunction}`)
  lines.push(`💫 Arco emocional: ${ep.emotionalArc}`)
  lines.push(`📊 Nível de resolução: ${ep.resolutionLevel}`)

  // Fatos compartilhados (background)
  if (bundle.sharedFacts.length > 0) {
    lines.push(`\n🌐 FATOS DE BACKGROUND (todos os EPs podem usar)`)
    bundle.sharedFacts.forEach((fact, i) => {
      const ref = fact.sourceRef ? ` [fonte: ${fact.sourceRef}]` : ''
      lines.push(`${i + 1}. ${fact.text}${ref}`)
    })
  }

  // Fatos exclusivos deste episódio
  lines.push(`\n🔑 FATOS EXCLUSIVOS DO EP${episodeNumber} (somente estes podem ser revelados aqui)`)
  ep.exclusiveFacts.forEach((fact, i) => {
    const ref = fact.sourceRef ? ` [fonte: ${fact.sourceRef}]` : ''
    lines.push(`${i + 1}. ${fact.text}${ref}`)
  })

  // Fatos proibidos de revelar
  lines.push(`\n🔒 FATOS BLOQUEADOS — guardar para episódios futuros (NÃO REVELAR NESTE EP)`)
  ep.holdbackFacts.forEach((fact, i) => {
    const ref = fact.sourceRef ? ` [fonte: ${fact.sourceRef}]` : ''
    lines.push(`${i + 1}. ❌ ${fact.text}${ref}`)
  })

  // Resoluções proibidas
  lines.push(`\n⛔ RESOLUÇÕES PROIBIDAS NESTE EPISÓDIO`)
  ep.forbiddenResolutions.forEach(r => lines.push(`- ❌ ${r}`))

  // Ganchos sugeridos
  lines.push(`\n🪝 GANCHOS ABERTOS SUGERIDOS (perguntas que este EP levanta mas NÃO fecha)`)
  ep.suggestedOpenLoops.forEach((loop, i) => lines.push(`${i + 1}. ${loop}`))

  // Ponte com episódio anterior
  if (ep.previousEpisodeBridge) {
    lines.push(`\n🔗 PONTE COM EPISÓDIO ANTERIOR (1 frase máx.)`)
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

/**
 * Formata o bundle completo como bloco de diagnóstico (debug / UI).
 */
export function formatEpisodeBriefBundleV1AsSummary(bundle: EpisodeBriefBundleV1): string {
  const lines: string[] = []
  lines.push(`📋 EPISODE BRIEF BUNDLE — versão: ${bundle.version}`)
  lines.push(`🎯 Tema: ${bundle.theme}`)
  lines.push(`🌐 Fatos compartilhados: ${bundle.sharedFacts.length}`)
  lines.push(`\nEP1 — ${bundle.episodes.ep1.narrativeFunction}`)
  lines.push(`  exclusiveFacts: ${bundle.episodes.ep1.exclusiveFacts.length} | holdbackFacts: ${bundle.episodes.ep1.holdbackFacts.length}`)
  lines.push(`EP2 — ${bundle.episodes.ep2.narrativeFunction}`)
  lines.push(`  exclusiveFacts: ${bundle.episodes.ep2.exclusiveFacts.length} | holdbackFacts: ${bundle.episodes.ep2.holdbackFacts.length}`)
  lines.push(`EP3 — ${bundle.episodes.ep3.narrativeFunction}`)
  lines.push(`  exclusiveFacts: ${bundle.episodes.ep3.exclusiveFacts.length} | holdbackFacts: ${bundle.episodes.ep3.holdbackFacts.length}`)
  return lines.join('\n')
}

// =============================================================================
// Body schema para o endpoint POST
// =============================================================================

export const GenerateEpisodeBriefBodySchema = z.object({
  force: z.boolean().optional(),
})
