import type { Dossier, DossierSource, DossierImage, DossierNote } from '@prisma/client'

// =============================================================================
// DTOs - CREATE
// =============================================================================

export interface CreateDossierDTO {
  title: string
  sourceText: string
  theme: string
  tags?: string[]
  visualIdentityContext?: string
  preferredVisualStyleId?: string
  preferredSeedId?: string
}

export interface CreateDossierSourceDTO {
  title: string
  content: string
  sourceType: 'url' | 'text'
  url?: string
  author?: string
  order?: number
}

export interface CreateDossierImageDTO {
  description: string
  imageData?: Buffer
  mimeType?: string
  url?: string
  tags?: string
  order?: number
}

export interface CreateDossierNoteDTO {
  content: string
  noteType?: 'insight' | 'curiosity' | 'data' | 'todo'
  order?: number
}

// =============================================================================
// DTOs - UPDATE
// =============================================================================

export interface UpdateDossierDTO {
  title?: string
  sourceText?: string
  theme?: string
  tags?: string[]
  researchData?: any
  isProcessed?: boolean
  visualIdentityContext?: string
  preferredVisualStyleId?: string
  preferredSeedId?: string
}

// =============================================================================
// DTOs - RESPONSE
// =============================================================================

export interface DossierResponse {
  id: string
  title: string
  sourceText: string
  theme: string
  researchData?: any
  tags: string[]
  visualIdentityContext?: string | null
  preferredVisualStyleId?: string | null
  preferredSeedId?: string | null
  isProcessed: boolean
  createdAt: Date
  updatedAt: Date

  // Counts
  sourcesCount?: number
  imagesCount?: number
  notesCount?: number
  outputsCount?: number
  /** Soma dos custos de todos os outputs do dossier (USD) */
  totalOutputsCost?: number
}

export interface DossierWithRelationsResponse extends DossierResponse {
  sources: DossierSource[]
  images: DossierImage[]
  notes: DossierNote[]
}

export interface DossierListResponse {
  dossiers: DossierResponse[]
  total: number
  page: number
  pageSize: number
}
