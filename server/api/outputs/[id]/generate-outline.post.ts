/**
 * POST /api/outputs/:id/generate-outline
 * 
 * Etapa isolada: gera (ou regenera) o plano narrativo via Story Architect (Sonnet).
 * O outline é salvo em Output.storyOutline e fica pendente de aprovação (storyOutlineApproved).
 * Só após aprovar o plano (approve-stage STORY_OUTLINE) o usuário pode gerar o roteiro (generate-script).
 * 
 * Body opcional: { feedback?: string } para regeneração com direção
 */

import { prisma } from '../../../utils/prisma'
import { generateStoryOutline } from '../../../services/story-architect.service'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'
import { getScriptStyleById } from '../../../constants/script-styles'
import { mapPersonsFromPrisma, mapNeuralInsightsFromNotes } from '../../../utils/format-intelligence-context'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })

  const body = await readBody(event).catch(() => ({}))
  const feedback = body?.feedback as string | undefined
  const monetizationContext = body?.monetizationContext as {
    itemType: 'teaser' | 'fullVideo'
    title: string
    hook: string
    angle: string
    angleCategory: string
    narrativeRole?: string
    scriptOutline?: string
    cta?: string
    strategicNotes?: string
    scriptStyleId?: string
    scriptStyleName?: string
    editorialObjectiveId?: string
    editorialObjectiveName?: string
    avoidPatterns?: string[]
  } | undefined

  console.log(`[API] Generating story outline for Output ${outputId}${feedback ? ` with feedback: "${feedback}"` : ''}${monetizationContext ? ` from monetization (${monetizationContext.itemType}: ${monetizationContext.angleCategory})` : ''}`)

  // 1. Buscar Output com Dossier
  const output = await prisma.output.findUnique({
    where: { id: outputId },
    include: {
      dossier: {
        include: {
          sources: true,
          notes: true,
          images: true,
          persons: { orderBy: { order: 'asc' } }
        }
      }
    }
  })

  if (!output || !output.dossier) {
    throw createError({ statusCode: 404, message: 'Output or Dossier not found' })
  }

  const dossier = output.dossier

  // 3. Montar request
  const userNotes = dossier.notes?.map((n: any) => n.content) || []
  if (feedback) {
    userNotes.push(`⚠️ FEEDBACK DO USUÁRIO PARA O PLANO NARRATIVO: ${feedback}`)
  }

  try {
    const result = await generateStoryOutline({
      theme: dossier.theme,
      visualIdentityContext: dossier.visualIdentityContext || undefined,
      sources: dossier.sources?.map((s: any) => ({
        title: s.title,
        content: s.content,
        type: s.sourceType,
        weight: s.weight ?? 1.0
      })) || [],
      userNotes,
      persons: mapPersonsFromPrisma(dossier.persons),
      neuralInsights: mapNeuralInsightsFromNotes(dossier.notes),
      imageDescriptions: dossier.images?.map((i: any) => i.description).filter(Boolean) || [],
      researchData: dossier.researchData || undefined,
      editorialObjective: output.objective || undefined,
      scriptStyleId: output.scriptStyleId || undefined,
      dossierCategory: output.classificationId || undefined,
      targetDuration: output.duration || 300,
      language: output.language || 'pt-BR',
      mustInclude: output.mustInclude || undefined,
      mustExclude: output.mustExclude || undefined,
      monetizationContext
    })

    // 4. Salvar outline no banco (enriquecido com metadados de monetização)
    const outlineToSave: any = { ...result.outline }
    if (monetizationContext) {
      outlineToSave._monetizationMeta = {
        narrativeRole: monetizationContext.narrativeRole,
        strategicNotes: monetizationContext.strategicNotes,
        angleCategory: monetizationContext.angleCategory,
        itemType: monetizationContext.itemType,
        scriptStyleId: monetizationContext.scriptStyleId,
        scriptStyleName: monetizationContext.scriptStyleName,
        editorialObjectiveId: monetizationContext.editorialObjectiveId,
        editorialObjectiveName: monetizationContext.editorialObjectiveName,
        avoidPatterns: monetizationContext.avoidPatterns,
      }
    }
    await prisma.output.update({
      where: { id: outputId },
      data: { storyOutline: outlineToSave as any, storyOutlineApproved: false }
    })

    // 5. Registrar custo do plano (fire-and-forget) — resource 'outline', não 'script'
    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const cost = calculateLLMCost(result.model, inputTokens, outputTokens)

    costLogService.log({
      outputId,
      resource: 'outline',
      action: feedback ? 'recreate' : 'create',
      provider: result.provider,
      model: result.model,
      cost,
      metadata: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
      detail: `Story Architect - ${result.outline.risingBeats.length} beats narrativos`
    }).catch(() => { })

    return {
      success: true,
      outline: result.outline,
      usage: result.usage,
      model: result.model
    }
  } catch (error: any) {
    console.error('[API] Story Architect failed:', error)
    throw createError({ statusCode: 500, message: error.message || 'Failed to generate story outline' })
  }
})
