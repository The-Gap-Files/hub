import { z } from 'zod'

/**
 * BriefBundleV1
 * -----------------------------------------------------------------------------
 * Contrato estável para briefs persistidos no Dossier e reutilizados no pipeline.
 * Objetivo: reduzir ruído do dossiê bruto em TEASERS (gateway/deep-dive/hook-only)
 * sem perder os fatos essenciais e sem “contaminar” o funil com elementos proibidos.
 */

export const BriefFactSchema = z.object({
  /** Frase factual curta (1-2 linhas) */
  text: z.string().min(8).max(280),
  /** Referência opcional (título da fonte / índice / url) */
  sourceRef: z.string().max(300).optional().transform(v => v && v.length >= 3 ? v : undefined)
})

export type BriefFact = z.infer<typeof BriefFactSchema>

export const BriefRoleIdSchema = z.enum(['gateway', 'deep-dive', 'hook-only'])
export type BriefRoleId = z.infer<typeof BriefRoleIdSchema>

export const BriefRoleBriefSchema = z.object({
  /**
   * Nível de contexto permitido.
   * - hook-only: mínimo (1-3 fatos)
   * - deep-dive: baixo-médio (foco no ângulo)
   * - gateway: médio (standalone)
   */
  contextLevel: z.enum(['minimal', 'low', 'medium']).default('low'),
  /** Quantidade sugerida de fatos para o papel */
  suggestedFactsMin: z.number().int().min(1).max(60).default(6),
  suggestedFactsMax: z.number().int().min(1).max(80).default(18),
  /** Regras específicas de linguagem/estrutura para o papel */
  notes: z.array(z.string()).default([])
})

export type BriefRoleBrief = z.infer<typeof BriefRoleBriefSchema>

export const BriefGlobalSafetySchema = z.object({
  /**
   * Regras hard para evitar conteúdo/visual que derruba o short (e/ou filtros).
   * Importante: essas regras são “globais” e devem influenciar monetization,
   * story-architect e script para TEASERS.
   */
  forbiddenElements: z.array(z.string()).min(4).max(40),
  allowedArtifacts: z.array(z.string()).min(4).max(40),
  /** Palavras/termos que não devem aparecer na narração de teasers (opcional) */
  forbiddenNarrationTerms: z.array(z.string()).max(30).default([]),
  /** Observações adicionais, curtas */
  notes: z.array(z.string()).max(20).default([])
})

export type BriefGlobalSafety = z.infer<typeof BriefGlobalSafetySchema>

export const BriefBundleV1Schema = z.object({
  version: z.string().describe('Versão obrigatória: sempre "briefBundleV1"'),
  language: z.string().default('pt-BR'),
  theme: z.string().min(5),
  title: z.string().optional(),

  globalSafety: BriefGlobalSafetySchema,

  /** Lista de fatos safe e utilizáveis (fonte da verdade para teasers) */
  facts: z.array(BriefFactSchema).min(12).max(80),

  /** Diretrizes por papel narrativo */
  roleBriefs: z.object({
    gateway: BriefRoleBriefSchema.default({ contextLevel: 'medium', suggestedFactsMin: 10, suggestedFactsMax: 22, notes: [] }),
    'deep-dive': BriefRoleBriefSchema.default({ contextLevel: 'low', suggestedFactsMin: 8, suggestedFactsMax: 16, notes: [] }),
    'hook-only': BriefRoleBriefSchema.default({ contextLevel: 'minimal', suggestedFactsMin: 3, suggestedFactsMax: 6, notes: [] })
  })
})

export type BriefBundleV1 = z.infer<typeof BriefBundleV1Schema>

// =============================================================================
// Micro-brief por teaser (isolado por item)
// =============================================================================

/**
 * TeaserMicroBriefV1
 * -----------------------------------------------------------------------------
 * Micro-brief CURADO pelo monetizador para UM item específico (teaser).
 * Este é o ÚNICO contexto factual que o Story Architect deve ver para aquele teaser.
 */
export const TeaserMicroBriefV1Schema = z.object({
  version: z.string().describe('Versão obrigatória: sempre "teaserMicroBriefV1"'),
  narrativeRole: BriefRoleIdSchema,
  angleCategory: z.string().min(2).max(80),
  angle: z.string().min(5).max(220),

  /** Fatos selecionados do BriefBundleV1 global para este item (5–12) */
  facts: z.array(BriefFactSchema).min(5).max(12),

  /** Segurança/artefatos focados para este item (reforça hard rules) */
  forbiddenElements: z.array(z.string()).min(4).max(30),
  allowedArtifacts: z.array(z.string()).min(4).max(30),

  /** Observações curtas para o Arquiteto (1-6 bullets) */
  notes: z.array(z.string()).max(10).default([])
})

export type TeaserMicroBriefV1 = z.infer<typeof TeaserMicroBriefV1Schema>

