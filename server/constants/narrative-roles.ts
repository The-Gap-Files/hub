/**
 * Papéis Narrativos para Teasers
 * 
 * Define QUANTO CONTEXTO cada teaser deve incluir.
 * Ortogonal ao ângulo — um teaser pode ser "econômico + gateway" ou "econômico + hook-only".
 * 
 * Evita redundância: só 1 teaser apresenta o tema completo (gateway),
 * os demais mergulham direto no ângulo (deep-dive) ou vão pra revelação pura (hook-only).
 */

export interface NarrativeRole {
  id: NarrativeRoleId
  name: string
  description: string
  /** Nível de contextualização (para calibrar o Story Architect) */
  contextLevel: 'full' | 'minimal' | 'none'
  /** Instrução direta injetada no prompt de geração de roteiro */
  scriptInstruction: string
  /** Ícone Lucide para UI */
  icon: string
}

export type NarrativeRoleId = 'gateway' | 'deep-dive' | 'hook-only'

export const NARRATIVE_ROLES: NarrativeRole[] = [
  {
    id: 'gateway',
    name: 'Porta de Entrada',
    description: 'Apresentação completa do tema — quem, quando, onde, por quê. Funciona como standalone para quem nunca ouviu falar do assunto.',
    contextLevel: 'full',
    scriptInstruction: `Este é o teaser INTRODUTÓRIO (Gateway). Ele deve:
- Contextualizar o tema COMPLETAMENTE nos primeiros 15-20 segundos
- Incluir quem, quando, onde e por que o assunto importa
- Funcionar como peça STANDALONE — o espectador não precisa conhecer nada antes
- Estabelecer o "universo" do dossiê para que os outros teasers possam mergulhar direto
- Terminar com CTA forte para o Full Video`,
    icon: 'DoorOpen'
  },
  {
    id: 'deep-dive',
    name: 'Mergulho Direto',
    description: 'Assume familiaridade básica. Máximo 1 frase de contexto antes de mergulhar no ângulo específico.',
    contextLevel: 'minimal',
    scriptInstruction: `Este é um teaser de MERGULHO DIRETO (Deep-Dive). Ele deve:
- Assumir que o espectador tem noção básica do tema (pode ter visto outro teaser ou já conhece o assunto)
- Usar NO MÁXIMO 1 frase de contextualização superficial (ex: "O caso X esconde...")
- Ir DIRETO para o ângulo específico sem recontar a história desde o início
- Aprofundar um aspecto que o gateway não cobre em detalhe
- NÃO repetir datas, nomes ou fatos que são "introdução básica"`,
    icon: 'ArrowDownToLine'
  },
  {
    id: 'hook-only',
    name: 'Gancho Puro',
    description: 'Zero contextualização. Começa pela revelação ou contradição mais chocante. Formato viral máximo.',
    contextLevel: 'none',
    scriptInstruction: `Este é um teaser de GANCHO PURO (Hook-Only). Ele deve:
- NÃO incluir NENHUMA contextualização — zero "em tal ano", zero "segundo fulano"
- Começar DIRETO pela revelação, contradição ou fato mais chocante do ângulo
- O espectador deve ficar CONFUSO e CURIOSO nos primeiros 3 segundos
- A falta de contexto é INTENCIONAL — força o CTA para o Full Video
- Formato viral puro: declaração impactante → desenvolvimento rápido → CTA
- Ideal para TikTok e Reels onde a atenção é mínima`,
    icon: 'Zap'
  }
]

// ── Helpers ──────────────────────────────────────────────────────

export function getNarrativeRoleById(id: string): NarrativeRole | undefined {
  return NARRATIVE_ROLES.find(r => r.id === id)
}

/**
 * Calcula a distribuição ideal de papéis para N teasers.
 * 
 * Regra:
 *   - Gateway: 1 (ou 2 se totalTeasers >= 10)
 *   - Deep-Dive: ~50% do total
 *   - Hook-Only: restante (~30-40%)
 */
export function calculateRoleDistribution(totalTeasers: number): {
  gateway: number
  deepDive: number
  hookOnly: number
} {
  const gateway = totalTeasers >= 10 ? 2 : 1
  const remaining = totalTeasers - gateway
  const deepDive = Math.ceil(remaining * 0.55)
  const hookOnly = remaining - deepDive

  return { gateway, deepDive, hookOnly }
}
