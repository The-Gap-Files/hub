/**
 * Constants Catalog Serializer
 * 
 * Serializa as constants criativas (script styles, visual styles, editorial objectives,
 * narrative angles, narrative roles) em formato texto para injeção no prompt da LLM.
 * 
 * Usado pelo Creative Direction Advisor e Monetization Planner para que a IA
 * conheça todas as opções disponíveis e possa escolher ou sugerir novas.
 */

import { getScriptStylesList } from '../constants/storytelling/script-styles'
import { getVisualStylesList } from '../constants/cinematography/visual-styles'
import { EDITORIAL_OBJECTIVES } from '../constants/content/editorial-objectives'
import { NARRATIVE_ANGLES } from '../constants/content/narrative-angles'
import { NARRATIVE_ROLES, calculateRoleDistribution } from '../constants/content/narrative-roles'

/**
 * Serializa todas as constants criativas em formato legível para a LLM.
 * Inclui IDs, nomes, descrições e detalhes técnicos suficientes para decisão.
 */
export function serializeConstantsCatalog(): string {
  let catalog = ''

  // ── Script Styles ──────────────────────────────────────────────
  catalog += '### 📝 ESTILOS DE ROTEIRO DISPONÍVEIS\n\n'
  getScriptStylesList().forEach(s => {
    catalog += `- **\`${s.id}\`**: "${s.name}"\n`
    catalog += `  ${s.description}\n\n`
  })

  // ── Visual Styles ──────────────────────────────────────────────
  catalog += '### 🎨 ESTILOS VISUAIS DISPONÍVEIS\n\n'
  getVisualStylesList().forEach(s => {
    catalog += `- **\`${s.id}\`**: "${s.name}"\n`
    catalog += `  ${s.description}\n`
    catalog += `  _Base:_ ${s.baseStyle}\n`
    catalog += `  _Atmosfera:_ ${s.atmosphereTags}\n\n`
  })

  // ── Editorial Objectives ───────────────────────────────────────
  catalog += '### 🎯 OBJETIVOS EDITORIAIS DISPONÍVEIS\n\n'
  EDITORIAL_OBJECTIVES.forEach(o => {
    catalog += `- **\`${o.id}\`**: "${o.name}" [${o.category}]\n`
    catalog += `  ${o.description}\n`
    // Truncar instructions muito longas para não estourar contexto
    const truncated = o.instruction.length > 200
      ? o.instruction.substring(0, 200) + '...'
      : o.instruction
    catalog += `  _Instrução:_ ${truncated}\n\n`
  })

  // ── Narrative Angles ───────────────────────────────────────────
  catalog += '### 🧭 ÂNGULOS NARRATIVOS DISPONÍVEIS\n\n'
  catalog += '_Escolha os ângulos mais relevantes para o dossiê. NÃO é obrigatório usar todos._\n\n'
  NARRATIVE_ANGLES.forEach(a => {
    catalog += `- **\`${a.id}\`**: "${a.name}"\n`
    catalog += `  ${a.description}\n`
    catalog += `  _Ex:_ ${a.example}\n\n`
  })

  // ── Short Format Types (Mecânica Narrativa) ────────────────────
  catalog += '### 🎬 FORMATOS DE SHORT DISPONÍVEIS (OBRIGATÓRIO para cada teaser)\n\n'
  catalog += '_Cada teaser DEVE usar um destes formatos. VARIE os formatos para testar mecânicas diferentes. NÃO use o mesmo formato em todos os teasers._\n\n'
  catalog += '- **`hook-brutal`**: Frase chocante → corte seco (30-40s). Sem contexto. Impacto puro.\n'
  catalog += '- **`pergunta-incomoda`**: Pergunta moral → micro-narrativa → pergunta final sem resposta (35-45s).\n'
  catalog += '- **`plot-twist`**: História curta → virada inesperada → corte antes da explicação (40-55s).\n'
  catalog += '- **`teaser-cinematografico`**: Clima pesado, ritmo lento → pausas dramáticas → corte (35-50s).\n'
  catalog += '- **`mini-documento`**: Explica UM detalhe específico com profundidade e dados (45-60s).\n'
  catalog += '- **`lista-rapida`**: "3 fatos que ninguém conta" → bullets impactantes (40-50s).\n'
  catalog += '- **`frase-memoravel`**: Frase forte + contexto mínimo. Máximo impacto em mínimo tempo (25-35s).\n\n'
  catalog += '⚠️ REGRA: Use PELO MENOS 3 formatos diferentes no plano. Máximo 50% dos teasers com o mesmo formato.\n\n'

  // ── Narrative Roles ────────────────────────────────────────────
  catalog += '### 🎭 PAPÉIS NARRATIVOS (OBRIGATÓRIO para cada teaser)\n\n'
  catalog += '_Cada teaser DEVE receber um papel. Isso define quanto contexto ele inclui._\n\n'
  NARRATIVE_ROLES.forEach(r => {
    catalog += `- **\`${r.id}\`**: "${r.name}" [contexto: ${r.contextLevel}]\n`
    catalog += `  ${r.description}\n\n`
  })

  return catalog
}

/**
 * Serializa a distribuição de papéis narrativos para N teasers.
 * Usado no system prompt do monetization planner.
 */
export function serializeRoleDistribution(teaserCount: number): string {
  const dist = calculateRoleDistribution(teaserCount)
  return `Para ${teaserCount} teasers, distribua os papéis assim:
- **gateway** (Porta de Entrada): ${dist.gateway} teaser(s) — contextualização COMPLETA
- **deep-dive** (Mergulho Direto): ${dist.deepDive} teaser(s) — contexto MÍNIMO (1 frase máx.)
- **hook-only** (Gancho Puro): ${dist.hookOnly} teaser(s) — ZERO contextualização`
}

/**
 * Retorna listas de IDs válidos para validação ou referência.
 */
export const SHORT_FORMAT_TYPES = [
  'hook-brutal', 'pergunta-incomoda', 'plot-twist',
  'teaser-cinematografico', 'mini-documento', 'lista-rapida', 'frase-memoravel'
] as const

export function getValidConstantIds() {
  return {
    scriptStyleIds: getScriptStylesList().map(s => s.id),
    visualStyleIds: getVisualStylesList().map(s => s.id),
    editorialObjectiveIds: EDITORIAL_OBJECTIVES.map(o => o.id),
    narrativeAngleIds: NARRATIVE_ANGLES.map(a => a.id),
    narrativeRoleIds: NARRATIVE_ROLES.map(r => r.id),
    shortFormatTypeIds: SHORT_FORMAT_TYPES as unknown as string[],
  }
}
