/**
 * Visual Styles - Constantes de estilos visuais
 *
 * Migrado de DB para constantes seguindo o padrão de caption-styles.ts.
 * Estilos visuais raramente mudam e não precisam de CRUD dinâmico.
 *
 * Campos de prompt (todos injetados no pipeline de geração de imagem):
 *   baseStyle        → Identidade central do estilo (prefixo obrigatório)
 *   lightingTags     → Fontes de luz, temperatura, contraste
 *   atmosphereTags   → Tom emocional, mood, sensação
 *   compositionTags  → Enquadramento, lente, DOF, ângulo
 *   colorPalette     → Paleta de cores dominante (explícita)
 *   qualityTags      → Textura, resolução, acabamento técnico
 *   tags             → Tags descritivas gerais (materiais, superfícies, referências)
 *   negativeTags     → Exclusões (enviadas como negative_prompt aos modelos)
 */

export type VisualStyleId = 'epictok' | 'noir-cinematic' | 'noir-classic' | 'dark-reveal' | 'ghibli-dark' | 'gta6' | 'cyberpunk' | 'oil-painting' | 'photorealistic'

export interface VisualStyle {
  id: VisualStyleId
  name: string
  description: string
  baseStyle: string
  lightingTags: string
  atmosphereTags: string
  compositionTags: string
  /** Paleta de cores dominante — cores explícitas que definem a identidade cromática do estilo */
  colorPalette: string
  /** Tags de qualidade e textura — resolução, acabamento, grão, detalhamento técnico */
  qualityTags: string
  tags: string
  /** Tags de exclusão — enviadas como negative_prompt para modelos que suportam */
  negativeTags: string
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
  colorPalette: 'earthy palette, desaturated tones, sepia undertones, muted warm browns, dusty greens, amber sky gradients',
  qualityTags: 'matte painting finish, textured paper effect, high detail backgrounds, low detail faces, hand-painted quality',
  tags: 'flat cell shading, inked outlines, vintage poster aesthetic, ligne claire style, fantasy adventure concept art, classic RPG illustration',
  negativeTags: 'photorealistic, 3D render, photograph, modern, neon colors, sharp digital edges',
  order: 1,
  isActive: true
}

/** Noir Cinematográfico (V4): estilo assinatura The Gap Files. Realismo cinematográfico dark — 35mm film stock, chiaroscuro pesado, materialidade tátil. */
export const NOIR_CINEMATIC_STYLE: VisualStyle = {
  id: 'noir-cinematic',
  name: 'Noir Cinematográfico',
  description: 'Estética noir cinematográfica realista, com iluminação contrastada, ambientes urbanos densos e atmosfera investigativa. Foco em luz prática, textura física e composição de cinema clássico.',
  baseStyle: 'Cinematic noir realism, high contrast lighting, grounded 35mm film look, period-accurate urban environments, practical light sources, subtle film grain',
  lightingTags: 'dramatic chiaroscuro, single practical light source, sodium vapor streetlights, harsh tungsten bulb lighting, cold ambient blue tones, low-key lighting, volumetric haze with retained detail',
  atmosphereTags: 'somber, investigative tension, oppressive silence, moral ambiguity, restrained intensity, historical weight',
  compositionTags: 'cinematic wide establishing shots, low angle for unease, strong foreground-midground-background separation, controlled shallow depth of field, 16:9 cinematic framing, silhouettes emerging from shadow',
  colorPalette: 'dark desaturated palette, cold steel blue tones, warm tungsten amber accents, deep blacks, muted earth tones, occasional blood-red accent',
  qualityTags: 'ultra-realistic textures, physically accurate material detail, organic film grain, high dynamic range within dark exposure, tactile surface quality, cinematic depth',
  tags: 'wet asphalt reflections, textured brick walls, damp concrete surfaces, rusted metal, weathered wood, cigarette smoke wisps, rain-slicked cobblestone',
  negativeTags: 'fantasy, anime, cartoon, comic book, bright colors, saturated, clean, sterile, digital look, smooth surfaces, HDR overprocessed',
  order: 2,
  isActive: true
}


/** Noir Clássico: ilustração noir pura inspirada em Sin City, Batman Dark Deco e graphic novels sombrias. Preto absoluto, ink wash, acentos seletivos de cor. */
export const NOIR_CLASSIC_STYLE: VisualStyle = {
  id: 'noir-classic',
  name: 'Noir Clássico',
  description: 'Ilustração noir pura: ink wash painting, alto contraste preto e branco com acentos seletivos de cor. Inspirado em Sin City, Batman Dark Deco e graphic novels sombrias.',
  baseStyle: 'Dark noir graphic novel illustration, ink wash painting style, heavy black shadows, stark high-contrast chiaroscuro, stylized and painterly, not photorealistic',
  lightingTags: 'extreme chiaroscuro, single harsh directional light, venetian blind shadow patterns, cold moonlight blue accents, light cutting through absolute darkness, silhouette-heavy composition',
  atmosphereTags: 'somber, ominous, foreboding, investigative noir, oppressive silence, tension, morally ambiguous, fatalistic',
  compositionTags: 'dramatic angles, dutch tilt, low angle for unease, graphic novel panel composition, bold negative space, cinematic framing, figures emerging from shadow',
  colorPalette: 'stark black and white with selective color accent, deep blacks, cold moonlight blue, occasional crimson red, desaturated palette',
  qualityTags: 'ink wash texture, visible brushstrokes, cross-hatching details, hand-drawn quality, graphic novel art finish, painterly noir rendering',
  tags: 'Sin City aesthetic, Dark Deco style, illustrated, heavy ink, dramatic silhouettes, noir archetypes',
  negativeTags: 'photorealism, photograph, camera grain, DSLR look, 3D render, bright colors, clean digital, smooth gradients',
  order: 3,
  isActive: true
}

