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
import { getScriptStyleById } from '../../../constants/script-styles'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })

  const body = await readBody(event).catch(() => ({}))
  const feedback = body?.feedback as string | undefined

  console.log(`[API] Generating story outline for Output ${outputId}${feedback ? ` with feedback: "${feedback}"` : ''}`)

  // 1. Buscar Output com Dossier
  const output = await prisma.output.findUnique({
    where: { id: outputId },
    include: {
      dossier: {
        include: {
          sources: true,
          notes: true
        }
      }
    }
  })

  if (!output || !output.dossier) {
    throw createError({ statusCode: 404, message: 'Output or Dossier not found' })
  }

  const dossier = output.dossier

  // 2. Verificar API key
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicApiKey) {
    throw createError({ statusCode: 500, message: 'ANTHROPIC_API_KEY not configured' })
  }

  // 3. Montar request
  const userNotes = dossier.notes?.map((n: any) => n.content) || []
  if (feedback) {
    userNotes.push(`⚠️ FEEDBACK DO USUÁRIO PARA O PLANO NARRATIVO: ${feedback}`)
  }

  try {
    const result = await generateStoryOutline({
      theme: dossier.theme,
      sources: dossier.sources?.map((s: any) => ({
        title: s.title,
        content: s.content,
        type: s.sourceType
      })) || [],
      userNotes,
      editorialObjective: output.objective || undefined,
      scriptStyleId: output.scriptStyleId || undefined,
      targetDuration: output.duration || 300,
      language: output.language || 'pt-BR'
    }, anthropicApiKey)

    // 4. Salvar outline no banco (novo plano = pendente de aprovação)
    await prisma.output.update({
      where: { id: outputId },
      data: { storyOutline: result.outline as any, storyOutlineApproved: false }
    })

    // 5. Registrar custo do plano (fire-and-forget) — resource 'outline', não 'script'
    const totalSourceChars = dossier.sources?.reduce((sum: number, s: any) => sum + (s.content?.length || 0), 0) || 0
    costLogService.logOutlineGeneration({
      outputId,
      provider: result.provider,
      model: result.model,
      inputCharacters: totalSourceChars,
      outputCharacters: JSON.stringify(result.outline).length,
      usage: result.usage,
      action: feedback ? 'recreate' : 'create',
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
