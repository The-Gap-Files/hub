import { prisma } from '../../../utils/prisma'
import { getVisualStyleById } from '../../../constants/cinematography/visual-styles'
import { getScriptStyleById } from '../../../constants/storytelling/script-styles'
import { getClassificationById } from '../../../constants/content/intelligence-classifications'
import { formatOutlineForPrompt, type StoryOutline } from '../../../services/story-architect.service'
import { mapPersonsFromPrisma, mapNeuralInsightsFromNotes } from '../../../utils/format-intelligence-context'
import { scriptGenerationStage } from '../../../services/pipeline/stages/script-generation.stage'
import { executeOutlineGeneration } from '../../../services/outline-generation.service'
import { formatRetentionQAForArchitect } from '../../../utils/format-qa-for-architect'
import type { ScriptGenerationRequest } from '../../../types/ai-providers'

// =============================================================================
// HELPERS
// =============================================================================

function formatRetentionQAFeedback(retentionQA: any): string {
  const qa = retentionQA
  if (!qa?.sceneAnalysis) return ''

  const riskFlagLabels: Record<string, string> = {
    slow: 'ritmo lento',
    expository: 'exposição sem emoção',
    confusing: 'confuso/denso demais',
    low_energy: 'baixa energia',
    redundant: 'redundante',
  }

  const problemScenes = qa.sceneAnalysis
    .filter((s: any) => s.retentionScore < 6)
    .sort((a: any, b: any) => a.retentionScore - b.retentionScore)

  const lines: string[] = [
    `🔍 FEEDBACK DE RETENÇÃO VIRAL (PRIORIDADE ALTA):`,
    `Score geral do roteiro anterior: ${qa.overallScore}/10`,
    qa.summary ? `Resumo: ${qa.summary}` : '',
    '',
  ]

  if (problemScenes.length > 0) {
    lines.push(`⚠️ CENAS COM PROBLEMAS (score < 6) — CORRIJA ESTAS:`)
    for (const scene of problemScenes) {
      const flags = (scene.riskFlags || []).map((f: string) => riskFlagLabels[f] || f).join(', ')
      const suggestions = (scene.suggestions || []).join('; ')
      lines.push(`  - Cena ${scene.sceneOrder} (score ${scene.retentionScore}/10): [${flags}]`)
      if (suggestions) lines.push(`    → Sugestões: ${suggestions}`)
    }
    lines.push('')
  }

  const goodScenes = qa.sceneAnalysis.filter((s: any) => s.retentionScore >= 7)
  if (goodScenes.length > 0) {
    lines.push(`✅ CENAS BEM AVALIADAS (score >= 7) — PRESERVE a essência destas:`)
    lines.push(`  Cenas: ${goodScenes.map((s: any) => s.sceneOrder).join(', ')}`)
    lines.push('')
  }

  lines.push(
    `📋 INSTRUÇÕES DE CORREÇÃO:`,
    `- Reescreva as cenas problemáticas corrigindo os riscos apontados acima`,
    `- Mantenha a narrativa e tom das cenas que funcionaram bem`,
    `- Hook (primeira cena) DEVE ter energia alta — score alvo 8+`,
    `- Aplique pattern interrupts visuais/narrativos a cada 3-5 cenas`,
    `- Insira micro-payoffs (revelações parciais) a cada 8-12 segundos`,
    `- Evite cenas consecutivas com o mesmo ritmo emocional`,
    `- Últimas cenas devem manter energia — NÃO desacelere para CTA genérico`,
  )

  return lines.filter(l => l !== undefined).join('\n')
}

