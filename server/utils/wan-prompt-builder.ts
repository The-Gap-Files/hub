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

Each visualDescription must be a COMPLETE, STANDALONE image-generation prompt in English. It will be sent directly to the image model with no further processing or merge. You MUST incorporate the visual style (base, lighting, atmosphere, composition) into each scene description in natural language.

**CRITICAL — Narration Governs Visual:** The visualDescription MUST visually represent what the narration is saying in that scene. If the narration says "The bishop signed the sentence", the visual MUST show a document being signed, an episcopal seal, a quill on parchment, or similar — NEVER an unrelated candle or landscape. Test: "If someone SEES this image and HEARS this narration together, does it make immediate sense?" If NOT → rewrite.

**CRITICAL — Âncora de estilo:** Start EVERY visualDescription with the exact base style phrase (or its full wording). For example, if the style is "Cinematic 2D illustration, Studio Ghibli art style dark variant, painterly anime aesthetic, moody and atmospheric", the first phrase of each prompt MUST include that same anchor so the image model keeps a consistent look. Do not shorten to just "Cinematic 2D illustration"; include the full style identifier (e.g. "Studio Ghibli", "painterly anime") when provided.

**Lighting**: ${styleData.lightingTags}
- Use gerund verbs for light in motion (e.g. "light filtering through", "shadows dancing")

**Atmosphere**: ${styleData.atmosphereTags}
- Blend atmosphere with physical elements of the scene

**Composition**: ${styleData.compositionTags}
- Specify camera angles and framing

**Soft motion**: Include subtle motion (dust, leaves, breath, fabric) when it fits the scene.

**Anatomy and grounded scene (reduce AI artifacts):**
- When the scene shows a character or human figure, include in the prompt: correct anatomy, two hands, proportional head and body, single figure. If the framing is partial (e.g. bust, hands only), describe it explicitly (e.g. "figure from waist up", "hands only holding document") so the model does not produce cut-off or floating bodies by mistake.
- Keep every element in the scene grounded in the narrative and theme: no floating objects or random elements that do not belong to the story. For real history, true crime, or documentary tone: no fantasy, no magic, no superhero poses or powers; keep the scene plausible and anchored to the period and mood. Only add supernatural or stylized flight/magic if the story and genre explicitly call for it.

**Thematic cues (apply when relevant to the story):**
- When the story involves religious holidays or specific dates (e.g. Holy Week, Easter, Holy Thursday), add subtle visual cues in visualDescription: church or cathedral visible, empty or solemn streets, quiet morning light, period-appropriate religious context.
- When the theme is conspiracy, paranoia, or "being watched", consider in visualDescription: implied surveillance, shadows suggesting observation, architecture of power (e.g. tribunals, corridors), hidden documents, feeling of unease.

**Format**: One continuous prompt per scene: "[BASE STYLE ANCHOR], [SCENE DESCRIPTION REPRESENTING THE NARRATION], [COMPOSITION], [LIGHTING + ATMOSPHERE], [MOTION DETAILS]"

Example: "Cinematic 2D illustration, Studio Ghibli art style dark variant, painterly anime aesthetic, ancient temple ruins with vines growing over stone pillars, wide establishing shot from low angle, warm golden hour light filtering through clouds creating a dreamlike atmosphere, dust particles dancing in the light beams"
`.trim()
}
