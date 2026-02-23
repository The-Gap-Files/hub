/**
 * Definições de tipos para os provedores de IA
 * Este arquivo define as interfaces que cada provedor deve implementar,
 * permitindo troca fácil de APIs no futuro.
 */

// =============================================================================
// COST TRACKING — Campo obrigatório em TODA response de provider externo
// =============================================================================

/** Informações de custo que TODA response de provider externo DEVE incluir */
export interface ProviderCostInfo {
  /** Custo em USD da operação */
  cost: number
  /** Nome do provider (ex: "REPLICATE", "ELEVENLABS", "OPENAI") */
  provider: string
  /** Modelo usado */
  model: string
  /** Metadados de cálculo (tokens, predict_time, characters, etc.) */
  metadata?: Record<string, unknown>
}

// =============================================================================
// SCRIPT GENERATION (OpenAI, Anthropic, Gemini)
// =============================================================================

export interface ScriptGenerationRequest {
  theme: string
  visualIdentityContext?: string
  language: string
  narrationLanguage?: string // Idioma da narração (pode ser diferente do roteiro)
  targetDuration: number // em segundos (derivado de targetSceneCount*5 quando targetSceneCount presente)
  /** Fonte da verdade: quantidade alvo de cenas. Quando presente, prevalece sobre targetDuration. */
  targetSceneCount?: number
  style?: string // ID do estilo de roteiro
  scriptStyleDescription?: string // Descrição do estilo de roteiro do banco
  scriptStyleInstructions?: string // Instruções do estilo de roteiro do banco
  visualStyle?: string
  visualStyleName?: string // Nome do estilo visual
  visualStyleDescription?: string // Descrição do estilo visual do banco (deprecated, usar campos abaixo)

  // Campos categorizados do estilo visual (para WAN 2.2)
  visualBaseStyle?: string
  visualLightingTags?: string
  visualAtmosphereTags?: string
  visualCompositionTags?: string
  visualColorPalette?: string
  visualQualityTags?: string
  visualGeneralTags?: string

  // Fontes unificadas (arquitetura flat/democratizada — todas as fontes são tratadas igualmente)
  sources?: Array<{ title: string; content: string; type: string; weight?: number }>
  /** @deprecated — usar 'sources'. Campo mantido apenas para backward-compat temporária */
  additionalSources?: Array<{ title: string; content: string; type: string }>
  userNotes?: string[] // Notas e insights do usuário
  visualReferences?: string[] // Descrições de imagens de referência
  researchData?: any // Dados estruturados (fatos, datas, pessoas)

  // Classificação temática do dossiê (intelligence classification)
  dossierCategory?: string // classificationId do output (ex: 'true-crime', 'conspiração', 'mistério')
  musicGuidance?: string // Prompt base de música para esta classificação (Stable Audio 2.5)
  musicMood?: string // Atmosfera emocional da trilha
  visualGuidance?: string // Instruções de tom para visualDescription (alinhado ao tema)

  // Story Architect: plano narrativo pré-gerado por Sonnet
  storyOutline?: string // JSON stringified do outline narrativo (hook, beats, climax, arco emocional)

  // Output-specific
  outputType?: string // VIDEO_TEASER, VIDEO_FULL, etc.
  format?: string // "teaser", "full"

  // Suporte Multimodal
  images?: Array<{
    data: string | Buffer // Base64 ou Buffer
    mimeType: string
    title?: string
  }>

  additionalContext?: string
  mustInclude?: string // O que deve ter no roteiro
  mustExclude?: string // O que NÃO deve ter no roteiro
  targetWPM?: number // Velocidade de fala alvo (Words Per Minute): 120 (lenta), 150 (média), 180 ( rápida)
  wordsPerScene?: number // Número alvo de palavras por cena (calculado a partir de targetWPM)

  // Persons & Neural Insights (Intelligence Center do dossiê)
  persons?: Array<{
    name: string
    role?: string | null
    description?: string | null
    visualDescription?: string | null
    aliases?: string[]
    relevance: string
  }>
  neuralInsights?: Array<{
    content: string
    noteType: 'insight' | 'curiosity' | 'research'
  }>

  // Papel narrativo do item de monetização (governa profundidade de contextualização)
  narrativeRole?: 'gateway' | 'deep-dive' | 'hook-only'
  /** Formato do short — define a mecânica narrativa (hook-brutal, plot-twist, etc.) */
  shortFormatType?: string
  strategicNotes?: string // Notas estratégicas do plano de monetização
  avoidPatterns?: string[] // Anti-padrões do monetizador ("O que NÃO fazer")

  // Série de episódios — governa transições e teasers entre EPs
  episodeNumber?: 1 | 2 | 3
  totalEpisodes?: number

  /** Brief persistido do Dossier (para reduzir contexto em TEASERS) */
  briefBundleV1?: any

  // ── Writer → Screenwriter pipeline ─────────────────────────────────────
  /** Prosa gerada pelo Writer (etapa 1). Quando presente, o Screenwriter usa esta
   *  prosa como única fonte narrativa, ignorando sources/outline/insights. */
  writerProse?: string
}