function buildAdditionalContext(body: any, retentionQAData: any): string {
  const parts: string[] = []

  if (body.useRetentionQA && retentionQAData) {
    parts.push(formatRetentionQAFeedback(retentionQAData))
  }

  if (body.feedback) {
    parts.push(`⚠️ SOLICITAÇÃO DE REVISÃO DO USUÁRIO (ALTA PRIORIDADE):\nO usuário solicitou alterações específicas no roteiro anterior. Siga estritamente estas instruções:\n"${body.feedback}"`)
  }

  return parts.join('\n\n')
}

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })
  if (!body.feedback && !body.useRetentionQA && !body.refineOutline) {
    throw createError({ statusCode: 400, message: 'Feedback instruction, useRetentionQA, or refineOutline flag required' })
  }

  const refineOutline = body.refineOutline === true

  console.log(`[API] Regenerating script for Output ${outputId}${refineOutline ? ' (refining outline first)' : ''}${body.useRetentionQA ? ' (with Retention QA feedback)' : ''} feedback: "${body.feedback || '(auto from QA)'}"`)

  // 1. Buscar Output com dependencias completas do Dossier (incluindo persons)
  const output: any = await prisma.output.findUnique({
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

  // Load product tables
  const [retentionQAProduct, storyOutlineProduct, monetizationProduct, writerGate, existingScript] = await Promise.all([
    prisma.retentionQAProduct.findUnique({ where: { outputId }, select: { analysisData: true } }),
    prisma.storyOutlineProduct.findUnique({ where: { outputId }, select: { outlineData: true } }),
    prisma.monetizationProduct.findUnique({ where: { outputId }, select: { contextData: true } }),
    prisma.stageGate.findUnique({ where: { outputId_stage: { outputId, stage: 'WRITER' } }, select: { status: true } }),
    prisma.script.findUnique({ where: { outputId }, select: { writerProse: true } }),
  ])

  const retentionQAData = retentionQAProduct?.analysisData as any
  let currentOutlineData = storyOutlineProduct?.outlineData as any
  const monetizationContext = (monetizationProduct?.contextData as any) || {}

  // ── Inline outline refinement (when refineOutline=true) ──────────────
  // Regenerates the outline with QA-derived structural feedback BEFORE
  // regenerating the script, so the Writer/Screenwriter work from corrected beats.
  if (refineOutline && retentionQAData && currentOutlineData) {
    console.log(`[API] Refining outline before script regeneration...`)

    const qaFeedback = formatRetentionQAForArchitect(
      retentionQAData,
      currentOutlineData as unknown as StoryOutline
    )
    const combinedFeedback = body.feedback
      ? `${qaFeedback}\n\n⚠️ FEEDBACK ADICIONAL DO USUÁRIO: ${body.feedback}`
      : qaFeedback

    // Regenerate outline with structural QA feedback
    await executeOutlineGeneration({ outputId: outputId!, feedback: combinedFeedback })

    // Auto-approve the refined outline (user requested full pipeline correction)
    await prisma.stageGate.upsert({
      where: { outputId_stage: { outputId, stage: 'STORY_OUTLINE' } },
      create: { outputId, stage: 'STORY_OUTLINE', status: 'APPROVED', reviewedAt: new Date() },
      update: { status: 'APPROVED', reviewedAt: new Date() },
    })

    // Reload outline from product table
    const refreshed = await prisma.storyOutlineProduct.findUnique({
      where: { outputId },
      select: { outlineData: true }
    })
    if (refreshed?.outlineData) {
      currentOutlineData = refreshed.outlineData
    }

    console.log(`[API] Outline refined and auto-approved. Proceeding to script generation...`)
  }

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
    targetDuration: monetizationContext.sceneCount
      ? monetizationContext.sceneCount * 5
      : (output.duration || 300),
    targetSceneCount: monetizationContext.sceneCount,
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
    visualScreenwriterHints: visualStyle?.screenwriterHints || undefined,
    additionalContext: buildAdditionalContext(body, retentionQAData),
    mustInclude: output.mustInclude || undefined,
    mustExclude: output.mustExclude || undefined,
    persons: mapPersonsFromPrisma(dossier.persons),
    neuralInsights: mapNeuralInsightsFromNotes(dossier.notes),
    storyOutline: currentOutlineData
      ? formatOutlineForPrompt(currentOutlineData as unknown as StoryOutline)
      : undefined,
  }

  // Carregar writerProse aprovada — se existir, injeta no context para pular o Writer
  const approvedWriterProse = writerGate?.status === 'APPROVED' && existingScript?.writerProse
    ? existingScript.writerProse
    : null
  if (approvedWriterProse) {
    promptContext.writerProse = approvedWriterProse
    console.log(`[API] Writer prose aprovada encontrada (${approvedWriterProse.split(/\s+/).length} palavras) — Screenwriter usará prosa existente.`)
  }

  const outlineData = (currentOutlineData || {}) as StoryOutline & {
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
