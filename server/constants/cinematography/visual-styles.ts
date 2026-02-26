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
 *
 * Campos de hints por agente (instruções específicas para adaptar o agente ao estilo):
 *   photographerHints  → Como o Fotógrafo deve descrever cenas neste estilo
 *   screenwriterHints  → Como o Roteirista deve estruturar cenas neste estilo
 */

export type VisualStyleId = 'epictok' | 'noir-cinematic' | 'noir-classic' | 'dark-reveal' | 'graphic-novel-noir' | 'ghibli-dark' | 'gta6' | 'cyberpunk' | 'oil-painting' | 'photorealistic'

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
  /** Instruções para o Photographer adaptar sua abordagem a este estilo (lente, composição, nível de detalhe) */
  photographerHints: string
  /** Instruções para o Screenwriter adaptar visualDescriptions e estrutura de cena a este estilo */
  screenwriterHints: string
  order: number
  isActive: boolean
}

export const EPICTOK_STYLE: VisualStyle = {
  id: 'epictok',
  name: 'Epictok Imersivo',
  description: 'Estilo de ilustração 2D vintage, tipo Studio Ghibli e Eyvind Earle.',
  baseStyle: 'Cinematic 2D illustration, hand-painted anime background art, Eyvind Earle inspired',
  lightingTags: 'warm golden hour light, soft volumetric rays filtering through clouds, dramatic backlighting, muted warm tones',
  atmosphereTags: 'dreamlike, nostalgic, epic adventure, serene yet mysterious',
  compositionTags: 'wide establishing shot, low angle emphasizing vastness, soft edges and painted gradients',
  colorPalette: 'earthy palette on environments, sepia undertones on midground, muted warm browns and dusty greens on backgrounds, amber sky gradients as framing light',
  qualityTags: 'matte painting finish, textured paper effect, high detail backgrounds, low detail faces, hand-painted quality',
  tags: 'flat cell shading, inked outlines, vintage poster aesthetic, ligne claire style, fantasy adventure concept art, classic RPG illustration',
  negativeTags: 'photorealistic, photograph, 3D render, modern, neon colors, sharp digital edges, vector art',
  photographerHints: 'ILLUSTRATION style — do NOT specify camera lens, f-stop, or film stock. Describe composition in painterly terms: foreground layers, color planes, silhouette shapes. Use "wide view" instead of "24mm lens". Lighting should reference natural/practical sources (golden hour, lanterns, campfire) but described as painted light, not photographic. Favor flat cell-shaded figures with low facial detail. Backgrounds should be richly detailed, figures simpler.',
  screenwriterHints: 'Scenes work best with strong single focal subjects against rich painted backgrounds. Favor wide establishing compositions and symbolic objects. Complex multi-character interactions lose clarity in this style — prefer atmospheric storytelling. visualDescriptions should emphasize layered environments (foreground/midground/background as color planes) over photographic detail.',
  order: 1,
  isActive: true
}