export interface ScriptScene {
  order: number
  narration: string
  visualDescription: string
  endVisualDescription?: string | null // Descrição visual do FINAL da cena (keyframe final para last_image no Wan 2.2)
  endImageReferenceWeight?: number | null // Peso (0.0-1.0) da start image como referência para gerar end image
  sceneEnvironment?: string // Identificador do ambiente (ex: "bishop_study", "canal_dawn") para continuidade visual
  motionDescription?: string // Instruções de movimento para i2v (câmera, sujeito, atmosfera dinâmica)
  audioDescription?: string // Descrição de SFX ou atmosfera sonora
  audioDescriptionVolume?: number // Volume do SFX em dB para mixagem (-24 a -6, default -12)
  characterRef?: string | null // ID do DossierPerson para referência visual de personagem
  estimatedDuration: number // em segundos
}

export interface BackgroundMusic {
  prompt: string // Prompt para Stable Audio 2.5 (gênero, instrumentos, BPM, mood)
  volume: number // Volume em dB para mixagem (-24 a -6)
}

export interface BackgroundMusicTrack {
  prompt: string // Prompt para Stable Audio 2.5 (gênero, instrumentos, BPM, mood)
  volume: number // Volume em dB para mixagem (-24 a -6)
  startScene: number // Cena onde esta track começa (0 = primeira cena)
  endScene: number | null // Última cena desta track (null = até a última cena)
}

export interface ScriptGenerationResponse {
  title: string
  summary: string // Sinopse expandida da história (2-3 parágrafos)
  fullText: string
  scenes: ScriptScene[]
  backgroundMusic?: BackgroundMusic // Música única para todo o vídeo (TikTok/Instagram) - Regra: "video todo"
  backgroundMusicTracks?: BackgroundMusicTrack[] // Lista de tracks com timestamps (YouTube Cinematic)
  wordCount: number
  estimatedDuration: number
  provider: string
  model: string

  // Token usage real retornado pela API (para cálculo de custo preciso)
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }

  costInfo: ProviderCostInfo
}

export interface IScriptGenerator {
  generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse>
  getName(): string
}

// =============================================================================
// TEXT-TO-SPEECH (ElevenLabs, OpenAI TTS, etc.)
// =============================================================================

export interface TTSRequest {
  text: string
  voiceId: string
  language?: string
  /** ElevenLabs voice_settings.speed (oficial: 0.7 a 1.2). */
  speed?: number
  /** ElevenLabs model_id (ex: "eleven_v3", "eleven_multilingual_v2"). */
  modelId?: string
  /**
   * ElevenLabs stability.
   * Observação: a API pode aceitar somente {0.0, 0.5, 1.0} (Creative/Natural/Robust).
   * Mantemos como number para compatibilidade e normalizamos no provider.
   */
  stability?: number
  similarity?: number // 0 a 1
}

/** Alignment de caracteres retornado pelo ElevenLabs /with-timestamps */
export interface TTSCharacterAlignment {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

/** Word-level timestamps derivados do alignment de caracteres */
export interface TTSWordTiming {
  word: string
  startTime: number   // em segundos
  endTime: number     // em segundos
}

export interface TTSResponse {
  audioBuffer: Buffer
  duration: number // em segundos
  provider: string
  format: 'mp3' | 'wav' | 'ogg'

  /** Alignment por caractere (direto da API ElevenLabs /with-timestamps) */
  alignment?: TTSCharacterAlignment | null

  /** Word-level timestamps derivados do alignment de caracteres */
  wordTimings?: TTSWordTiming[] | null

