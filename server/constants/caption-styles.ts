/**
 * Estilos de legendas para diferentes plataformas
 * 
 * Cada estilo é otimizado para maximizar retenção e engajamento.
 * Os efeitos utilizam recursos avançados do formato ASS (Advanced SubStation Alpha):
 * - \fad(fadeIn,fadeOut)  → fade in/out em milissegundos
 * - \k / \K / \kf        → efeitos karaoke (word-by-word highlight)
 * - \t(\c&HCOLOR&)       → transição de cor animada
 * - \blur                 → efeito blur/glow
 * - \bord                 → espessura da borda
 * - \3c                   → cor da borda (outline)
 * - \4c                   → cor da sombra (back)
 * - \an                   → alinhamento (9 posições)
 * - \pos(x,y)             → posição absoluta
 */

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export type CaptionStyleId =
  | 'tiktok_viral'
  | 'tiktok_pop'
  | 'tiktok_karaoke'
  | 'reels_clean'
  | 'reels_bold'
  | 'reels_glow'
  | 'reels_neon'
  | 'youtube_shorts'
  | 'youtube_long'

export type CaptionEffect =
  | 'none'            // Texto estático
  | 'fade'            // Fade in/out suave
  | 'word_highlight'  // Palavra atual muda de cor
  | 'karaoke_fill'    // Preenchimento progressivo (karaoke)
  | 'karaoke_glow'    // Karaoke com brilho
  | 'pop_in'          // Texto surge com scale
  | 'glow_pulse'      // Brilho pulsante
  | 'neon_flicker'    // Efeito neon com flicker

export interface CaptionStyle {
  id: CaptionStyleId
  name: string
  description: string
  platform: string
  recommendedFor: string[]   // Aspect ratios recomendados

  // Tipografia
  fontName: string
  fontSize: number
  primaryColor: string       // Cor principal do texto (hex)
  secondaryColor: string     // Cor secundária / highlight (hex)
  outlineColor: string       // Cor do contorno (hex)
  backgroundColor: string    // Cor de fundo com alpha (hex 8 chars)
  bold: boolean
  italic: boolean

  // Geometria ASS
  outline: number            // Espessura da borda (px)
  shadow: number             // Profundidade da sombra (px)
  alignment: number          // 1-9 (numpad layout)
  marginV: number            // Margem vertical (px)
  marginH: number            // Margem horizontal (px)

  // Limites de texto
  maxCharsPerLine: number
  maxLines: number

  // Efeito
  effect: CaptionEffect
  effectOptions: {
    fadeInMs?: number         // Duração do fade in
    fadeOutMs?: number        // Duração do fade out
    highlightColor?: string   // Cor da palavra ativa (hex)
    glowRadius?: number       // Raio do blur/glow
    glowColor?: string        // Cor do glow (hex)
  }
}

// ---------------------------------------------------------------------------
//  Estilos TikTok
// ---------------------------------------------------------------------------

/**
 * TikTok Viral – Karaoke word-by-word highlight
 * 
 * O estilo mais viral do TikTok: cada palavra muda de cor conforme é falada.
 * Fonte Montserrat ExtraBold, tamanho grande, alto contraste.
 * Efeito karaoke nativo do ASS (\kf) com cor de highlight amarela.
 */
export const TIKTOK_VIRAL_STYLE: CaptionStyle = {
  id: 'tiktok_viral',
  name: 'TikTok Viral',
  description: 'Estilo viral com highlight word-by-word amarelo. Cada palavra muda de cor conforme é falada.',
  platform: 'TikTok',
  recommendedFor: ['9:16', '1:1'],

  fontName: 'Montserrat ExtraBold',
  fontSize: 80,
  primaryColor: '#FFFFFF',
  secondaryColor: '#FFE135',       // Amarelo viral
  outlineColor: '#000000',
  backgroundColor: '#00000000',    // Sem background box
  bold: true,
  italic: false,

  outline: 5,
  shadow: 0,
  alignment: 2,                    // Bottom-center
  marginV: 400,                    // Terço inferior (safe zone TikTok)
  marginH: 60,

  maxCharsPerLine: 18,
  maxLines: 2,

  effect: 'word_highlight',
  effectOptions: {
    highlightColor: '#FFE135',     // Amarelo
    fadeInMs: 100,
    fadeOutMs: 100
  }
}