/** Noir Cinematográfico (V4): estilo assinatura The Gap Files. Realismo cinematográfico dark — 35mm film stock, chiaroscuro pesado, materialidade tátil. */
export const NOIR_CINEMATIC_STYLE: VisualStyle = {
  id: 'noir-cinematic',
  name: 'Noir Cinematográfico',
  description: 'Estética noir cinematográfica realista, com iluminação contrastada, ambientes urbanos densos e atmosfera investigativa. Foco em luz prática, textura física e composição de cinema clássico.',
  baseStyle: 'Cinematic noir realism, high contrast chiaroscuro, grounded 35mm film look, subtle film grain',
  lightingTags: 'dramatic chiaroscuro, single practical light source, sodium vapor streetlights, harsh tungsten bulb lighting, cold ambient blue tones, low-key lighting, volumetric haze with retained detail',
  atmosphereTags: 'somber, investigative tension, oppressive silence, moral ambiguity, restrained intensity, historical weight',
  compositionTags: 'cinematic wide establishing shots, low angle for unease, strong foreground-midground-background separation, controlled shallow depth of field, 16:9 cinematic framing, silhouettes emerging from shadow',
  colorPalette: 'cold steel blue on shadows and backgrounds, warm tungsten amber on practical light sources, deep blacks as negative space, muted earth tones on surfaces, occasional blood-red as dramatic accent',
  qualityTags: 'ultra-realistic textures, physically accurate material detail, organic film grain, high dynamic range within dark exposure, tactile surface quality, cinematic depth, period-accurate environments, practical light sources',
  tags: 'wet asphalt reflections, textured brick walls, damp concrete surfaces, rusted metal, weathered wood, cigarette smoke wisps, rain-slicked cobblestone',
  negativeTags: 'illustration, anime, cartoon, comic book, bright colors, saturated, clean, sterile, digital look, smooth surfaces, HDR overprocessed, watercolor, painterly',
  photographerHints: 'Full cinematic photography protocol — this is the REFERENCE style. Specify lens (focal length: 24mm, 35mm, 50mm, 85mm), aperture/DOF (shallow or deep focus), film stock (Tri-X, Portra 400, Ektachrome). Describe practical light sources physically (sodium vapor streetlights, single tungsten bulb, fluorescent tube). Textural detail is critical: wet asphalt, scratched wood, rusted metal, damp concrete. Faces can be detailed but favor chiaroscuro that partially hides features. Every element must be period-accurate if temporal context is given.',
  screenwriterHints: 'Can handle complex multi-element scenes with rich environmental detail. Favor noir visual language: silhouettes, shadows, reflections, smoke. visualDescriptions should include foreground/midground/background separation with strong depth. Documentary-style pacing works well. Detail-rich scene descriptions translate directly to visual quality. Alternate between tight close-ups (evidence, objects) and wide establishing shots (crime scenes, urban landscapes).',
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
  colorPalette: 'stark black and white as base, deep blacks as dominant negative space, cold moonlight blue on ambient shadows, selective crimson red on single focal accent per scene, desaturated everything else',
  qualityTags: 'ink wash texture, visible brushstrokes, cross-hatching details, hand-drawn quality, graphic novel art finish, painterly noir rendering',
  tags: 'Sin City aesthetic, Dark Deco style, illustrated, heavy ink, dramatic silhouettes, noir archetypes',
  negativeTags: 'photorealistic, photograph, DSLR look, 3D render, bright colors, clean digital, smooth gradients, watercolor, cute, anime',
  photographerHints: 'ILLUSTRATION style — ink wash painting, NOT photography. Do NOT specify camera lens, f-stop, or film stock. Describe compositions in graphic terms: heavy black shapes, stark negative space, venetian blind shadows, ink splatter textures. Light is extreme chiaroscuro — figures emerge from absolute darkness. Faces should be stylized with minimal detail (shadow-hidden, angular jaw lines, no photo-portrait features). Use "dramatic angle" instead of "35mm low angle". Reference Sin City and Batman Dark Deco visual language.',
  screenwriterHints: 'Scenes should be designed as graphic novel PANELS — bold, iconic, high-contrast. Single focal subject per scene works best. Favor silhouettes, stark negative space, and dramatic poses over environmental complexity. Complex backgrounds lose impact in this style — use simple, dark environments with one strong light source. visualDescriptions should read like panel descriptions: "A lone figure in trenchcoat, half-swallowed by ink-black shadow, only the glint of a badge visible."',
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
  colorPalette: 'warm gold and amber concentrated on focal subject, desaturated cool blue-teal on background and shadows, deep blacks as frame, occasional blood-orange glow on edges, parchment brown on artifacts',
  qualityTags: 'concept art finish, painterly texture, visible brushstrokes, high contrast focal point, atmospheric dust particles, cinematic depth',
  tags: 'dark fantasy illustrative, revelation and discovery mood, document or artifact as hero, ancient textures, hidden knowledge aesthetic, evidence table, sealed envelope wax, dust motes in light beam',
  negativeTags: 'photorealistic, photograph, anime, ink wash, bright flat lighting, clean digital, cartoon, comic book, 3D render',
  photographerHints: 'CONCEPT ART style — painterly, NOT photography. Do NOT specify camera lens or film stock. Focus on a single HERO OBJECT or ARTIFACT in spotlight (document, scroll, monolith, sealed envelope). Background should be dark, silhouetted (urban blocky shapes, abstract cityscape). Describe light as a powerful beam or spotlight from above hitting the central subject. Use warm gold/amber on focal point, cold blue-teal in shadows. Dust particles and atmospheric haze add depth. Figures, when present, should be dark silhouettes.',
  screenwriterHints: 'Every scene should have a clear REVELATION focal point — one object, document, or artifact that draws the eye. Structure scenes around the "discovery" moment: what is being revealed? Environments serve as dark frames around the central subject. Favor medium and wide shots that show the relationship between the revealed object and its dark surroundings. This style excels at evidence, clues, documents, artifacts — lean into investigative visual language.',
  order: 4,
  isActive: true
}

