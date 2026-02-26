/**
 * Output Pipeline Service — Slim Orchestrator
 *
 * Orchestrates the content generation pipeline by delegating each stage
 * to its own isolated module under ./stages/.
 *
 * Each public method is a thin wrapper that loads context and delegates.
 * Business logic lives in the stage files.
 */

import type { ScriptGenerationRequest } from '../../types/ai-providers'
import type { PipelineStage, StageStatus } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { getVisualStyleById } from '../../constants/cinematography/visual-styles'
import { getScriptStyleById } from '../../constants/storytelling/script-styles'
import { getClassificationById } from '../../constants/content/intelligence-classifications'
import { formatOutlineForPrompt } from '../story-architect.service'
import type { StoryOutline } from '../story-architect.service'
import { mapPersonsFromPrisma, mapNeuralInsightsFromNotes } from '../../utils/format-intelligence-context'
import { videoPipelineService } from './video-pipeline.service'
import { createPipelineLogger } from '../../utils/pipeline-logger'

// ---- Stage imports -------------------------------------------------------
import { scriptGenerationStage } from './stages/script-generation.stage'
import { imageGenerationStage } from './stages/image-generation.stage'
import { musicGenerationStage } from './stages/music-generation.stage'
import { audioGenerationStage } from './stages/audio-generation.stage'
import { sfxGenerationStage } from './stages/sfx-generation.stage'
import { motionGenerationStage } from './stages/motion-generation.stage'
import { retentionQAStage } from './stages/retention-qa.stage'
import { musicEventsStage } from './stages/music-events.stage'

// --------------------------------------------------------------------------

export interface OutputPipelineResult {
  outputId: string
  status: 'completed' | 'failed'
  outputPath?: string
  message?: string
  error?: string
}

/** Helper: check if a stage is approved in the gates map */
function isStageApproved(gates: Map<PipelineStage, StageStatus>, stage: PipelineStage): boolean {
  return gates.get(stage) === 'APPROVED'
}

