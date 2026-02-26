// =============================================================================
// Output Page Types — remodelagem pipeline (StageGate + Product Tables)
// =============================================================================

// ---------------------------------------------------------------------------
// Enums & Union Types
// ---------------------------------------------------------------------------

export type OutputStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'RENDERED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

/** Pipeline stages — mirrors PipelineStage enum from Prisma */
export type PipelineStage =
  | 'STORY_OUTLINE'
  | 'WRITER'
  | 'SCRIPT'
  | 'RETENTION_QA'
  | 'IMAGES'
  | 'BGM'
  | 'SFX'
  | 'AUDIO'
  | 'MUSIC_EVENTS'
  | 'MOTION'
  | 'RENDER'

/** Status of each stage — mirrors StageStatus enum from Prisma */
export type StageStatus =
  | 'NOT_STARTED'
  | 'GENERATING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SKIPPED'
  | 'FAILED'

/** Stage being actively generated (loading state) */
export type GeneratingStage =
  | 'WRITER'
  | 'SCRIPT'
  | 'RETENTION_QA'
  | 'SCRIPT_FIX'
  | 'IMAGES'
  | 'AUDIO'
  | 'BGM'
  | 'MOTION'

// ---------------------------------------------------------------------------
// Stage Gate
// ---------------------------------------------------------------------------

export interface StageGateEntry {
  stage: PipelineStage
  status: StageStatus
  feedback?: string | null
  executedAt?: string | null
  reviewedAt?: string | null
}

// ---------------------------------------------------------------------------
// Stage Order (constant) — for UI pipeline steps bar
// ---------------------------------------------------------------------------

export interface StageOrderEntry {
  stage: PipelineStage
  label: string
}

export const STAGE_ORDER: StageOrderEntry[] = [
  { stage: 'STORY_OUTLINE', label: 'Plano' },
  { stage: 'WRITER', label: 'Escritor' },
  { stage: 'SCRIPT', label: 'Roteiro' },
  { stage: 'RETENTION_QA', label: 'Retenção' },
  { stage: 'IMAGES', label: 'Visual' },
  { stage: 'AUDIO', label: 'Narração' },
  { stage: 'BGM', label: 'Música' },
  { stage: 'MOTION', label: 'Motion' },
]

// ---------------------------------------------------------------------------
// Scene Assets
// ---------------------------------------------------------------------------

export interface SceneImage {
  id: string
  sceneId: string
  url?: string
  isSelected: boolean
  role?: 'start' | 'end'
  createdAt: string
}

export interface SceneVideo {
  id: string
  sceneId: string
  url?: string
  isSelected: boolean
  createdAt: string
}

