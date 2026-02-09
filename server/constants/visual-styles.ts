/**
 * Visual Styles - Constantes de estilos visuais
 * 
 * Migrado de DB para constantes seguindo o padrão de caption-styles.ts.
 * Estilos visuais raramente mudam e não precisam de CRUD dinâmico.
 */

export type VisualStyleId = 'epictok' | 'ghibli-dark' | 'gta6' | 'cyberpunk' | 'oil-painting' | 'photorealistic'

export interface VisualStyle {
  id: VisualStyleId
  name: string
  description: string
  baseStyle: string
  lightingTags: string
  atmosphereTags: string
  compositionTags: string
  tags: string
  order: number
  isActive: boolean
}

export const EPICTOK_STYLE: VisualStyle = {
  id: 'epictok',
  name: 'Epictok Imersivo',
  description: 'Estilo de ilustração 2D vintage, tipo Studio Ghibli e Eyvind Earle.',
  baseStyle: 'Cinematic 2D illustration, Studio Ghibli background art style, Eyvind Earle inspired',
  lightingTags: 'warm golden hour light, soft volumetric rays filtering through clouds, dramatic backlighting, muted warm tones',
  atmosphereTags: 'dreamlike, nostalgic, epic adventure, serene yet mysterious',
  compositionTags: 'wide establishing shot, low angle emphasizing vastness, textured paper effect',
  tags: 'flat cell shading, inked outlines, vintage poster aesthetic, ligne claire style, fantasy adventure concept art, classic RPG illustration, matte painting, low detail faces, high contrast lighting, earthy palette, desaturated tones, sepia undertones',
  order: 1,
  isActive: true
}

/** Estilo Ghibli em tom sombrio: ilustração 2D à la Studio Ghibli mas com atmosfera de suspense, leve horror e noir. Genérico para true crime, mistério, investigação. */
export const GHIBLI_DARK_STYLE: VisualStyle = {
  id: 'ghibli-dark',
  name: 'Ghibli Sombrio',
  description: 'Estilo Studio Ghibli em versão dark: ilustração 2D rica, mas com atmosfera de suspense, leve horror e noir. Ideal para true crime, mistério e investigação.',
  baseStyle: 'Cinematic 2D illustration, Studio Ghibli art style dark variant, painterly anime aesthetic, moody and atmospheric',
  lightingTags: 'dramatic chiaroscuro, soft shadows creeping, single light source or candlelight, muted cold tones, no golden hour',
  atmosphereTags: 'suspenseful, subtle horror, noir mood, tense, mysterious, foreboding, solemn',
  compositionTags: 'wide establishing shot when revealing tension, low angle for unease, textured paper effect, shallow depth',
  tags: 'flat cell shading, inked outlines, Ghibli-style backgrounds but dark palette, desaturated greens and grays, no dreamlike or nostalgic, high contrast lighting, earthy muted tones, subtle grain',
  order: 2,
  isActive: true
}

export const GTA6_STYLE: VisualStyle = {
  id: 'gta6',
  name: 'GTA 6 Vibes',
  description: 'Estilo vibrante com cores saturadas e iluminação de Miami.',
  baseStyle: 'Cinematic photorealistic, modern AAA game aesthetic, GTA VI style',
  lightingTags: 'vibrant Miami sunset, neon lights reflecting on wet surfaces, warm tropical golden hour',
  atmosphereTags: 'energetic, luxurious, urban tropical paradise, high-octane',
  compositionTags: 'dynamic camera movement, establishing wide shots of cityscape, low angle hero shots',
  tags: 'saturated colors, photorealistic, neon lights, urban, tropical, palm trees swaying, ocean view, luxury cars gleaming, modern architecture',
  order: 3,
  isActive: true
}

export const CYBERPUNK_STYLE: VisualStyle = {
  id: 'cyberpunk',
  name: 'Cyberpunk Neon',
  description: 'Estilo futurista com neon, chuva e tecnologia avançada.',
  baseStyle: 'Cinematic cyberpunk, Blade Runner inspired, dark sci-fi',
  lightingTags: 'neon lights cutting through rain, volumetric fog with colorful reflections, dramatic chiaroscuro',
  atmosphereTags: 'dystopian, mysterious, tech-noir, rain-soaked melancholy',
  compositionTags: 'low angle looking up at megastructures, rain droplets on camera lens, holographic displays floating',
  tags: 'futuristic, advanced technology, dark atmosphere, sci-fi, holographic displays, flying cars passing by, megacity',
  order: 4,
  isActive: true
}

export const OIL_PAINTING_STYLE: VisualStyle = {
  id: 'oil-painting',
  name: 'Pintura a Óleo',
  description: 'Estilo de pintura a óleo clássica com pinceladas visíveis.',
  baseStyle: 'Classic oil painting, renaissance and baroque style, museum quality',
  lightingTags: 'soft natural window light, chiaroscuro dramatic shadows, warm candlelight glow',
  atmosphereTags: 'timeless, contemplative, classical elegance, artistic reverence',
  compositionTags: 'traditional portrait framing, close-up with shallow depth, painterly brush strokes visible',
  tags: 'visible brush strokes, canvas texture, impressionist touches, artistic, painterly, traditional art',
  order: 5,
  isActive: true
}

export const PHOTOREALISTIC_STYLE: VisualStyle = {
  id: 'photorealistic',
  name: 'Fotorrealista',
  description: 'Estilo fotorrealista como fotografia de cinema em alta resolução.',
  baseStyle: 'Cinematic photorealistic, ARRI Alexa 65mm, professional cinema camera',
  lightingTags: 'natural realistic lighting, soft bokeh in background, film grain texture, depth of field',
  atmosphereTags: 'authentic, immersive, documentary realism, cinematic presence',
  compositionTags: 'shallow depth of field, cinematic aspect ratio, professional framing',
  tags: 'ultra detailed, realistic lighting, 4K, 8K, DSLR quality, professional camera work',
  order: 6,
  isActive: true
}

// ─── Registry ────────────────────────────────────────────────────

export const VISUAL_STYLES: Record<VisualStyleId, VisualStyle> = {
  epictok: EPICTOK_STYLE,
  'ghibli-dark': GHIBLI_DARK_STYLE,
  gta6: GTA6_STYLE,
  cyberpunk: CYBERPUNK_STYLE,
  'oil-painting': OIL_PAINTING_STYLE,
  photorealistic: PHOTOREALISTIC_STYLE
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Retorna todos os estilos como array ordenado (para API e UI) */
export function getVisualStylesList(): VisualStyle[] {
  return Object.values(VISUAL_STYLES)
    .filter(s => s.isActive)
    .sort((a, b) => a.order - b.order)
}

/** Busca estilo por ID (retorna undefined se não encontrar) */
export function getVisualStyleById(id: string): VisualStyle | undefined {
  return VISUAL_STYLES[id as VisualStyleId]
}

/** Retorna todos os IDs válidos */
export function getVisualStyleIds(): VisualStyleId[] {
  return Object.keys(VISUAL_STYLES) as VisualStyleId[]
}