/** Graphic Novel Noir: digital painting estilizada com estética de graphic novel sombria. Formas gráficas fortes, chiaroscuro exagerado, detalhes faciais mínimos para evitar realismo. Ideal para crime, cartel, thriller. Safe para YouTube (sem rostos realistas). */
export const GRAPHIC_NOVEL_NOIR_STYLE: VisualStyle = {
  id: 'graphic-novel-noir',
  name: 'Graphic Novel Noir',
  description: 'Digital painting estilizada com estética de graphic novel sombria. Formas gráficas fortes, chiaroscuro exagerado, detalhes faciais mínimos. Safe para YouTube por evitar rostos realistas.',
  baseStyle: 'Stylized digital painting, graphic novel aesthetic, semi-realistic proportions, textured brush strokes, noir cinema inspired, not photorealistic',
  lightingTags: 'cinematic lighting with dramatic rim light, exaggerated shadows, harsh directional light slicing across silhouettes, chiaroscuro inspired by noir cinema, strong backlight tracing contours',
  atmosphereTags: 'dramatic, mysterious, tense, smoky atmosphere, ominous, morally ambiguous, foreboding, underworld gravity',
  compositionTags: 'poster-style composition, slight low-angle perspective for dominance, bold graphic shapes, strong silhouette framing, minimal facial detail, figures as powerful shapes rather than portraits',
  colorPalette: 'cold teal on shadows and backgrounds, warm crimson accents on focal elements and danger, charcoal blacks as dominant negative space, muted gold highlights on rim light and edges, deep desaturated tones overall',
  qualityTags: 'digital painting finish, visible textured brush strokes, high contrast rendering, graphic novel art quality, bold shapes over fine detail, painterly depth',
  tags: 'graphic novel aesthetic, bold contrasts, stylized figures, minimal facial features, smoky haze, dramatic silhouettes, crime underworld visual language, noir archetypes',
  negativeTags: 'photorealistic faces, photograph, 3D render, anime, bright colors, flat lighting, clean digital, smooth gradients, cartoon, cute',
  photographerHints: 'ILLUSTRATION style — stylized digital painting, NOT photography. Do NOT specify camera lens, f-stop, or film stock. Describe compositions as poster-worthy frames: bold graphic shapes, strong silhouettes, dramatic rim light tracing contours. Faces MUST have minimal detail — partially hidden in darkness, stylized angular features, never photo-portrait quality. Figures should be powerful SHAPES rather than detailed portraits. Describe smoky atmosphere, haze, and volumetric light as painted elements. Use "low angle for dominance" not "24mm low angle". Favor single dominant figure or symbolic object per scene.',
  screenwriterHints: 'Scenes should be designed as POSTER FRAMES — each one could be a thumbnail or movie poster. Single dominant subject works best (one figure, one object, one symbolic element). Complex multi-character interactions lose impact — prefer iconic poses and symbolic staging. Environments should be atmospheric backdrops (smoky rooms, rain-slicked alleys) not detailed locations. visualDescriptions should convey POWER and MOOD over detail. This style renders faces poorly — favor partial views, silhouettes, back-of-head shots, or figures in shadow.',
  order: 5,
  isActive: true
}

