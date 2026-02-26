/**
 * POST /api/outputs/:id/refine-outline
 *
 * Refines the existing story outline using Retention QA structural feedback.
 * Loads QA results + current outline, converts scene-level problems into
 * outline-level corrections via formatRetentionQAForArchitect(), and
 * regenerates the outline with the architect-targeted feedback.
 *
 * The new outline is saved in StoryOutlineProduct with StageGate(STORY_OUTLINE) = PENDING_REVIEW.
 *
 * Body: { useRetentionQA?: boolean (default true), feedback?: string }
 */

import { prisma } from '../../../utils/prisma'
import { executeOutlineGeneration } from '../../../services/outline-generation.service'
import { formatRetentionQAForArchitect } from '../../../utils/format-qa-for-architect'
import type { StoryOutline } from '../../../services/story-architect.service'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })

  const body = await readBody(event).catch(() => ({}))
  const useRetentionQA = body?.useRetentionQA !== false // default true
  const userFeedback = body?.feedback as string | undefined

  // Load existing QA + outline from product tables
  const output = await prisma.output.findUnique({
    where: { id: outputId },
    select: { id: true }
  })

  if (!output) throw createError({ statusCode: 404, message: 'Output not found' })

  const [retentionQAProduct, storyOutlineProduct] = await Promise.all([
    prisma.retentionQAProduct.findUnique({ where: { outputId }, select: { analysisData: true } }),
    prisma.storyOutlineProduct.findUnique({ where: { outputId }, select: { outlineData: true } }),
  ])

  // Build combined feedback
  const feedbackParts: string[] = []

  if (useRetentionQA) {
    if (!retentionQAProduct?.analysisData || !storyOutlineProduct?.outlineData) {
      throw createError({
        statusCode: 400,
        message: 'Retention QA e story outline são necessários para refinamento com QA. Execute o Retention QA primeiro.'
      })
    }

    const qaResult = retentionQAProduct.analysisData as any
    const outline = storyOutlineProduct.outlineData as unknown as StoryOutline
    const architectFeedback = formatRetentionQAForArchitect(qaResult, outline)

    if (architectFeedback) {
      feedbackParts.push(architectFeedback)
    }
  }

  if (userFeedback) {
    feedbackParts.push(userFeedback)
  }

  if (feedbackParts.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Nenhum feedback disponível. Execute o Retention QA primeiro ou forneça feedback manual.'
    })
  }

  const combinedFeedback = feedbackParts.join('\n\n')

  console.log(`[API] Refining outline for Output ${outputId} with ${useRetentionQA ? 'Retention QA' : ''}${userFeedback ? ' + user feedback' : ''} feedback`)

  try {
    const result = await executeOutlineGeneration({
      outputId,
      feedback: combinedFeedback,
    })

    return {
      success: true,
      outline: result.outline,
      usage: result.usage,
      model: result.model,
      refinedWithQA: useRetentionQA,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('[API] Outline refinement failed:', error)
    throw createError({ statusCode: 500, message: error.message || 'Failed to refine outline' })
  }
})
