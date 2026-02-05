import type { Document, DocumentSource, DocumentImage, DocumentNote } from '@prisma/client'

// =============================================================================
// DTOs - CREATE
// =============================================================================

export interface CreateDocumentDTO {
  title: string
  sourceText: string
  theme: string
  tags?: string[]
  category?: string
}

export interface CreateDocumentSourceDTO {
  title: string
  content: string
  sourceType: 'article' | 'paper' | 'quote' | 'transcript'
  url?: string
  author?: string
  order?: number
}

export interface CreateDocumentImageDTO {
  description: string
  imageData?: Buffer
  mimeType?: string
  url?: string
  tags?: string
  order?: number
}

export interface CreateDocumentNoteDTO {
  content: string
  noteType?: 'insight' | 'connection' | 'question' | 'idea'
  order?: number
}

// =============================================================================
// DTOs - UPDATE
// =============================================================================

export interface UpdateDocumentDTO {
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

export interface DocumentResponse {
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

export interface DocumentWithRelationsResponse extends DocumentResponse {
  sources: DocumentSource[]
  images: DocumentImage[]
  notes: DocumentNote[]
}

export interface DocumentListResponse {
  documents: DocumentResponse[]
  total: number
  page: number
  pageSize: number
}
