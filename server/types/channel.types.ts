// =============================================================================
// DTOs - CREATE
// =============================================================================

export interface CreateChannelDTO {
  name: string
  handle: string
  description?: string
  platform?: string
  logoBase64?: string
  logoMimeType?: string
  defaultVisualStyleId?: string
  defaultScriptStyleId?: string
  defaultSeedId?: string
}

// =============================================================================
// DTOs - UPDATE
// =============================================================================

export interface UpdateChannelDTO {
  name?: string
  handle?: string
  description?: string
  platform?: string
  logoBase64?: string | null
  logoMimeType?: string | null
  defaultVisualStyleId?: string | null
  defaultScriptStyleId?: string | null
  defaultSeedId?: string | null
  isActive?: boolean
}

// =============================================================================
// DTOs - RESPONSE
// =============================================================================

export interface ChannelResponse {
  id: string
  name: string
  handle: string
  description: string | null
  platform: string | null
  logoBase64: string | null
  logoMimeType: string | null
  defaultVisualStyleId: string | null
  defaultScriptStyleId: string | null
  defaultSeedId: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date

  // Counts
  dossiersCount?: number
}

export interface ChannelListResponse {
  channels: ChannelResponse[]
  total: number
}