/** Estilo Ghibli em tom sombrio: ilustração 2D à la Studio Ghibli mas com atmosfera de suspense, leve horror e noir. Genérico para true crime, mistério, investigação. */
export const GHIBLI_DARK_STYLE: VisualStyle = {
  id: 'ghibli-dark',
  name: 'Ghibli Sombrio',
  description: 'Estilo Studio Ghibli em versão dark: ilustração 2D rica, mas com atmosfera de suspense, leve horror e noir. Ideal para true crime, mistério e investigação.',
  baseStyle: 'Cinematic 2D illustration, Japanese animated film art dark variant, painterly anime aesthetic, moody and atmospheric',
  lightingTags: 'dramatic chiaroscuro, soft shadows creeping, single light source or candlelight, muted cold tones, no golden hour',
  atmosphereTags: 'suspenseful, subtle horror, noir mood, tense, mysterious, foreboding, solemn',
  compositionTags: 'wide establishing shot when revealing tension, low angle for unease, textured paper effect, shallow depth',
  colorPalette: 'desaturated greens on vegetation, cold slate blue on shadows and sky, earthy muted tones on structures, deep forest blacks as framing, overcast whites as ambient ceiling',
  qualityTags: 'high detail backgrounds, subtle grain, textured paper effect, painterly anime finish, rich environmental detail',
  tags: 'flat cell shading, inked outlines, hand-painted backgrounds with dark palette, high contrast lighting, overgrown nature details',
  negativeTags: 'dreamlike, nostalgic, golden hour, bright colors, cheerful, cute, whimsical, 3D render, photorealistic, photograph, clean digital',
  photographerHints: 'ILLUSTRATION style — Ghibli-inspired 2D art, NOT photography. Do NOT specify camera lens, f-stop, or film stock. Describe compositions with painterly depth: layered backgrounds with rich environmental detail (forest textures, weathered walls, overgrown paths), simpler foreground figures with flat cell-shading. Lighting should be atmospheric and mood-driven: creeping shadows, candlelight, overcast diffused light — never golden hour in this dark variant. Use "wide view showing the decaying garden" not "24mm establishing shot". Faces should be simple anime-style (minimal features, expressive through posture not facial detail).',
  screenwriterHints: 'Scenes shine when the ENVIRONMENT tells the story — rich, detailed backgrounds with atmospheric mood. Favor wide establishing shots that reveal locations (abandoned houses, foggy forests, rain-soaked villages). Characters should be small within vast environments to convey isolation and unease. This style excels at nature-meets-darkness: overgrown crime scenes, foggy lakesides, abandoned structures reclaimed by vegetation. Keep human figures simple and let the painted world carry the emotion.',
  order: 6,
  isActive: true
}

