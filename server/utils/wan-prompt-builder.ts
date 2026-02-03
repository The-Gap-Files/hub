/**
 * Helper para construir prompts visuais otimizados para WAN 2.2
 * 
 * WAN responde melhor a prompts descritivos e narrativos (linguagem natural)
 * do que apenas listas de tags soltas.
 */

interface VisualStylePromptData {
  baseStyle: string
  lightingTags: string
  atmosphereTags: string
  compositionTags: string
  generalTags?: string
}

/**
 * Constrói um prompt visual narrativo otimizado para WAN 2.2
 * 
 * Estrutura:
 * 1. Ancoragem (baseStyle) - Define o "cérebro" do modelo
 * 2. Composição - Como a cena está enquadrada
 * 3. Iluminação mesclada com atmosfera - Cria contexto espacial
 * 4. Tags gerais - Detalhes adicionais
 * 
 * @param styleData - Dados do estilo visual categorizados
 * @param sceneDescription - Descrição da cena específica
 * @returns Prompt otimizado para WAN 2.2
 */
export function buildWanPrompt(
  styleData: VisualStylePromptData,
  sceneDescription: string
): string {
  const parts: string[] = []

  // 1. ANCORAGEM: Estilo base sempre primeiro
  parts.push(styleData.baseStyle)

  // 2. DESCRIÇÃO DA CENA (o que está acontecendo)
  parts.push(sceneDescription)

  // 3. COMPOSIÇÃO: Como a câmera vê a cena
  if (styleData.compositionTags) {
    parts.push(styleData.compositionTags)
  }

  // 4. ILUMINAÇÃO + ATMOSFERA: Mesclados para criar contexto espacial
  // Ex: "warm golden hour light creating a dreamlike atmosphere"
  if (styleData.lightingTags && styleData.atmosphereTags) {
    parts.push(`${styleData.lightingTags}, ${styleData.atmosphereTags} mood`)
  } else if (styleData.lightingTags) {
    parts.push(styleData.lightingTags)
  } else if (styleData.atmosphereTags) {
    parts.push(`${styleData.atmosphereTags} atmosphere`)
  }

  // 5. TAGS GERAIS: Detalhes extras
  if (styleData.generalTags) {
    parts.push(styleData.generalTags)
  }

  // Junta tudo com vírgulas (linguagem natural)
  return parts.join(', ')
}

/**
 * Constrói instruções para o roteirista sobre como descrever cenas visuais
 * 
 * @param styleData - Dados do estilo visual
 * @returns Instruções para o prompt do sistema
 */
export function buildVisualInstructionsForScript(
  styleData: VisualStylePromptData
): string {
  return `
DIRETRIZES VISUAIS OBRIGATÓRIAS (Estilo: ${styleData.baseStyle}):

As descrições visuais devem ser CINEMATOGRÁFICAS e EMOTIVAS, seguindo este estilo:

**Iluminação**: ${styleData.lightingTags}
- Use verbos no gerúndio para descrever luz em movimento (ex: "light filtering through", "shadows dancing")

**Atmosfera**: ${styleData.atmosphereTags}
- Mescle a atmosfera com elementos físicos da cena

**Composição**: ${styleData.compositionTags}
- Especifique ângulos de câmera e enquadramento

**Ação Suave**: Sempre inclua elementos em movimento sutil:
- Partículas flutuando (dust dancing, snow falling, embers floating)
- Elementos naturais (leaves rustling, water rippling, fabric swaying)
- Detalhes humanos (eyes blinking, breath visible, hair moving)

**Formato da Descrição Visual**:
"[ESTILO BASE], [DESCRIÇÃO DA CENA COM AÇÃO], [COMPOSIÇÃO], [ILUMINAÇÃO + ATMOSFERA], [DETALHES EM MOVIMENTO]"

Exemplo: "Cinematic 2D illustration, ancient temple ruins with vines growing over stone pillars, wide establishing shot from low angle, warm golden hour light filtering through clouds creating a dreamlike atmosphere, dust particles dancing in the light beams"
`.trim()
}
