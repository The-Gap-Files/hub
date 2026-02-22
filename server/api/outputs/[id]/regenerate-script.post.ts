import { prisma } from '../../../utils/prisma'
import { getVisualStyleById } from '../../../constants/cinematography/visual-styles'
import { getScriptStyleById } from '../../../constants/storytelling/script-styles'
import { getClassificationById } from '../../../constants/content/intelligence-classifications'
import { formatOutlineForPrompt, type StoryOutline } from '../../../services/story-architect.service'
import { mapPersonsFromPrisma, mapNeuralInsightsFromNotes } from '../../../utils/format-intelligence-context'
import { scriptGenerationStage } from '../../../services/pipeline/stages/script-generation.stage'
import type { ScriptGenerationRequest } from '../../../types/ai-providers'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })
  if (!body.feedback) throw createError({ statusCode: 400, message: 'Feedback instruction required' })

  console.log(`[API] Regenerating script for Output ${outputId} with feedback: "${body.feedback}"`)

  // 1. Buscar Output com dependencias completas do Dossier (incluindo persons)
  const output = await prisma.output.findUnique({
    where: { id: outputId },
    include: {
      dossier: {
        include: {
          sources: { orderBy: { order: 'asc' } },
          notes: { orderBy: { order: 'asc' } },
          images: { orderBy: { order: 'asc' } },
          persons: { orderBy: { order: 'asc' } },
        }
      },
      seed: true
    }
  })

  if (!output || !output.dossier) {
    throw createError({ statusCode: 404, message: 'Output or Dossier not found' })
  }

  const dossier = output.dossier

  // Resolver estilos a partir das constantes
  const scriptStyle = output.scriptStyleId ? getScriptStyleById(output.scriptStyleId) : undefined
  const visualStyle = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined

  // 2. Reconstruir Prompt Context (identico ao pipeline, com feedback do usuario)
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
    targetDuration: (output.monetizationContext as any)?.sceneCount
      ? (output.monetizationContext as any).sceneCount * 5
      : (output.duration || 300),
    targetSceneCount: (output.monetizationContext as any)?.sceneCount,
    targetWPM: output.targetWPM || 150,
    outputType: output.outputType,
    format: output.format,
    scriptStyleDescription: scriptStyle?.description,
    scriptStyleInstructions: scriptStyle?.instructions,
    visualStyleName: visualStyle?.name,
    visualStyleDescription: visualStyle?.description,
    visualBaseStyle: visualStyle?.baseStyle || undefined,
    visualLightingTags: visualStyle?.lightingTags || undefined,
    visualAtmosphereTags: visualStyle?.atmosphereTags || undefined,
    visualCompositionTags: visualStyle?.compositionTags || undefined,
    visualColorPalette: visualStyle?.colorPalette || undefined,
    visualQualityTags: visualStyle?.qualityTags || undefined,
    visualGeneralTags: visualStyle?.tags || undefined,
    additionalContext: `\u26a0\ufe0f SOLICITA\u00c7\u00c3O DE REVIS\u00c3O DO USU\u00c1RIO (ALTA PRIORIDADE):\nO usu\u00e1rio solicitou altera\u00e7\u00f5es espec\u00edficas no roteiro anterior. Ignore as vers\u00f5es anteriores e gere um novo roteiro seguindo estritamente estas instru\u00e7\u00f5es:\n"${body.feedback}"`,
    mustInclude: output.mustInclude || undefined,
    mustExclude: output.mustExclude || undefined,
    persons: mapPersonsFromPrisma(dossier.persons),
    neuralInsights: mapNeuralInsightsFromNotes(dossier.notes),
    storyOutline: output.storyOutline
      ? formatOutlineForPrompt(output.storyOutline as unknown as StoryOutline)
      : undefined,
  }

  const outlineData = (output.storyOutline || {}) as StoryOutline & {
    _monetizationMeta?: any
    _customScenes?: any[]
    _selectedHookLevel?: string
  }

  try {
    // 3. Delegar ao stage isolado (cuida de enriquecimento, validacao, cineasta, persistencia)
    const result = await scriptGenerationStage.execute({
      outputId,
      promptContext,
      outlineData,
      visualStyle,
      visualIdentityContext: dossier.visualIdentityContext,
      outputDuration: output.duration,
      mode: 'regenerate',
    })

    return {
      success: true,
      message: 'Script regenerated successfully',
      validation: result.validation || undefined,
    }
  } catch (error: any) {
    console.error('[API] Script regeneration failed:', error)
    throw createError({ statusCode: 500, message: error.message || 'Failed to regenerate script' })
  }
})
