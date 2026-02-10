/**
 * Constants Catalog Serializer
 * 
 * Serializa as constants criativas (script styles, visual styles, editorial objectives)
 * em formato texto para injeção no prompt da LLM.
 * 
 * Usado pelo Creative Direction Advisor e Monetization Planner para que a IA
 * conheça todas as opções disponíveis e possa escolher ou sugerir novas.
 */

import { getScriptStylesList } from '../constants/script-styles'
import { getVisualStylesList } from '../constants/visual-styles'
import { EDITORIAL_OBJECTIVES } from '../constants/editorial-objectives'

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

  return catalog
}

/**
 * Retorna listas de IDs válidos para validação ou referência.
 */
export function getValidConstantIds() {
  return {
    scriptStyleIds: getScriptStylesList().map(s => s.id),
    visualStyleIds: getVisualStylesList().map(s => s.id),
    editorialObjectiveIds: EDITORIAL_OBJECTIVES.map(o => o.id),
  }
}
