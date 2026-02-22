/**
 * Shared types for the 3-agent filmmaker pipeline:
 * Photographer → Choreographer → Cinematographer
 */

import type { StoryOutline } from '../story-architect.service'

// ─── Production Context (injected by pipeline) ────────────────────

export interface ProductionContext {
  /** Style tags already applied as anchor (e.g. "cinematic noir, high contrast") */
  styleAnchorTags?: string
  /** Dossier visual identity (e.g. "1970s urban realism, period-accurate interiors") */
  visualIdentity?: string
  /** Story Architect outline — calibrates intensity per narrative segment */
  storyOutline?: StoryOutline
  /** Creator-uploaded reference images for custom scenes */
  customSceneReferences?: Array<{
    sceneOrder: number
    description: string
    mimeType: string
    imagePrompt?: string | null
  }>
  /** Dossier theme — used for temporal context extraction */
  theme?: string
}

// ─── Scene Input (from script stage) ──────────────────────────────

export interface SceneInput {
  order: number
  narration: string
  currentVisual?: string
  currentMotion?: string
  currentEnvironment?: string
  estimatedDuration: number
}

// ─── Per-agent outputs ────────────────────────────────────────────

export interface PhotographerOutput {
  order: number
  visualDescription: string
  sceneEnvironment?: string
}

export interface ChoreographerOutput {
  order: number
  motionDescription: string
}

export interface CinematographerOutput {
  order: number
  endVisualDescription: string | null
  endImageReferenceWeight: number | null
}

// ─── Combined output (backwards-compatible with old RefinedScene) ─

export interface RefinedScene {
  order: number
  visualDescription: string
  motionDescription: string
  sceneEnvironment?: string
  endVisualDescription?: string | null
  endImageReferenceWeight?: number | null
}