  costInfo: ProviderCostInfo
}

export interface VoiceListOptions {
  cursor?: string
  pageSize?: number
  search?: string
}

export interface VoiceListResponse {
  voices: VoiceOption[]
  nextCursor?: string
}

export interface ITTSProvider {
  synthesize(request: TTSRequest): Promise<TTSResponse>
  getAvailableVoices(options?: VoiceListOptions): Promise<VoiceListResponse>
  getName(): string
}

export interface VoiceOption {
  id: string
  name: string
  language: string
  preview_url?: string
}

// =============================================================================
// IMAGE GENERATION (Stable Diffusion, Midjourney, DALL-E)
// =============================================================================

export interface ImageGenerationRequest {
  prompt: string
  negativePrompt?: string
  width: number
  height: number
  /** Chave curta (cinematic, photorealistic...) ou baseStyle completo de visual-styles (âncora de estilo no prompt) */
  style?: string
  seed?: number
  numVariants?: number // Quantas variantes gerar
  aspectRatio?: string // Formato das imagens (ex: "16:9", "9:16")
  /** Buffer da imagem de referência (start image) para guiar a geração — usado no Photon Flash image_reference */
  imageReference?: Buffer
  /** Peso da referência visual (0.0-1.0). Controla quanto a imagem de referência influencia o resultado. Default: 0.5 */
  imageReferenceWeight?: number
}

export interface GeneratedImage {
  buffer: Buffer
  width: number
  height: number
  seed?: number
  revisedPrompt?: string
}

export interface ImageGenerationResponse {
  images: GeneratedImage[]
  provider: string
  model: string
  predictTime?: number // Tempo real de GPU em segundos (retornado pela API)
  costInfo: ProviderCostInfo
}

export interface IImageGenerator {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse>
  getName(): string
}

// =============================================================================
// MOTION GENERATION (Stable Video Diffusion, Runway, Luma)
// =============================================================================

export interface MotionGenerationRequest {
  imagePath?: string // Caminho local ou URL da imagem de origem (deprecated)
  imageBuffer?: Buffer // Buffer da imagem (preferido)
  endImageBuffer?: Buffer // Buffer da imagem final (last_image para Wan 2.2 — keyframe final)
  duration?: number // Duração desejada (2-4s geralmente)
  motionBucketId?: number // Intensidade do movimento (1-255, default 127)
  noiseAugStrength?: number // Fidelidade à imagem (0-1, default 0.1)
  prompt?: string // Alguns modelos aceitam prompt de texto auxiliar
  negativePrompt?: string
  aspectRatio?: string // Formato do vídeo (ex: "16:9", "9:16")
  guidanceScale?: number // Controle de fidelidade ao prompt
  numInferenceSteps?: number // Número de passos do modelo
}

export interface GeneratedMotion {
  videoBuffer: Buffer
  duration: number
  format: 'mp4' | 'gif'
  seed?: number
}

export interface MotionGenerationResponse {
  video: GeneratedMotion
  provider: string
  model: string
  predictTime?: number // Tempo real de GPU em segundos (retornado pela API)
  costInfo: ProviderCostInfo
}

export interface IMotionProvider {
  generate(request: MotionGenerationRequest): Promise<MotionGenerationResponse>
  getName(): string
}

// =============================================================================
// VIDEO RENDERING (FFmpeg wrapper)
// =============================================================================

export interface RenderRequest {
  scenes: RenderScene[]
  audioPath: string
  outputPath: string
  resolution: { width: number; height: number }
  fps: number
  includeSubtitles?: boolean
  subtitlesStyle?: SubtitlesStyle
}

export interface RenderScene {
  imagePath: string
  startTime: number
  endTime: number
  transition?: 'fade' | 'crossfade' | 'none'
  kenBurns?: KenBurnsEffect
}

export interface KenBurnsEffect {
  enabled: boolean
  zoomStart: number
  zoomEnd: number
  panX?: number
  panY?: number
}

export interface SubtitlesStyle {
  fontFamily: string
  fontSize: number
  color: string
  backgroundColor?: string
  position: 'bottom' | 'top'
}

export interface RenderProgress {
  percent: number
  currentFrame: number
  totalFrames: number
  eta: number // segundos restantes
}

export interface RenderResponse {
  outputPath: string
  duration: number
  fileSize: number
}

export interface IVideoRenderer {
  render(request: RenderRequest, onProgress?: (progress: RenderProgress) => void): Promise<RenderResponse>
  getName(): string
}

// =============================================================================
// MUSIC GENERATION (Stable Audio 2.5 via Replicate)
// =============================================================================

export interface MusicGenerationRequest {
  prompt: string           // Descrição técnica da música (vem direto da LangChain)
  duration: number         // Duração em segundos (máximo 190s)
  seed?: number            // Para reprodutibilidade
  steps?: number           // 4-8 (qualidade vs velocidade)
  cfgScale?: number        // 1-25 (aderência ao prompt)
}

export interface MusicGenerationResponse {
  audioBuffer: Buffer
  duration: number         // Duração real do áudio gerado
  format: 'mp3' | 'wav'
  provider: string
  model: string
  predictTime?: number     // Tempo real de GPU em segundos (retornado pela API)
  costInfo: ProviderCostInfo
}

export interface IMusicProvider {
  generate(request: MusicGenerationRequest): Promise<MusicGenerationResponse>
  getName(): string
}

// =============================================================================
// PROVIDER FACTORY
// =============================================================================

// =============================================================================
// SFX GENERATION (ElevenLabs Sound Effects)
// =============================================================================

export interface SFXGenerationRequest {
  prompt: string           // Descrição do SFX em inglês (vem do audioDescription)
  durationSeconds?: number // Duração em segundos (0.1-30, auto se omitido)
  promptInfluence?: number // 0-1, aderência ao prompt (default 0.3)
}

export interface SFXGenerationResponse {
  audioBuffer: Buffer
  duration: number         // Duração real do áudio gerado
  format: 'mp3' | 'wav'
  provider: string
  model: string
  costInfo: ProviderCostInfo
}

export interface ISFXProvider {
  generate(request: SFXGenerationRequest): Promise<SFXGenerationResponse>
  getName(): string
}

export type ProviderType = 'script' | 'tts' | 'image' | 'video' | 'motion' | 'music' | 'sfx'

export interface ProviderConfig {
  type: ProviderType
  name: string
  apiKey?: string
  model?: string
  baseUrl?: string
  settings?: Record<string, unknown>
}
