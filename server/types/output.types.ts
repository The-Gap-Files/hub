import type { Output, OutputType, OutputStatus } from '@prisma/client'

// =============================================================================
// DTOs - CREATE
// =============================================================================

export interface CreateOutputDTO {
  outputType: OutputType
  format: string
  title?: string
  duration?: number
  aspectRatio?: string
  platform?: string
  targetWPM?: number
  language?: string
  narrationLanguage?: string
  voiceId?: string
  enableMotion?: boolean
  mustInclude?: string
  mustExclude?: string
  scriptStyleId?: string
  visualStyleId?: string
  seedId?: string
}

export interface CreateOutputsDTO {
  outputs: CreateOutputDTO[]
}

export interface CreateOutputRelationDTO {
  mainOutputId: string
  relatedOutputId: string
  relationType: 'teaser_to_full' | 'full_to_teaser' | 'cross_platform'
}

// =============================================================================
// DTOs - RESPONSE
// =============================================================================

export interface OutputResponse {
  id: string
  dossierId: string
  outputType: OutputType
  format: string
  title?: string
  duration?: number
  aspectRatio?: string
  platform?: string
  status: OutputStatus
  scriptApproved: boolean
  imagesApproved: boolean
  videosApproved: boolean
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface OutputWithRelationsResponse extends OutputResponse {
  dossier: {
    id: string
    title: string
    theme: string
  }
  scriptStyle?: {
    id: string
    name: string
  }
  visualStyle?: {
    id: string
    name: string
  }
  relatedOutputs?: {
    id: string
    outputType: OutputType
    relationType: string
  }[]
}

export interface CreateOutputsResponse {
  outputs: OutputResponse[]
  total: number
}

