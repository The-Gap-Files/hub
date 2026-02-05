import type { Dossier, DossierSource, DossierImage, DossierNote } from '@prisma/client'

// =============================================================================
// DTOs - CREATE
// =============================================================================

export interface CreateDossierDTO {
  title: string
  sourceText: string
  theme: string
  tags?: string[]
  category?: string
}

export interface CreateDossierSourceDTO {
  title: string
  content: string
  sourceType: 'article' | 'paper' | 'quote' | 'transcript'
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
  noteType?: 'insight' | 'connection' | 'question' | 'idea'
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
  category?: string
  researchData?: any
  isProcessed?: boolean
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
  category?: string
  isProcessed: boolean
  createdAt: Date
  updatedAt: Date
  
  // Counts
  sourcesCount?: number
  imagesCount?: number
  notesCount?: number
  outputsCount?: number
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