/**
 * TikTok Pop – Texto com entrada em pop/scale + cores vibrantes
 * 
 * Cada bloco de legenda surge com um efeito de scale (pop) e fade.
 * Background semi-transparente colorido atrás do texto.
 * Fonte bold, cores quentes, estilo "influencer".
 */
export const TIKTOK_POP_STYLE: CaptionStyle = {
  id: 'tiktok_pop',
  name: 'TikTok Pop',
  description: 'Texto com entrada em pop e background colorido. Estilo vibrante para conteúdo de lifestyle e trends.',
  platform: 'TikTok',
  recommendedFor: ['9:16', '1:1'],

  fontName: 'Montserrat Black',
  fontSize: 72,
  primaryColor: '#FFFFFF',
  secondaryColor: '#FF6B6B',       // Coral vibrante
  outlineColor: '#FF2D55',         // Rosa TikTok
  backgroundColor: '#CC000000',    // Preto 80% alpha
  bold: true,
  italic: false,

  outline: 4,
  shadow: 2,
  alignment: 2,
  marginV: 420,
  marginH: 50,

  maxCharsPerLine: 20,
  maxLines: 2,

  effect: 'pop_in',
  effectOptions: {
    fadeInMs: 150,
    fadeOutMs: 100,
    highlightColor: '#FF6B6B'
  }
}

/**
 * TikTok Karaoke – Preenchimento progressivo estilo karaoke real
 * 
 * Usa efeito \kf do ASS para preencher o texto progressivamente
 * da cor secundária para a primária, sincronizado com a fala.
 * Visual impactante, ideal para narração rápida.
 */
export const TIKTOK_KARAOKE_STYLE: CaptionStyle = {
  id: 'tiktok_karaoke',
  name: 'TikTok Karaoke',
  description: 'Preenchimento progressivo karaoke. Texto é preenchido com cor conforme a narração avança.',
  platform: 'TikTok',
  recommendedFor: ['9:16', '1:1'],

  fontName: 'Montserrat ExtraBold',
  fontSize: 76,
  primaryColor: '#00FF88',         // Verde neon (cor preenchida)
  secondaryColor: '#FFFFFF',       // Branco (cor não preenchida)
  outlineColor: '#000000',
  backgroundColor: '#00000000',
  bold: true,
  italic: false,

  outline: 4,
  shadow: 1,
  alignment: 2,
  marginV: 380,
  marginH: 60,

  maxCharsPerLine: 20,
  maxLines: 2,

  effect: 'karaoke_fill',
  effectOptions: {
    fadeInMs: 50,
    fadeOutMs: 50
  }
}

// ---------------------------------------------------------------------------
//  Estilos Instagram Reels
// ---------------------------------------------------------------------------

/**
 * Instagram Reels Clean – Minimalista e elegante
 * 
 * Estilo limpo com fade suave. Fonte moderna, sem background pesado.
 * Outline fino para legibilidade. Ideal para conteúdo educacional
 * e lifestyle sofisticado.
 */
export const REELS_CLEAN_STYLE: CaptionStyle = {
  id: 'reels_clean',
  name: 'Reels Clean',
  description: 'Minimalista e elegante com fade suave. Ideal para conteúdo educacional e lifestyle.',
  platform: 'Instagram Reels',
  recommendedFor: ['9:16'],

  fontName: 'Helvetica Neue',
  fontSize: 56,
  primaryColor: '#FFFFFF',
  secondaryColor: '#E8E8E8',
  outlineColor: '#1A1A1A',
  backgroundColor: '#00000000',
  bold: true,
  italic: false,

  outline: 3,
  shadow: 1,
  alignment: 2,
  marginV: 360,
  marginH: 70,

  maxCharsPerLine: 28,
  maxLines: 2,

  effect: 'fade',
  effectOptions: {
    fadeInMs: 200,
    fadeOutMs: 200
  }
}

/**
 * Instagram Reels Bold – Impactante com background box
 * 
 * Texto grande com background box colorido semi-transparente.
 * Estilo "story highlight" que se destaca sobre qualquer imagem.
 * Ideal para hooks, CTAs e frases de impacto.
 */