export function formatTeaserMicroBriefV1ForPrompt(m: TeaserMicroBriefV1): string {
  const lines: string[] = []

  lines.push(`🧾 MICRO-BRIEF (por teaser) — versão: ${m.version}`)
  lines.push(`🎭 role: ${m.narrativeRole}`)
  lines.push(`🏷️ angleCategory: ${m.angleCategory}`)
  lines.push(`🎯 angle: ${m.angle}`)

  lines.push(`\n🛡️ SEGURANÇA (hard)`)
  for (const f of (m.forbiddenElements || []).slice(0, 24)) lines.push(`- ❌ ${f}`)
  lines.push(`\n🧰 ARTEFATOS PERMITIDOS`)
  for (const a of (m.allowedArtifacts || []).slice(0, 24)) lines.push(`- ✅ ${a}`)

  lines.push(`\n🔫 FATOS PERMITIDOS (somente estes)`)
  m.facts.forEach((fact, i) => {
    const ref = fact.sourceRef ? ` [fonte: ${fact.sourceRef}]` : ''
    lines.push(`${i + 1}. ${fact.text}${ref}`)
  })

  if (m.notes && m.notes.length > 0) {
    lines.push(`\n🧠 NOTAS (curtas)`)
    for (const n of m.notes.slice(0, 10)) lines.push(`- ${n}`)
  }

  return lines.join('\n')
}

/**
 * Defaults “opinionados” (mínimos) para segurança visual nos teasers.
 * A skill de briefing deve refletir isso, mas este fallback evita bundle incompleto.
 */
export const DEFAULT_TEASER_GLOBAL_SAFETY: BriefGlobalSafety = {
  forbiddenElements: [
    'armas de fogo, rifles, pistolas, munição, gatilho',
    'atirador, execução, assassinato explícito, violência gráfica',
    'sangue, gore, corpos mutilados, tortura explícita',
    'close-up de mãos humanas, close-up de rostos humanos (evitar macro/anatomia)',
    'cenas em sinagogas/templos com ameaça explícita (substituir por artefatos: manifesto, tela, manchete)',
    'símbolos/extremismo contemporâneo em destaque (substituir por “texto recortado/blur”)'
  ],
  allowedArtifacts: [
    'documento, decreto, registro, arquivo, dossiê, carimbo, selo de cera',
    'moedas, cofre, livro-caixa, inventário, recibo, contrato',
    'monitor, tela, manifesto (sem arma), headline, recorte de jornal, thread desfocada',
    'mapa, corredor de arquivo, sala de leitura, prateleiras, luz de vela, sombras',
    'silhuetas não-identificáveis sem rosto/mãos em close'
  ],
  forbiddenNarrationTerms: [],
  notes: [
    'Choque moderno deve ser por ARTEFATOS (texto/monitor/documento), não por violência.',
    'Se precisar de “ameaça”, use abstração: sombras, recortes, documentos, sem ação violenta.'
  ]
}

/**
 * Formata o bundle em um bloco textual curto para ser usado como “dossiê” nos teasers.
 * Esse bloco é propositalmente menor e mais estável do que as fontes brutas.
 */
export function formatBriefBundleV1AsDossierBlock(bundle: BriefBundleV1): string {
  const facts = (bundle.facts || []).slice(0, 40)
  const lines: string[] = []

  lines.push(`📋 TEMA: ${bundle.theme}`)
  if (bundle.title) lines.push(`📋 TÍTULO: ${bundle.title}`)
  lines.push(`🧾 BRIEF (TEASERS) — versão: ${bundle.version}`)

  lines.push(`\n🛡️ REGRAS HARD (GLOBAL SAFETY)`)
  for (const f of bundle.globalSafety.forbiddenElements.slice(0, 24)) lines.push(`- ❌ ${f}`)
  lines.push(`\n🧰 ARTEFATOS VISUAIS PERMITIDOS`)
  for (const a of bundle.globalSafety.allowedArtifacts.slice(0, 24)) lines.push(`- ✅ ${a}`)

  lines.push(`\n🔫 MUNIÇÃO NARRATIVA (FATOS SAFE)`)
  facts.forEach((fact, i) => {
    const ref = fact.sourceRef ? ` [fonte: ${fact.sourceRef}]` : ''
    lines.push(`${i + 1}. ${fact.text}${ref}`)
  })

  lines.push(`\n🎭 DIRETRIZES POR PAPEL`)
  const rb = bundle.roleBriefs
  lines.push(`- gateway: contextLevel=${rb.gateway.contextLevel}, facts=${rb.gateway.suggestedFactsMin}-${rb.gateway.suggestedFactsMax}`)
  lines.push(`- deep-dive: contextLevel=${rb['deep-dive'].contextLevel}, facts=${rb['deep-dive'].suggestedFactsMin}-${rb['deep-dive'].suggestedFactsMax}`)
  lines.push(`- hook-only: contextLevel=${rb['hook-only'].contextLevel}, facts=${rb['hook-only'].suggestedFactsMin}-${rb['hook-only'].suggestedFactsMax}`)

  return lines.join('\n')
}

