/**
 * Classificações de inteligência (tema/tonalidade do conteúdo).
 * Hierarquia: Classification (pai) → Script (filho) → Visual (neto).
 * defaultScriptStyleId = filho recomendado; o script por sua vez tem defaultVisualStyleId.
 */

import type { ScriptStyleId } from './script-styles'

export type IntelligenceClassificationId =
  | 'true-crime'
  | 'história'
  | 'ciência'
  | 'biografia'
  | 'investigação'
  | 'mistério'
  | 'conspiração'

export interface IntelligenceClassification {
  id: IntelligenceClassificationId
  label: string
  description: string
  /** Emoji ou keyword para ícone no frontend */
  iconKey: string
  order: number
  isActive: boolean
  /** Prompt base para geração de música via Stable Audio 2.5 (gênero, instrumentos, BPM, mood) */
  musicGuidance: string
  /** Palavras-chave de atmosfera emocional para a trilha sonora */
  musicMood: string
  /** Instruções para o tom das descrições visuais (visualDescription) — alinha imagem ao tema */
  visualGuidance: string
  /** Pai → Filho: estilo de roteiro recomendado para esta classificação */
  defaultScriptStyleId?: ScriptStyleId
}

export const TRUE_CRIME: IntelligenceClassification = {
  id: 'true-crime',
  label: 'True Crime',
  description: 'Investigações de delitos e perfis criminais',
  iconKey: 'skull',
  order: 1,
  isActive: true,
  musicGuidance: 'Dark Ambient, Low Drone Synths, Sparse Piano Notes, Tension Strings, Eerie Pads, Subtle Heartbeat Rhythm, Minor Key, well-arranged composition, 70 BPM',
  musicMood: 'Dread, Unease, Cold Investigation, Suspicion, Somber',
  visualGuidance: 'Grave, sober tone. Avoid dreamlike, nostalgic or "epic adventure" language. Prioritize restrained lighting, shadows, tension and historical weight. Visual descriptions must reflect the gravity of the subject (violence, injustice, persecution). No fantasy or light tone.',
  defaultScriptStyleId: 'documentary'
}

export const HISTORIA: IntelligenceClassification = {
  id: 'história',
  label: 'História',
  description: 'Análise de eventos e registros do passado',
  iconKey: 'history',
  order: 2,
  isActive: true,
  musicGuidance: 'Orchestral, Soft Strings, Historical Documentary Score, French Horn, Warm Cello, Reflective Piano, Legato Phrases, Major-Minor Blend, well-arranged composition, 85 BPM',
  musicMood: 'Reflective, Grandeur, Nostalgia, Solemn, Epic',
  visualGuidance: 'Reflective, historical tone. Use lighting that suggests period and gravity. Avoid fantasy or adventure; prioritize solemnity, archives, documents, period settings. Nostalgia only when the subject is light.',
  defaultScriptStyleId: 'documentary'
}

export const CIENCIA: IntelligenceClassification = {
  id: 'ciência',
  label: 'Ciência',
  description: 'Documentação de descobertas e fatos científicos',
  iconKey: 'beaker',
  order: 3,
  isActive: true,
  musicGuidance: 'Electronic Ambient, Soft Synth Pads, Plucked Digital Strings, Glass Textures, Gentle Arpeggios, Clean Tones, Futuristic, well-arranged composition, 95 BPM',
  musicMood: 'Wonder, Discovery, Curiosity, Clarity, Innovation',
  visualGuidance: 'Visual clarity and precision. Clean light, compositions that suggest discovery and order. Controlled wonder, no melodrama. Avoid excessive dramatic shadows; prioritize readability and a sense of "visual explanation".',
  defaultScriptStyleId: 'educational'
}