export const GTA6_STYLE: VisualStyle = {
  id: 'gta6',
  name: 'GTA 6 Vibes',
  description: 'Estilo vibrante com cores saturadas e iluminação de Miami.',
  baseStyle: 'Cinematic photorealistic, AAA open-world crime cinematic aesthetic, tropical neon urban realism',
  lightingTags: 'vibrant Miami sunset, neon lights reflecting on wet surfaces, warm tropical golden hour',
  atmosphereTags: 'energetic, luxurious, urban tropical paradise, high-octane',
  compositionTags: 'dynamic camera movement, establishing wide shots of cityscape, low angle hero shots',
  colorPalette: 'hot pink and electric cyan on neon signage, sunset orange on sky and reflections, ocean turquoise on water surfaces, palm green on vegetation, glossy blacks on vehicles and glass',
  qualityTags: 'photorealistic rendering, AAA game quality, sharp detail, glossy surfaces, high dynamic range',
  tags: 'neon lights, urban, tropical, palm trees swaying, ocean view, luxury cars gleaming, modern architecture, GTA-like cinematic vibe',
  negativeTags: 'illustration, painting, anime, cartoon, desaturated, dark, gloomy, noir, vintage, grainy, muted colors, horror, watercolor',
  photographerHints: 'PHOTOREALISTIC style — AAA game cinematics. Specify lens and DOF when useful. Lighting should be vibrant and tropical: neon reflections on wet surfaces, Miami sunset warmth, electric signage. Textures should be glossy and modern: chrome, glass, polished concrete, luxury interiors. Colors are SATURATED — embrace hot pink, electric cyan, sunset orange. Environments should feel expensive and urban: modern architecture, palm-lined boulevards, ocean views. Faces can be detailed but stylized toward game-aesthetic (clean skin, strong features).',
  screenwriterHints: 'Scenes should feel CINEMATIC and ENERGETIC — dynamic compositions, strong colors, modern environments. Favor wide establishing shots of cityscapes, luxury interiors, and tropical urban settings. Action-oriented pacing works well. visualDescriptions should emphasize glossy surfaces, neon reflections, and saturated color contrasts. This style handles complex environments with multiple elements well. Multi-character scenes work if figures are well-separated in the frame.',
  order: 7,
  isActive: true
}

export const CYBERPUNK_STYLE: VisualStyle = {
  id: 'cyberpunk',
  name: 'Cyberpunk Neon',
  description: 'Estilo futurista com neon, chuva e tecnologia avançada.',
  baseStyle: 'Cinematic cyberpunk, dark sci-fi noir, dystopian megacity aesthetic',
  lightingTags: 'neon lights cutting through rain, volumetric fog with colorful reflections, dramatic chiaroscuro',
  atmosphereTags: 'dystopian, mysterious, tech-noir, rain-soaked melancholy',
  compositionTags: 'low angle looking up at megastructures, rain droplets on camera lens, holographic displays floating',
  colorPalette: 'electric neon blue on signage and UI overlays, magenta pink on reflections, toxic green on hazard elements, deep black as dominant negative space, chrome silver on wet surfaces',
  qualityTags: 'hyper-detailed environment, cinematic depth, volumetric lighting, reflective wet surfaces, atmospheric haze',
  tags: 'futuristic, advanced technology, dark atmosphere, sci-fi, holographic displays, flying cars passing by, megacity, Blade Runner aesthetic, signage in multiple languages, dense street clutter',
  negativeTags: 'illustration, painting, anime, cartoon, natural, rural, sunny, warm, vintage, historical, bright daylight, clean environment, watercolor',
  photographerHints: 'HYBRID style — photorealistic with sci-fi elements. Use cinematic lens specs (anamorphic, wide angle for megastructures). Lighting is NEON-DOMINANT: describe specific neon colors reflecting on rain-wet surfaces, holographic glows, LED strips. Textures should be wet, reflective, and industrial: rain-slicked chrome, rusted pipes, condensation on glass. Environments are vertical megacities — low angle looking up at towering structures. Atmospheric haze and volumetric fog are essential. Faces can be detailed but often obscured by rain, reflections, or holographic UI overlays.',
  screenwriterHints: 'Scenes should emphasize SCALE and ATMOSPHERE — massive vertical environments, rain, neon reflections. Low-angle compositions looking up at megastructures work best. Favor atmospheric mood over narrative complexity per scene. visualDescriptions should be dense with environmental detail: rain droplets, holographic displays, distant flying vehicles, steam vents. Single-figure scenes work well (lone figure in vast cyberpunk city). This style excels at tech-noir mood: surveillance, digital interfaces, dystopian urban decay.',
  order: 8,
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
  colorPalette: 'burnt sienna and deep ochre on skin and warm surfaces, warm ivory on highlights, dark umber and raw umber in shadows, cadmium red as dramatic accent on focal elements',
  qualityTags: 'visible brush strokes, canvas texture, impasto technique on focal subjects, thin glazes on backgrounds, museum quality finish',
  tags: 'impressionist touches, artistic, painterly, traditional art, old master technique',
  negativeTags: 'photorealistic, photograph, 3D render, flat colors, clean lines, modern, neon, pixel art, anime, cartoon',
  photographerHints: 'FINE ART style — classical oil painting, NOT photography. Do NOT specify camera lens, f-stop, or film stock. Describe compositions using art terminology: impasto technique, glazed layers, chiaroscuro (Caravaggio/Rembrandt style). Lighting should reference classical painting: soft window light, candlelight glow, warm directional sources. Textures are PAINTERLY: visible brush strokes, canvas grain, layered pigment. Colors reference oil pigments: burnt sienna, raw umber, cadmium red, ochre. Portraits work well in this style — faces can be detailed using old master techniques. Favor traditional framing (portrait orientation, centered subjects).',
  screenwriterHints: 'Scenes should be composed as CLASSICAL PAINTINGS — each frame could hang in a museum. Favor portraiture, still life, and intimate interior scenes. Slower, contemplative pacing. visualDescriptions should reference art-historical compositions: Rembrandt lighting, Vermeer interiors, Caravaggio drama. This style excels at timeless, somber subjects: historical figures, period interiors, symbolic still life arrangements. Complex action scenes lose impact — prefer frozen dramatic moments (a hand reaching for a letter, a figure gazing out a window).',
  order: 9,
  isActive: true
}

