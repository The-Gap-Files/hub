import type { OutputType, OutputStatus, PipelineStage, StageStatus } from '@prisma/client'

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
// Stage Gate DTO
// =============================================================================

export interface StageGateDTO {
  stage: PipelineStage
  status: StageStatus
  feedback?: string | null
  executedAt?: Date | null
  reviewedAt?: Date | null
}

// =============================================================================
// Product DTOs
// =============================================================================

export interface StoryOutlineProductDTO {
  outlineData: any
  provider: string
  model?: string | null
}

export interface RetentionQAProductDTO {
  overallScore: number
  summary: string
  analysisData: any
  provider: string
  model?: string | null
}

export interface MonetizationProductDTO {
  contextData: any
}

export interface SocialKitProductDTO {
  kitData: any
}

export interface ThumbnailProductDTO {
  candidates?: any | null
  selectedData?: Buffer | null
  selectedStoragePath?: string | null
  selectedAt?: Date | null
}

export interface RenderProductDTO {
  videoStoragePath?: string | null
  mimeType?: string | null
  fileSize?: number | null
  captionedStoragePath?: string | null
  captionedFileSize?: number | null
  renderOptions?: any | null
  renderedAt?: Date
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
  editorialObjectiveId?: string
  editorialObjective?: {
    id: string
    name: string
    category: string
  }
  status: OutputStatus
  enableMotion: boolean
  hasBgm: boolean
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date

  // Stage gates (replaces 9 approval booleans)
  stageGates: StageGateDTO[]
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

  // Product tables (replaces inline JSONs/blobs)
  storyOutlineData?: StoryOutlineProductDTO | null
  retentionQAData?: RetentionQAProductDTO | null
  monetizationData?: MonetizationProductDTO | null
  socialKitData?: SocialKitProductDTO | null
  thumbnailProduct?: ThumbnailProductDTO | null
  renderProduct?: RenderProductDTO | null
}

export interface CreateOutputsResponse {
  outputs: OutputResponse[]
  total: number
}

/** Resposta do clone de roteiro (novo output criado no mesmo dossier com script + cenas copiados) */
export interface CloneOutputResponse {
  output: OutputResponse
}