export interface AudioTrack {
  id: string
  sceneId?: string
  outputId?: string
  type: 'scene_narration' | 'scene_sfx' | 'background_music' | 'music_event'
  url?: string
  offsetMs?: number | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export interface OutputScene {
  id: string
  outputId: string
  order: number
  narration: string | null
  visualDescription: string
  audioDescription: string | null
  sceneEnvironment: string | null
  motionDescription: string | null
  startTime: number | null
  endTime: number | null
  estimatedDuration: number | null
  imageRestrictionReason: string | null
  imageStatus: string
  images: SceneImage[]
  videos: SceneVideo[]
  audioTracks: AudioTrack[]
}

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export interface ScriptBgmTrack {
  prompt: string
  startScene: number
  endScene: number | null
  volume: number
}

export interface OutputScript {
  backgroundMusicPrompt?: string
  backgroundMusicVolume?: number
  backgroundMusicTracks?: ScriptBgmTrack[]
  writerProse?: string | null
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Story Outline
// ---------------------------------------------------------------------------

export interface HookVariant {
  level: string
  text: string
  toneDescription?: string
}

export interface StoryOutline {
  theme?: string
  premise?: string
  hookStrategy?: string
  hookVariants?: HookVariant[]
  segmentDistribution?: {
    hook: number
    context: number
    rising: number
    climax: number
    resolution: number
  }
  risingBeats?: Array<{
    title: string
    description: string
  }>
  climaxMoment?: string
  resolutionPoints?: string[]
  miniClimaxBeats?: unknown[]
  _selectedHookLevel?: string
  _customHook?: string
  _customScenes?: CustomSceneEntry[]
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Custom Scenes (creator scenes)
// ---------------------------------------------------------------------------

export interface CustomSceneEntry {
  narration: string
  referenceImageId: string | null
  referenceImagePreview: string | null
  imagePrompt: string
}

// ---------------------------------------------------------------------------
// Retention QA
// ---------------------------------------------------------------------------

export interface RetentionQASceneAnalysis {
  sceneOrder: number
  retentionScore: number
  riskFlags: string[]
  suggestions: string[]
}

export interface RetentionQAResult {
  overallScore: number
  summary: string
  sceneAnalysis: RetentionQASceneAnalysis[]
  editBlueprint?: {
    musicEvents?: Array<{
      atSecond: number
      type: string
    }>
  }
}

// ---------------------------------------------------------------------------
// Monetization
// ---------------------------------------------------------------------------

export interface MonetizationItem {
  itemType: 'teaser' | 'fullVideo'
  title: string
  hook: string
  angle: string
  angleCategory: string
  narrativeRole?: string
  shortFormatType?: string
  scriptOutline?: string
  cta?: string
  strategicNotes?: string
  scriptStyleId?: string
  scriptStyleName?: string
  editorialObjectiveId?: string
  editorialObjectiveName?: string
  avoidPatterns?: string[]
  sceneCount?: number
  microBriefV1?: unknown
  planId?: string
}

export interface NarrativeRoleBadge {
  label: string
  icon: string
  color: string
}

// ---------------------------------------------------------------------------
// Social Kit
// ---------------------------------------------------------------------------

export interface SocialKitPlatformContent {
  title?: string
  description?: string
  tags?: string[]
  [key: string]: unknown
}

export interface SocialKit {
  youtube?: SocialKitPlatformContent
  youtubeShorts?: SocialKitPlatformContent
  tiktok?: SocialKitPlatformContent
  instagram?: SocialKitPlatformContent
  seoTags?: string | string[]
}

export interface SocialKitTab {
  key: string
  label: string
}

// ---------------------------------------------------------------------------
// Render Options
// ---------------------------------------------------------------------------

export interface RenderOptions {
  includeLogo: boolean
  includeCaptions: boolean
  includeStingers: boolean
  captionStyleId: string | null
  volumeOverride?: {
    global?: number
    perTrack?: Record<number, number>
  }
}

export interface CaptionStyle {
  id: string
  name: string
  platform: string
  description: string
  isRecommended?: boolean
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

export interface CostLog {
  resource: string
  cost: number
  metadata?: Record<string, unknown>
}

export interface OutputCosts {
  total: number
  breakdown: Record<string, number>
  costAccuracy: Record<string, 'actual' | 'estimated'>
  logs: CostLog[]
}

// ---------------------------------------------------------------------------
// Pricing Error
// ---------------------------------------------------------------------------

export interface PricingError {
  model: string
  provider: string
  configUrl: string
}

// ---------------------------------------------------------------------------
// Config Options (loaded from API)
// ---------------------------------------------------------------------------

export interface ScriptStyleOption {
  id: string
  name: string
  [key: string]: unknown
}

export interface VisualStyleOption {
  id: string
  name: string
  screenwriterHints?: string
  photographerHints?: string
  [key: string]: unknown
}

export interface EditorialObjectiveOption {
  id: string
  name: string
  instruction?: string
  [key: string]: unknown
}

export interface SeedOption {
  id: string
  value: number
}

// ---------------------------------------------------------------------------
// Product DTOs (as returned by API in OutputData)
// ---------------------------------------------------------------------------

export interface StoryOutlineProductData {
  outlineData: StoryOutline
  provider: string
  model?: string | null
}

export interface RetentionQAProductData {
  overallScore: number
  summary: string
  analysisData: RetentionQAResult
  provider: string
  model?: string | null
}

export interface MonetizationProductData {
  contextData: MonetizationItem
}

export interface SocialKitProductData {
  kitData: SocialKit
}

export interface ThumbnailProductData {
  candidates?: Array<{ url?: string; base64?: string; prompt?: string }> | null
  selectedStoragePath?: string | null
  selectedAt?: string | null
}

export interface RenderProductData {
  videoStoragePath?: string | null
  mimeType?: string | null
  fileSize?: number | null
  captionedStoragePath?: string | null
  captionedFileSize?: number | null
  renderOptions?: RenderOptions | null
  renderedAt?: string
}

// ---------------------------------------------------------------------------
// Output Data (main entity)
// ---------------------------------------------------------------------------

export interface OutputData {
  id: string
  dossierId: string
  title: string | null
  status: OutputStatus

  // Voice / Speech
  voiceId: string | null
  speechConfiguredAt: string | null

  // Config
  format: string | null
  language: string | null
  narrationLanguage: string | null
  objective: string | null
  mustInclude: string | null
  mustExclude: string | null
  seedId: string | null
  seedValue: number | null
  scriptStyleId: string | null
  visualStyleId: string | null
  editorialObjectiveId: string | null
  enableMotion: boolean

  // Stage gates (replaces 9 approval booleans)
  stageGates: StageGateEntry[]

  // Product tables (replaces inline JSONs/blobs)
  storyOutlineData: StoryOutlineProductData | null
  retentionQAData: RetentionQAProductData | null
  monetizationData: MonetizationProductData | null
  socialKitData: SocialKitProductData | null
  thumbnailProduct: ThumbnailProductData | null
  renderProduct: RenderProductData | null

  // Relations: content
  script: OutputScript | null
  scenes: OutputScene[]
  audioTracks: AudioTrack[]

  // Relations: structural
  dossier: { theme?: string; title?: string; [key: string]: unknown } | null

  // Joined / computed fields returned by API
  outputType?: string
  platform?: string
  aspectRatio?: string
  duration?: number
  classification?: { label: string; [key: string]: unknown } | null
  scriptStyle?: { name: string; [key: string]: unknown } | null
  visualStyle?: { name: string; [key: string]: unknown } | null

  // Timestamps
  updatedAt: string
  createdAt: string
}
