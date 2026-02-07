/**
 * Classificações de inteligência para dossiês
 * Define as categorias temáticas disponíveis para classificar investigações
 */

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
}

export const TRUE_CRIME: IntelligenceClassification = {
  id: 'true-crime',
  label: 'True Crime',
  description: 'Investigações de delitos e perfis criminais',
  iconKey: 'skull',
  order: 1,
  isActive: true
}

export const HISTORIA: IntelligenceClassification = {
  id: 'história',
  label: 'História',
  description: 'Análise de eventos e registros do passado',
  iconKey: 'history',
  order: 2,
  isActive: true
}

export const CIENCIA: IntelligenceClassification = {
  id: 'ciência',
  label: 'Ciência',
  description: 'Documentação de descobertas e fatos científicos',
  iconKey: 'beaker',
  order: 3,
  isActive: true
}

export const BIOGRAFIA: IntelligenceClassification = {
  id: 'biografia',
  label: 'Biografia',
  description: 'Trajetórias de vida e personalidades',
  iconKey: 'user',
  order: 4,
  isActive: true
}

export const INVESTIGACAO: IntelligenceClassification = {
  id: 'investigação',
  label: 'Investigação',
  description: 'Pesquisa profunda sobre tópicos específicos',
  iconKey: 'search',
  order: 5,
  isActive: true
}

export const MISTERIO: IntelligenceClassification = {
  id: 'mistério',
  label: 'Mistério',
  description: 'Enigmas não resolvidos e lendas urbanas',
  iconKey: 'moon',
  order: 6,
  isActive: true
}

export const CONSPIRACAO: IntelligenceClassification = {
  id: 'conspiração',
  label: 'Conspiração',
  description: 'Teorias, sombras e arquitetura do poder',
  iconKey: 'eye',
  order: 7,
  isActive: true
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