export const REELS_BOLD_STYLE: CaptionStyle = {
  id: 'reels_bold',
  name: 'Reels Bold',
  description: 'Texto impactante com background box colorido. Perfeito para hooks e frases de impacto.',
  platform: 'Instagram Reels',
  recommendedFor: ['9:16', '1:1'],

  fontName: 'Montserrat Black',
  fontSize: 64,
  primaryColor: '#FFFFFF',
  secondaryColor: '#FF8A00',       // Laranja Instagram
  outlineColor: '#000000',
  backgroundColor: '#E6833AB4',    // Laranja 90% alpha
  bold: true,
  italic: false,

  outline: 0,                      // Sem outline (o box já dá contraste)
  shadow: 0,
  alignment: 2,
  marginV: 400,
  marginH: 80,

  maxCharsPerLine: 22,
  maxLines: 2,

  effect: 'pop_in',
  effectOptions: {
    fadeInMs: 120,
    fadeOutMs: 80,
    highlightColor: '#FF8A00'
  }
}

/**
 * Instagram Reels Glow – Efeito brilho/glow cinematográfico
 * 
 * Texto com blur suave ao redor criando efeito de glow luminoso.
 * Ideal para conteúdo noturno, misterioso ou cinematográfico.
 * Usa \blur do ASS para criar o efeito de brilho.
 */
export const REELS_GLOW_STYLE: CaptionStyle = {
  id: 'reels_glow',
  name: 'Reels Glow',
  description: 'Efeito glow cinematográfico com brilho suave. Ideal para conteúdo noturno e misterioso.',
  platform: 'Instagram Reels',
  recommendedFor: ['9:16'],

  fontName: 'Montserrat Bold',
  fontSize: 60,
  primaryColor: '#FFFFFF',
  secondaryColor: '#00D4FF',       // Azul cyan luminoso
  outlineColor: '#0088CC',         // Azul mais escuro
  backgroundColor: '#00000000',
  bold: true,
  italic: false,

  outline: 3,
  shadow: 0,
  alignment: 2,
  marginV: 380,
  marginH: 60,

  maxCharsPerLine: 26,
  maxLines: 2,

  effect: 'glow_pulse',
  effectOptions: {
    glowRadius: 8,
    glowColor: '#00D4FF',
    fadeInMs: 150,
    fadeOutMs: 150
  }
}

/**
 * Instagram Reels Neon – Efeito neon vibrante
 * 
 * Simula texto neon com borda brilhante e cor vibrante.
 * Borda dupla (outline + glow) para efeito de tubo de neon.
 * Ideal para conteúdo de entretenimento, música e nightlife.
 */
export const REELS_NEON_STYLE: CaptionStyle = {
  id: 'reels_neon',
  name: 'Reels Neon',
  description: 'Efeito neon vibrante com borda brilhante. Perfeito para entretenimento e nightlife.',
  platform: 'Instagram Reels',
  recommendedFor: ['9:16'],

  fontName: 'Montserrat ExtraBold',
  fontSize: 62,
  primaryColor: '#FF00FF',         // Magenta neon
  secondaryColor: '#00FFFF',       // Cyan neon
  outlineColor: '#FF00FF',         // Mesmo que primary (efeito neon)
  backgroundColor: '#00000000',
  bold: true,
  italic: false,

  outline: 2,
  shadow: 0,
  alignment: 2,
  marginV: 380,
  marginH: 60,

  maxCharsPerLine: 24,
  maxLines: 2,

  effect: 'neon_flicker',
  effectOptions: {
    glowRadius: 12,
    glowColor: '#FF00FF',
    fadeInMs: 80,
    fadeOutMs: 80
  }
}

// ---------------------------------------------------------------------------
//  Estilos YouTube
// ---------------------------------------------------------------------------

/**
 * YouTube Shorts – Otimizado para mobile
 */
export const YOUTUBE_SHORTS_STYLE: CaptionStyle = {
  id: 'youtube_shorts',
  name: 'YouTube Shorts',
  description: 'Legendas otimizadas para Shorts com word highlight. Legibilidade em mobile.',
  platform: 'YouTube Shorts',
  recommendedFor: ['9:16'],

  fontName: 'Montserrat Bold',
  fontSize: 58,
  primaryColor: '#FFFFFF',
  secondaryColor: '#FF0000',       // Vermelho YouTube
  outlineColor: '#000000',
  backgroundColor: '#99000000',
  bold: true,
  italic: false,

  outline: 4,
  shadow: 2,
  alignment: 2,
  marginV: 380,
  marginH: 60,

  maxCharsPerLine: 32,
  maxLines: 2,

  effect: 'word_highlight',
  effectOptions: {
    highlightColor: '#FF0000',
    fadeInMs: 100,
    fadeOutMs: 100
  }
}

