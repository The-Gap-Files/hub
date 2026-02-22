import type { ProductionContext } from '../../../filmmaker-director.service'

/**
 * Interface genérica para visual style (constantes ou DB).
 * Compatível com VisualStyle de constants/cinematography/visual-styles.ts
 * e com o campo output.visualStyle do Prisma.
 */
export interface VisualStyleLike {
  baseStyle?: string
  lightingTags?: string
  atmosphereTags?: string
  compositionTags?: string
  colorPalette?: string
  qualityTags?: string
  tags?: string
}

/**
 * Monta array de tags de estilo visual a partir de um VisualStyle-like.
 * Usado pelo Cineasta (ProductionContext.styleAnchorTags) e pela
 * geração de imagens (style anchor prefix).
 */
export function buildStyleAnchorParts(vs: VisualStyleLike | null | undefined): string[] {
  const parts: string[] = []
  if (!vs) return parts
  if (vs.baseStyle) parts.push(vs.baseStyle)
  if (vs.lightingTags) parts.push(vs.lightingTags)
  if (vs.atmosphereTags) parts.push(vs.atmosphereTags)
  if (vs.compositionTags) parts.push(vs.compositionTags)
  if (vs.colorPalette) parts.push(vs.colorPalette)
  if (vs.qualityTags) parts.push(vs.qualityTags)
  if (vs.tags) parts.push(vs.tags)
  return parts
}

/**
 * Monta ProductionContext completo para o Filmmaker Director.
 * Centraliza a lógica que estava duplicada em 3 lugares.
 */
export function buildProductionContext(opts: {
  visualStyle?: VisualStyleLike | null
  visualIdentity?: string | null
  storyOutline?: any
  customSceneReferences?: Array<{ sceneOrder: number; description: string; mimeType: string; imagePrompt?: string | null }>
  theme?: string | null
}): ProductionContext {
  const anchorParts = buildStyleAnchorParts(opts.visualStyle)
  return {
    styleAnchorTags: anchorParts.length > 0 ? anchorParts.join(', ') : undefined,
    visualIdentity: opts.visualIdentity || undefined,
    storyOutline: opts.storyOutline,
    customSceneReferences: opts.customSceneReferences,
    theme: opts.theme || undefined,
  }
}