export class OutputPipelineService {
  /**
   * Full pipeline execution (render only — all stages must be pre-approved).
   */
  async execute(outputId: string): Promise<OutputPipelineResult> {
    const log = createPipelineLogger({ stage: 'Pipeline', outputId })
    log.info('Render solicitado; validando aprovações.')
    try {
      const output = await this.loadOutputContext(outputId)
      const gates = output._gatesMap

      log.info('Aprovações (StageGate)', {
        script: gates.get('SCRIPT'),
        images: gates.get('IMAGES'),
        audio: gates.get('AUDIO'),
        motion: gates.get('MOTION')
      })

      if (!isStageApproved(gates, 'SCRIPT')) throw new Error('Aprovação pendente: Roteiro')
      if (!isStageApproved(gates, 'IMAGES')) throw new Error('Aprovação pendente: Imagens (Visual)')
      if (!isStageApproved(gates, 'AUDIO')) throw new Error('Aprovação pendente: Áudio (Narração)')
      if (!isStageApproved(gates, 'MOTION')) throw new Error('Aprovação pendente: Motion (Vídeos)')

      await this.logExecution(outputId, 'render', 'started', 'Renderizando Master...')
      await this.renderVideo(outputId)

      return { outputId, status: 'completed' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.output.update({
        where: { id: outputId },
        data: { status: 'FAILED', errorMessage }
      })

      await this.logExecution(outputId, 'pipeline', 'failed', errorMessage)

      return { outputId, status: 'failed', error: errorMessage }
    }
  }

  /**
   * Loads the full output context with dossier, styles, classification, stage gates, and products.
   * Returns enriched output with _gatesMap for quick lookups.
   */
  public async loadOutputContext(outputId: string) {
    const output = await prisma.output.findUnique({
      where: { id: outputId },
      include: {
        dossier: {
          include: {
            sources: { orderBy: { order: 'asc' } },
            images: { orderBy: { order: 'asc' } },
            notes: { orderBy: { order: 'asc' } },
            persons: { orderBy: { order: 'asc' } }
          }
        },
        seed: true,
        stageGates: true,
        storyOutlineData: true,
        monetizationData: true,
        retentionQAData: true,
      }
    })

    if (!output) throw new Error('Output não encontrado')

    const scriptStyle = output.scriptStyleId ? getScriptStyleById(output.scriptStyleId) : undefined
    const visualStyle = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined
    const classification = output.classificationId ? getClassificationById(output.classificationId) : undefined

    // Build gates map for quick lookups
    const _gatesMap = new Map<PipelineStage, StageStatus>()
    for (const gate of output.stageGates) {
      _gatesMap.set(gate.stage, gate.status)
    }

    return { ...output, scriptStyle, visualStyle, classification, _gatesMap }
  }

  // ---- Script Generation -------------------------------------------------

  public async generateScript(outputId: string) {
    const output = await this.loadOutputContext(outputId)
    const dossier = output.dossier
    const gates = output._gatesMap

    // Read outline from StoryOutlineProduct
    const outlineProduct = output.storyOutlineData
    if (!outlineProduct?.outlineData) {
      throw new Error('Plano narrativo não gerado. Gere o plano (Story Architect) na etapa anterior.')
    }
    if (!isStageApproved(gates, 'STORY_OUTLINE')) {
      throw new Error('Plano narrativo pendente de aprovação. Aprove antes de gerar o roteiro.')
    }

    // Load approved writer prose (if exists)
    const existingScript = await prisma.script.findUnique({
      where: { outputId },
      select: { writerProse: true },
    })
    const approvedWriterProse = isStageApproved(gates, 'WRITER') && existingScript?.writerProse
      ? existingScript.writerProse
      : undefined

    const outlineData = outlineProduct.outlineData as StoryOutline & { _monetizationMeta?: any, _customScenes?: any[], _selectedHookLevel?: string }

    // Read monetization from MonetizationProduct
    const monetizationContext = output.monetizationData?.contextData as any

    const promptContext: ScriptGenerationRequest = {
      theme: dossier.theme,
      visualIdentityContext: dossier.visualIdentityContext || undefined,
      language: output.language || 'pt-BR',
      narrationLanguage: output.narrationLanguage || 'pt-BR',
      sources: dossier.sources?.map((s: any) => ({
        title: s.title, content: s.content, type: s.sourceType, weight: s.weight ?? 1.0,
      })) || [],
      userNotes: dossier.notes?.map((n: any) => n.content) || [],
      visualReferences: dossier.images?.map((i: any) => i.description) || [],
      images: dossier.images?.map((i: any) => ({
        data: i.imageData, mimeType: i.mimeType || 'image/jpeg', title: i.description,
      })).filter((img: any) => img.data) || [],
      researchData: dossier.researchData,
      dossierCategory: output.classificationId || undefined,
      musicGuidance: output.classificationId ? getClassificationById(output.classificationId)?.musicGuidance : undefined,
      musicMood: output.classificationId ? getClassificationById(output.classificationId)?.musicMood : undefined,
      visualGuidance: output.classificationId ? getClassificationById(output.classificationId)?.visualGuidance : undefined,
      targetDuration: monetizationContext?.sceneCount
        ? monetizationContext.sceneCount * 5
        : (output.duration || 300),
      targetSceneCount: monetizationContext?.sceneCount,
      targetWPM: output.targetWPM || 150,
      outputType: output.outputType,
      format: output.format,
      scriptStyleDescription: output.scriptStyle?.description,
      scriptStyleInstructions: output.scriptStyle?.instructions,
      visualStyleName: output.visualStyle?.name,
      visualStyleDescription: output.visualStyle?.description,
      visualBaseStyle: output.visualStyle?.baseStyle || undefined,
      visualLightingTags: output.visualStyle?.lightingTags || undefined,
      visualAtmosphereTags: output.visualStyle?.atmosphereTags || undefined,
      visualCompositionTags: output.visualStyle?.compositionTags || undefined,
      visualColorPalette: output.visualStyle?.colorPalette || undefined,
      visualQualityTags: output.visualStyle?.qualityTags || undefined,
      visualGeneralTags: output.visualStyle?.tags || undefined,
      visualScreenwriterHints: output.visualStyle?.screenwriterHints || undefined,
      additionalContext: output.objective
        ? `🎯 OBJETIVO EDITORIAL (CRÍTICO - GOVERNA TODA A NARRATIVA):\n${output.objective}`
        : undefined,
      mustInclude: output.mustInclude || undefined,
      mustExclude: output.mustExclude || undefined,
      persons: mapPersonsFromPrisma(dossier.persons),
      neuralInsights: mapNeuralInsightsFromNotes(dossier.notes),
      storyOutline: formatOutlineForPrompt(outlineData),
    }

    // Inject approved writer prose
    if (approvedWriterProse) {
      promptContext.writerProse = approvedWriterProse
    }

    const result = await scriptGenerationStage.execute({
      outputId,
      promptContext,
      outlineData,
      visualStyle: output.visualStyle,
      visualIdentityContext: dossier.visualIdentityContext,
      outputDuration: output.duration,
      mode: 'generate',
    })

    return { id: result.scriptId }
  }

  // ---- Retention QA (Stage 2.5) -------------------------------------------

  public async generateRetentionQA(outputId: string) {
    await retentionQAStage.execute({ outputId })
  }

  // ---- Image Generation --------------------------------------------------

  public async generateImages(outputId: string) {
    const output = await this.loadOutputContext(outputId)

    await imageGenerationStage.execute({
      outputId,
      aspectRatio: output.aspectRatio,
      seed: output.seed?.value,
      visualStyle: output.visualStyle,
      storyOutline: output.storyOutlineData?.outlineData,
    })
  }

  // ---- Background Music --------------------------------------------------

  public async generateBackgroundMusic(outputId: string) {
    const output = await this.loadOutputContext(outputId)

    await musicGenerationStage.execute({
      outputId,
      outputDuration: output.duration,
    })
  }

  // ---- Audio (TTS Narration) ---------------------------------------------

  public async generateAudio(outputId: string) {
    const output = await this.loadOutputContext(outputId)

    if (!output.voiceId) {
      throw new Error('Voice ID is required. Please select a voice before generating output.')
    }

    const monetizationContext = output.monetizationData?.contextData

    await audioGenerationStage.execute({
      outputId,
      voiceId: output.voiceId,
      language: output.language || undefined,
      narrationLanguage: output.narrationLanguage || undefined,
      targetWPM: output.targetWPM || undefined,
      monetizationContext,
      duration: output.duration,
      ttsProvider: output.ttsProvider,
    })
  }

  // ---- SFX ---------------------------------------------------------------

  public async generateSFX(outputId: string) {
    await sfxGenerationStage.execute({ outputId })
  }

  // ---- Music Events (Stingers/Risers/Drops) ------------------------------

  public async generateMusicEvents(outputId: string) {
    await musicEventsStage.execute({ outputId })
  }

  // ---- Motion (Image-to-Video) -------------------------------------------

  public async generateMotion(outputId: string) {
    const output = await this.loadOutputContext(outputId)

    await motionGenerationStage.execute({
      outputId,
      aspectRatio: output.aspectRatio,
    })
  }

  public async regenerateSceneMotion(sceneId: string) {
    return motionGenerationStage.regenerateScene(sceneId)
  }

  // ---- Voice Change (delegates to audio stage) ---------------------------

  public async regenerateAudioWithVoice(outputId: string, newVoiceId: string) {
    console.log(`[OutputPipeline] Regenerating narration with new voice: ${newVoiceId}`)

    const currentTtsProvider = (await import('../providers')).providerManager.getTTSProvider().getName().toUpperCase()

    // Update voice config
    await prisma.output.update({
      where: { id: outputId },
      data: {
        voiceId: newVoiceId,
        ttsProvider: currentTtsProvider,
      }
    })

    // Reset downstream stage gates (AUDIO, MOTION, RENDER)
    await prisma.stageGate.updateMany({
      where: {
        outputId,
        stage: { in: ['AUDIO', 'MOTION', 'RENDER'] },
      },
      data: {
        status: 'NOT_STARTED',
        feedback: null,
        reviewedAt: null,
      },
    })

    const deleted = await prisma.audioTrack.deleteMany({
      where: { outputId, type: 'scene_narration' }
    })
    console.log(`[OutputPipeline] ${deleted.count} narration audio(s) deleted`)

    await this.generateAudio(outputId)

    console.log(`[OutputPipeline] Narration regenerated with voice ${newVoiceId}`)
  }

  // ---- Correction Mode ---------------------------------------------------

  public async enterCorrectionMode(outputId: string) {
    console.log(`[OutputPipeline] Entering correction mode for Output ${outputId}`)

    const output = await prisma.output.findUnique({ where: { id: outputId } })
    if (!output) throw new Error('Output não encontrado')

    if (output.status !== 'COMPLETED' && output.status !== 'FAILED') {
      throw new Error('Somente outputs com status COMPLETED ou FAILED podem entrar em modo correção')
    }

    // Reset output status
    const updated = await prisma.output.update({
      where: { id: outputId },
      data: { status: 'DRAFT' }
    })

    // Reset IMAGES, MOTION stage gates to NOT_STARTED
    await prisma.stageGate.updateMany({
      where: {
        outputId,
        stage: { in: ['IMAGES', 'MOTION', 'RENDER'] },
      },
      data: {
        status: 'NOT_STARTED',
        feedback: null,
        reviewedAt: null,
      },
    })

    await this.logExecution(outputId, 'correction', 'started', 'Entered correction mode')

    return updated
  }

  // ---- Internal Helpers --------------------------------------------------

  private async renderVideo(outputId: string) {
    const log = createPipelineLogger({ stage: 'Pipeline', outputId })
    log.info('Starting final render (FFmpeg).')
    await this.logExecution(outputId, 'render', 'started', 'Iniciando renderização FFmpeg...')

    const result = await videoPipelineService.renderVideo(outputId)

    if (result.success) {
      log.info('Video rendered and saved.')
      await this.logExecution(outputId, 'render', 'completed', 'Video rendered and saved.')
    } else {
      log.error('Render failed.', result.error)
      await this.logExecution(outputId, 'render', 'failed', `Error: ${result.error}`)
      throw new Error(`Render failed: ${result.error}`)
    }
  }

  private async logExecution(outputId: string, step: string, status: string, message: string) {
    await prisma.pipelineExecution.create({
      data: { outputId, step, status, message }
    })
  }
}

export const outputPipelineService = new OutputPipelineService()
