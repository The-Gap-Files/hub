/**
 * Definições de tipos para os provedores de IA
 * Este arquivo define as interfaces que cada provedor deve implementar,
 * permitindo troca fácil de APIs no futuro.
 */

// =============================================================================
// SCRIPT GENERATION (OpenAI, Anthropic, Gemini)
// =============================================================================

export interface ScriptGenerationRequest {
  theme: string
  language: string
  targetDuration: number // em segundos
  style?: string // ID do estilo de roteiro
  scriptStyleInstructions?: string // Instruções do estilo de roteiro do banco
  visualStyle?: string
  visualStyleDescription?: string // Descrição do estilo visual do banco
  additionalContext?: string
  mustInclude?: string // O que deve ter no roteiro
  mustExclude?: string // O que NÃO deve ter no roteiro
}

export interface ScriptScene {
  order: number
  narration: string
  visualDescription: string
  estimatedDuration: number // em segundos
}

export interface ScriptGenerationResponse {
  title: string
  fullText: string
  scenes: ScriptScene[]
  wordCount: number
  estimatedDuration: number
  provider: string
  model: string
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
  speed?: number // 0.5 a 2.0
  stability?: number // 0 a 1
  similarity?: number // 0 a 1
}

export interface TTSResponse {
  audioBuffer: Buffer
  duration: number // em segundos
  provider: string
  format: 'mp3' | 'wav' | 'ogg'
}

export interface ITTSProvider {
  synthesize(request: TTSRequest): Promise<TTSResponse>
  getAvailableVoices(): Promise<VoiceOption[]>
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
  style?: 'cinematic' | 'photorealistic' | 'artistic' | 'documentary'
  seed?: number
  numVariants?: number // Quantas variantes gerar
  aspectRatio?: string // Formato das imagens (ex: "16:9", "9:16")
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
}

export interface IImageGenerator {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse>
  getName(): string
}

// =============================================================================
// MOTION GENERATION (Stable Video Diffusion, Runway, Luma)
// =============================================================================

export interface MotionGenerationRequest {
  imagePath: string // Caminho local ou URL da imagem de origem
  endImagePath?: string // Caminho local ou URL da imagem final (para transição)
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
// PROVIDER FACTORY
// =============================================================================

export type ProviderType = 'script' | 'tts' | 'image' | 'video' | 'motion'

export interface ProviderConfig {
  type: ProviderType
  name: string
  apiKey?: string
  model?: string
  baseUrl?: string
  settings?: Record<string, unknown>
}
