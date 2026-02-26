/**
 * POST /api/outputs/[id]/generate-writer
 *
 * Gera APENAS a prosa do Writer (etapa 1 do pipeline de roteiro).
 * Não roda o Screenwriter — a prosa precisa ser aprovada antes.
 *
 * Body: { feedback?: string }
 */

import { prisma } from '../../../utils/prisma'
import { getClassificationById } from '../../../constants/content/intelligence-classifications'
import { formatOutlineForPrompt } from '../../../services/story-architect.service'
import type { StoryOutline } from '../../../services/story-architect.service'
import { mapPersonsFromPrisma, mapNeuralInsightsFromNotes } from '../../../utils/format-intelligence-context'
import { callWriter } from '../../../services/pipeline/stages/_shared/call-writer'
import { scriptGenerationStage } from '../../../services/pipeline/stages/script-generation.stage'
import type { ScriptGenerationRequest } from '../../../types/ai-providers'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Output ID obrigatório' })

  const body = await readBody(event) || {}
  const feedback = body.feedback as string | undefined

  // Load output with full dossier context
  const output = await prisma.output.findUnique({
    where: { id },
    include: {
      dossier: {
        include: {
          sources: { orderBy: { order: 'asc' } },
          images: { orderBy: { order: 'asc' } },
          notes: { orderBy: { order: 'asc' } },
          persons: { orderBy: { order: 'asc' } },
        },
      },
      script: true,
    },
  })

  if (!output) throw createError({ statusCode: 404, message: 'Output não encontrado' })

  // Validate outline exists + approved via product tables and StageGate
  const [storyOutlineProduct, outlineGate] = await Promise.all([
    prisma.storyOutlineProduct.findUnique({ where: { outputId: id }, select: { outlineData: true } }),
    prisma.stageGate.findUnique({ where: { outputId_stage: { outputId: id, stage: 'STORY_OUTLINE' } }, select: { status: true } }),
  ])

  if (!storyOutlineProduct?.outlineData) throw createError({ statusCode: 400, message: 'Plano narrativo não gerado.' })
  if (outlineGate?.status !== 'APPROVED') throw createError({ statusCode: 400, message: 'Plano narrativo pendente de aprovação.' })

  const dossier = output.dossier
  const outlineData = storyOutlineProduct.outlineData as unknown as StoryOutline & { _monetizationMeta?: any; _customScenes?: any[]; _selectedHookLevel?: string }
  const classification = output.classificationId ? getClassificationById(output.classificationId) : undefined

  // Load monetization from product table
  const monetizationProduct = await prisma.monetizationProduct.findUnique({
    where: { outputId: id },
    select: { contextData: true },
  })
  const monetizationContext = (monetizationProduct?.contextData as any) || {}

  // Build promptContext (same as generateScript in pipeline service)
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
    musicGuidance: classification?.musicGuidance,
    musicMood: classification?.musicMood,
    visualGuidance: classification?.visualGuidance,
    targetDuration: monetizationContext.sceneCount
      ? monetizationContext.sceneCount * 5
      : (output.duration || 300),
    targetSceneCount: monetizationContext.sceneCount,
    targetWPM: output.targetWPM || 150,
    outputType: output.outputType,
    format: output.format,
    additionalContext: output.objective
      ? `🎯 OBJETIVO EDITORIAL (CRÍTICO — GOVERNA TODA A NARRATIVA):\n${output.objective}`
      : undefined,
    mustInclude: output.mustInclude || undefined,
    mustExclude: output.mustExclude || undefined,
    persons: mapPersonsFromPrisma(dossier.persons),
    neuralInsights: mapNeuralInsightsFromNotes(dossier.notes),
    storyOutline: formatOutlineForPrompt(outlineData),
  }

  // Apply enrichment + source filtering (reuse stage methods)
  scriptGenerationStage.enrichFromMonetizationMeta(promptContext, outlineData)
  await scriptGenerationStage.applySourceFiltering(promptContext, outlineData, id)

  // Add feedback as additional context if provided
  if (feedback?.trim()) {
    promptContext.additionalContext = [
      promptContext.additionalContext || '',
      `\n\n📝 FEEDBACK DO USUÁRIO SOBRE A PROSA ANTERIOR (CRÍTICO — SIGA ESTAS INSTRUÇÕES):\n${feedback.trim()}`,
    ].filter(Boolean).join('')
  }

  // Run ONLY the Writer stage
  console.log(`[GenerateWriter] 📝 Gerando prosa do Writer para output=${id}...`)
  const writerResult = await callWriter(promptContext, id)
  const wordCount = writerResult.prose.split(/\s+/).filter(Boolean).length

  console.log(`[GenerateWriter] ✅ Prosa gerada: ${wordCount} palavras`)

  // Persist writerProse in Script (create or update)
  const existingScript = output.script
  if (existingScript) {
    await prisma.script.update({
      where: { id: existingScript.id },
      data: { writerProse: writerResult.prose, updatedAt: new Date() },
    })
  } else {
    await prisma.script.create({
      data: {
        outputId: id,
        summary: '',
        fullText: '',
        wordCount: 0,
        provider: (writerResult.provider || 'GEMINI').toUpperCase() as any,
        modelUsed: writerResult.model,
        writerProse: writerResult.prose,
      },
    })
  }

  // Reset WRITER StageGate (new prose needs re-approval)
  await prisma.stageGate.upsert({
    where: { outputId_stage: { outputId: id, stage: 'WRITER' } },
    create: { outputId: id, stage: 'WRITER', status: 'PENDING_REVIEW', executedAt: new Date() },
    update: { status: 'PENDING_REVIEW', feedback: null, reviewedAt: null, executedAt: new Date() },
  })

  return {
    success: true,
    wordCount,
    provider: writerResult.provider,
    model: writerResult.model,
    usage: writerResult.usage,
  }
})