/**
 * YouTube Vídeo Longo – Profissional e discreto
 */
export const YOUTUBE_LONG_STYLE: CaptionStyle = {
  id: 'youtube_long',
  name: 'YouTube Vídeo',
  description: 'Legendas profissionais e discretas. Posição clássica bottom-center para vídeos longos.',
  platform: 'YouTube',
  recommendedFor: ['16:9'],

  fontName: 'Arial',
  fontSize: 26,
  primaryColor: '#FFFFFF',
  secondaryColor: '#FFFF00',       // Amarelo clássico
  outlineColor: '#000000',
  backgroundColor: '#B3000000',
  bold: false,
  italic: false,

  outline: 2,
  shadow: 1,
  alignment: 2,
  marginV: 50,
  marginH: 40,

  maxCharsPerLine: 42,
  maxLines: 2,

  effect: 'fade',
  effectOptions: {
    fadeInMs: 150,
    fadeOutMs: 150
  }
}

// ---------------------------------------------------------------------------
//  Registry & Helpers
// ---------------------------------------------------------------------------

/**
 * Mapa de todos os estilos disponíveis
 */
export const CAPTION_STYLES: Record<CaptionStyleId, CaptionStyle> = {
  tiktok_viral: TIKTOK_VIRAL_STYLE,
  tiktok_pop: TIKTOK_POP_STYLE,
  tiktok_karaoke: TIKTOK_KARAOKE_STYLE,
  reels_clean: REELS_CLEAN_STYLE,
  reels_bold: REELS_BOLD_STYLE,
  reels_glow: REELS_GLOW_STYLE,
  reels_neon: REELS_NEON_STYLE,
  youtube_shorts: YOUTUBE_SHORTS_STYLE,
  youtube_long: YOUTUBE_LONG_STYLE
}

/**
 * Recomenda o melhor estilo baseado no aspect ratio e plataforma
 */
export function getRecommendedStyle(
  aspectRatio: string,
  platform?: string
): CaptionStyleId {
  // Se tem plataforma específica, usar o melhor estilo dela
  if (platform) {
    const platformLower = platform.toLowerCase()
    if (platformLower.includes('tiktok')) return 'tiktok_viral'
    if (platformLower.includes('instagram') || platformLower.includes('reels')) return 'reels_clean'
    if (platformLower.includes('shorts')) return 'youtube_shorts'
    if (platformLower.includes('youtube')) return 'youtube_long'
  }

  // Fallback por aspect ratio
  switch (aspectRatio) {
    case '9:16':
      return 'tiktok_viral'
    case '1:1':
      return 'tiktok_pop'
    case '16:9':
      return 'youtube_long'
    default:
      return 'reels_clean'
  }
}

/**
 * Retorna estilos filtrados por plataforma
 */
export function getStylesByPlatform(platform: string): CaptionStyle[] {
  return Object.values(CAPTION_STYLES).filter(s =>
    s.platform.toLowerCase().includes(platform.toLowerCase())
  )
}

// ---------------------------------------------------------------------------
//  ASS Format Utilities
// ---------------------------------------------------------------------------

/**
 * Converte cor hex para formato ASS (BGR com alpha)
 * ASS usa formato &HAABBGGRR (alpha, blue, green, red)
 * 
 * @example hexToASS('#FFFFFF')      → '&H00FFFFFF'
 * @example hexToASS('#80000000')    → '&H80000000'
 * @example hexToASS('#FF00FF')      → '&H00FF00FF'
 */
export function hexToASS(hex: string): string {
  hex = hex.replace('#', '')

  if (hex.length === 8) {
    const alpha = hex.substring(0, 2)
    const r = hex.substring(2, 4)
    const g = hex.substring(4, 6)
    const b = hex.substring(6, 8)
    return `&H${alpha}${b}${g}${r}`
  }

  const r = hex.substring(0, 2)
  const g = hex.substring(2, 4)
  const b = hex.substring(4, 6)
  return `&H00${b}${g}${r}`
}