export const BIOGRAFIA: IntelligenceClassification = {
  id: 'biografia',
  label: 'Biografia',
  description: 'Trajetórias de vida e personalidades',
  iconKey: 'user',
  order: 4,
  isActive: true,
  musicGuidance: 'Cinematic Piano, Emotional Strings, Intimate Acoustic Guitar, Warm Pads, Human Voice Textures, Gentle Crescendo, well-arranged composition, 80 BPM',
  musicMood: 'Intimate, Emotional, Inspiring, Bittersweet, Human',
  visualGuidance: 'Intimate, human tone. Focus on faces, gestures, personal environments. Warm, welcoming light when inspiring; more restrained when melancholic. Avoid generic epic; prioritize moments that tell the person\'s story.',
  defaultScriptStyleId: 'narrative'
}

export const INVESTIGACAO: IntelligenceClassification = {
  id: 'investigação',
  label: 'Investigação',
  description: 'Pesquisa profunda sobre tópicos específicos',
  iconKey: 'search',
  order: 5,
  isActive: true,
  musicGuidance: 'Dark Electronic, Pulsing Bassline, Ticking Clock Rhythm, Industrial Textures, Subtle Distortion, Tension Build, Cinematic, well-arranged composition, 90 BPM',
  musicMood: 'Urgency, Determination, Suspense, Methodical, Relentless',
  visualGuidance: 'Tone of urgency and method. Lighting that suggests discovery, files, clues, contained tension. Avoid dreamlike or nostalgic; prioritize angles that convey investigation, focus, persistence.',
  defaultScriptStyleId: 'documentary'
}

export const MISTERIO: IntelligenceClassification = {
  id: 'mistério',
  label: 'Mistério',
  description: 'Enigmas não resolvidos e lendas urbanas',
  iconKey: 'moon',
  order: 6,
  isActive: true,
  musicGuidance: 'Ambient, Ethereal Pads, Reversed Textures, Distant Choir, Glass Bell Tones, Fog-like Drones, Otherworldly, Minor Key, well-arranged composition, 75 BPM',
  musicMood: 'Enigmatic, Haunting, Otherworldly, Curiosity, Awe',
  visualGuidance: 'Enigmatic, somber tone. Fog, half-light, elements that suggest the unresolved. Avoid "epic adventure" or visual closure; prioritize mystery, doubt, atmosphere of something hidden. Do not resolve the enigma in the image.',
  defaultScriptStyleId: 'mystery'
}

export const CONSPIRACAO: IntelligenceClassification = {
  id: 'conspiração',
  label: 'Conspiração',
  description: 'Teorias, sombras e arquitetura do poder',
  iconKey: 'eye',
  order: 7,
  isActive: true,
  musicGuidance: 'Dark Cinematic, Deep Sub Bass, Paranoid Synths, Static Noise Textures, Distorted Radio Fragments, Slow Tension Build, Oppressive Atmosphere, well-arranged composition, 75 BPM',
  musicMood: 'Paranoia, Dread, Secrecy, Oppression, Distrust',
  visualGuidance: 'Oppressive, paranoid tone. Deep shadows, implied surveillance, architecture of power. Avoid heroic or triumphant; prioritize feeling of being watched, secrets, empty corridors, hidden documents.',
  defaultScriptStyleId: 'mystery'
}

export const INTELLIGENCE_CLASSIFICATIONS: Record<IntelligenceClassificationId, IntelligenceClassification> = {
  'true-crime': TRUE_CRIME,
  'história': HISTORIA,
  'ciência': CIENCIA,
  'biografia': BIOGRAFIA,
  'investigação': INVESTIGACAO,
  'mistério': MISTERIO,
  'conspiração': CONSPIRACAO
}

/**
 * Retorna todas as classificações ativas, ordenadas
 */
export function getActiveClassifications(): IntelligenceClassification[] {
  return Object.values(INTELLIGENCE_CLASSIFICATIONS)
    .filter(c => c.isActive)
    .sort((a, b) => a.order - b.order)
}

/**
 * Busca uma classificação pelo ID
 */
export function getClassificationById(id: string): IntelligenceClassification | undefined {
  return INTELLIGENCE_CLASSIFICATIONS[id as IntelligenceClassificationId]
}
