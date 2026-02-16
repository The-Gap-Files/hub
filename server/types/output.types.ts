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
  objective?: string
  mustInclude?: string
  mustExclude?: string
  classificationId?: string
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
  targetWPM?: number
  language?: string
  narrationLanguage?: string
  voiceId?: string
  /** Indica que voz + velocidade já foram configuradas (pré-requisito para Story Architect). */
  speechConfiguredAt?: Date
  ttsProvider?: string
  objective?: string
  mustInclude?: string
  mustExclude?: string
  classificationId?: string
  scriptStyleId?: string
  visualStyleId?: string
  seedId?: string
  seedValue?: number
  monetizationContext?: any
  editorialObjectiveId?: string
  editorialObjective?: {
    id: string
    name: string
    category: string
  }
  status: OutputStatus
  storyOutlineApproved?: boolean
  scriptApproved: boolean
  imagesApproved: boolean
  bgmApproved: boolean
  audioApproved: boolean
  videosApproved: boolean
  renderApproved: boolean
  hasBgm: boolean
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  hasVideo?: boolean
  isStoredOnDisk?: boolean
  outputMimeType?: string
  outputSize?: number
  hasCaptionedVideo?: boolean
  captionedVideoSize?: number
  enableMotion: boolean
  storyOutline?: any // Story Architect: plano narrativo estruturado
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
  classification?: {
    id: string
    label: string
  }
  script?: any
  audioTracks?: any[]
  scenes?: any[]
  relatedOutputs?: {
    id: string
    outputType: OutputType
    relationType: string
  }[]
  thumbnailCandidates?: Array<{ base64: string; prompt: string }> | null
  hasThumbnail?: boolean
  socialKit?: any
}

export interface CreateOutputsResponse {
  outputs: OutputResponse[]
  total: number
}

/** Resposta do clone de roteiro (novo output criado no mesmo dossier com script + cenas copiados) */
export interface CloneOutputResponse {
  output: OutputResponse
}