export const PHOTOREALISTIC_STYLE: VisualStyle = {
  id: 'photorealistic',
  name: 'Fotorrealista',
  description: 'Estilo fotorrealista como fotografia de cinema em alta resolução.',
  baseStyle: 'Cinematic photorealistic, professional cinema camera, in-camera realism',
  lightingTags: 'natural realistic lighting, soft bokeh in background, subtle film grain, depth of field',
  atmosphereTags: 'authentic, immersive, documentary realism, cinematic presence',
  compositionTags: 'shallow depth of field, cinematic aspect ratio, professional framing',
  colorPalette: 'natural color grading throughout, warm skin tones on subjects, neutral whites on ambient surfaces, controlled saturation on environments, cinema-grade color science overall',
  qualityTags: 'ultra detailed, 8K resolution, professional camera work, razor-sharp focus on subject, organic film grain, ARRI Alexa 65mm sensor look, in-camera realism',
  tags: 'realistic lighting, ARRI color science, anamorphic lens characteristics, practical on-set lighting',
  negativeTags: 'painting, illustration, cartoon, anime, sketch, watercolor, abstract, flat lighting, oversaturated, 3D render, CG look',
  photographerHints: 'Full cinematic photography protocol — maximum photographic realism. Specify lens precisely (ARRI Alexa 65mm, anamorphic, specific focal length), aperture, DOF, film stock or digital sensor reference. Lighting must be physically motivated and precisely described: practicals, bounce, fill ratio. Textures must be hyper-detailed and physically accurate: skin pores, fabric weave, metal grain, water droplets. Faces can and SHOULD be detailed with expressive features. This style demands the highest level of photographic specificity — every element must look like it was captured by a professional cinema camera on set.',
  screenwriterHints: 'Maximum environmental and subject detail — this style renders everything with photographic fidelity. Complex multi-element scenes with multiple depth layers work excellently. Favor cinematic compositions: shallow DOF with bokeh, anamorphic lens flares, rack focus between subjects. Documentary-style pacing with rich detail per scene. visualDescriptions should read like a cinematographer\'s shot list: precise, physical, measurable. This style can handle faces, emotions, and nuanced human presence better than any other style.',
  order: 10,
  isActive: true
}

// ─── Registry ────────────────────────────────────────────────────

export const VISUAL_STYLES: Record<VisualStyleId, VisualStyle> = {
  epictok: EPICTOK_STYLE,
  'noir-cinematic': NOIR_CINEMATIC_STYLE,
  'noir-classic': NOIR_CLASSIC_STYLE,
  'dark-reveal': DARK_REVEAL_STYLE,
  'graphic-novel-noir': GRAPHIC_NOVEL_NOIR_STYLE,
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
