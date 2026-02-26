/**
 * Retention QA — Types
 *
 * Stage 2.5: Análise de retenção viral do roteiro gerado.
 * Roda entre Script (Stage 2) e geração de assets (Stages 3-7).
 * Gera scores por cena, flags de risco e um Edit Blueprint que alimenta
 * stages downstream (imagens, motion, music events, render).
 */

// =============================================================================
// SCENE-LEVEL ANALYSIS
// =============================================================================

export interface SceneRetentionAnalysis {
  /** Ordem da cena (0-indexed, match com Scene.order) */
  sceneOrder: number
  /** Score de retenção 0-10 (10 = máximo engajamento) */
  retentionScore: number
  /** Flags de risco detectadas pela análise */
  riskFlags: Array<'slow' | 'expository' | 'confusing' | 'low_energy' | 'redundant'>
  /** Sugestões de melhoria para esta cena */
  suggestions: string[]
  /** Duração ideal sugerida em segundos */
  idealDuration: number
  /** Sugestão de pattern interrupt (se aplicável) */
  patternInterruptSuggestion?: string | null
}

// =============================================================================
// EDIT BLUEPRINT — Mapa editorial para stages downstream
// =============================================================================

export interface EditBlueprintCut {
  sceneOrder: number
  startSecond: number
  endSecond: number
  /** Duração ideal do corte para esta cena */
  idealCutDuration: number
}

export interface EditBlueprintPatternInterrupt {
  /** Segundo absoluto no vídeo */
  atSecond: number
  /** Tipo de interrupt visual */
  type: 'zoom' | 'whip_pan' | 'hard_cut' | 'smash_cut' | 'glitch' | 'freeze' | 'rack_focus' | 'speed_ramp'
  sceneOrder: number
  /** Razão editorial para este interrupt */
  reason: string
}

export interface EditBlueprintOnScreenText {
  sceneOrder: number
  /** Texto curto (até 10 palavras) */
  text: string
  /** Propósito editorial */
  purpose: 'hook' | 'emphasis' | 'data' | 'question' | 'cta'
}

export interface EditBlueprintMusicEvent {
  /** Segundo absoluto no vídeo */
  atSecond: number
  /** Tipo de evento musical */
  type: 'stinger' | 'riser' | 'silence' | 'drop'
  sceneOrder: number
  /** Prompt para gerar o SFX/stinger (quando type != silence) */
  prompt?: string
}

export interface EditBlueprintScenePriority {
  sceneOrder: number
  /** Tier de qualidade: hero = modelo premium, standard = padrão, simple = fast/cheap */
  tier: 'hero' | 'standard' | 'simple'
  /** Razão do ranking */
  reason: string
}

export interface EditBlueprint {
  /** Mapa de cortes por segundo */
  cutMap: EditBlueprintCut[]
  /** Pattern interrupts planejados */
  patternInterrupts: EditBlueprintPatternInterrupt[]
  /** Textos overlay planejados */
  onScreenTexts: EditBlueprintOnScreenText[]
  /** Eventos musicais (stingers, risers, silêncios) */
  musicEvents: EditBlueprintMusicEvent[]
  /** Ranking de prioridade por cena para tiering de qualidade */
  scenePriority: EditBlueprintScenePriority[]
}

// =============================================================================
// RETENTION QA RESULT (persisted in Output.retentionQA)
// =============================================================================

export interface RetentionQAResult {
  /** Score geral de retenção do roteiro (0-10) */
  overallScore: number
  /** Resumo executivo da análise */
  summary: string
  /** Análise detalhada por cena */
  sceneAnalysis: SceneRetentionAnalysis[]
  /** Edit Blueprint para stages downstream */
  editBlueprint: EditBlueprint
  /** Provider/modelo usado na análise */
  provider: string
  model: string
  /** Timestamp da análise */
  analyzedAt: string
}

// =============================================================================
// STAGE INPUT/OUTPUT
// =============================================================================

export interface RetentionQAStageInput {
  outputId: string
}

export interface RetentionQAStageResult {
  overallScore: number
  sceneCount: number
  highRiskScenes: number
  editBlueprintGenerated: boolean
}