/** Dark Reveal: concept art de revelação — documento/objeto no foco de luz, fundo urbano ou distópico, silhuetas, acentos quentes (dourado/vermelho). Tom de "verdade oculta", investigação, passado vs presente. Não é ink wash nem graphic novel. */
export const DARK_REVEAL_STYLE: VisualStyle = {
  id: 'dark-reveal',
  name: 'Dark Reveal',
  description: 'Concept art dramático de revelação: objeto ou documento iluminado por um foco de luz, fundo escuro (urbano ou distópico), silhuetas, acentos quentes dourados ou vermelhos. Tom de verdade oculta e investigação.',
  baseStyle: 'Dramatic digital concept art, revelation and discovery aesthetic, single focal point in spotlight, dark environment, painterly with visible brushstrokes, not ink wash, not graphic novel',
  lightingTags: 'single powerful spotlight or beam from above, warm golden or amber light on central subject, deep shadows, visible light rays or dust, cold blue-teal in shadows, optional red or orange glow accent',
  atmosphereTags: 'solemn significance, uncovering hidden truth, investigative, mysterious, ominous, historical weight, past meeting present',
  compositionTags: 'centered focal subject (scroll, document, monolith, figure), dramatic wide or medium shot, dark silhouetted background, urban or abstract blocky cityscape in shadow, figures as silhouettes when present',
  colorPalette: 'warm gold and amber on focal subject, desaturated cool blue-teal background, deep shadows, occasional blood-orange glow, parchment brown',
  qualityTags: 'concept art finish, painterly texture, visible brushstrokes, high contrast focal point, atmospheric dust particles, cinematic depth',
  tags: 'dark fantasy illustrative, revelation and discovery mood, document or artifact as hero, ancient textures, hidden knowledge aesthetic',
  negativeTags: 'photograph, anime, Sin City style, ink wash, bright flat lighting, clean digital, cartoon, comic book',
  order: 4,
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
  colorPalette: 'desaturated greens and grays, earthy muted tones, cold slate blue, deep forest shadows, overcast sky whites',
  qualityTags: 'high detail backgrounds, subtle grain, textured paper effect, painterly anime finish, rich environmental detail',
  tags: 'flat cell shading, inked outlines, Ghibli-style backgrounds but dark palette, high contrast lighting',
  negativeTags: 'dreamlike, nostalgic, golden hour, bright colors, cheerful, 3D render, photorealistic, clean digital',
  order: 5,
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
  colorPalette: 'saturated tropical colors, hot pink, electric cyan, sunset orange, ocean turquoise, palm green',
  qualityTags: 'photorealistic rendering, AAA game quality, sharp detail, glossy surfaces, high dynamic range',
  tags: 'neon lights, urban, tropical, palm trees swaying, ocean view, luxury cars gleaming, modern architecture',
  negativeTags: 'desaturated, dark, gloomy, noir, vintage, grainy, muted colors, horror',
  order: 6,
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
  colorPalette: 'electric neon blue, magenta pink, toxic green, deep black, chrome silver, rain-reflected spectrum',
  qualityTags: 'hyper-detailed environment, cinematic depth, volumetric lighting, reflective wet surfaces, atmospheric haze',
  tags: 'futuristic, advanced technology, dark atmosphere, sci-fi, holographic displays, flying cars passing by, megacity',
  negativeTags: 'natural, rural, sunny, warm, vintage, historical, bright daylight, clean environment',
  order: 7,
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
  colorPalette: 'rich burnt sienna, deep ochre, warm ivory, dark umber, cadmium red, raw umber shadows',
  qualityTags: 'visible brush strokes, canvas texture, impasto technique, museum quality finish, layered oil glazes',
  tags: 'impressionist touches, artistic, painterly, traditional art, old master technique',
  negativeTags: 'digital art, photograph, 3D render, flat colors, clean lines, modern, neon, pixel art',
  order: 8,
  isActive: true
}

export const PHOTOREALISTIC_STYLE: VisualStyle = {
  id: 'photorealistic',
  name: 'Fotorrealista',
  description: 'Estilo fotorrealista como fotografia de cinema em alta resolução.',
  baseStyle: 'Cinematic photorealistic, ARRI Alexa 65mm, professional cinema camera',
  lightingTags: 'natural realistic lighting, soft bokeh in background, subtle film grain, depth of field',
  atmosphereTags: 'authentic, immersive, documentary realism, cinematic presence',
  compositionTags: 'shallow depth of field, cinematic aspect ratio, professional framing',
  colorPalette: 'natural color grading, warm skin tones, neutral whites, controlled saturation, cinema-grade color science',
  qualityTags: 'ultra detailed, 8K resolution, professional camera work, razor-sharp focus on subject, organic film grain, physically based rendering',
  tags: 'realistic lighting, ARRI color science, anamorphic lens characteristics, practical on-set lighting',
  negativeTags: 'painting, illustration, cartoon, anime, sketch, watercolor, abstract, flat lighting, oversaturated',
  order: 9,
  isActive: true
}

// ─── Registry ────────────────────────────────────────────────────

export const VISUAL_STYLES: Record<VisualStyleId, VisualStyle> = {
  epictok: EPICTOK_STYLE,
  'noir-cinematic': NOIR_CINEMATIC_STYLE,
  'noir-classic': NOIR_CLASSIC_STYLE,
  'dark-reveal': DARK_REVEAL_STYLE,
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
