/**
 * POST /api/outputs/:id/generate-outline
 *
 * Generates (or regenerates) the narrative plan via Story Architect.
 * The outline is saved in Output.storyOutline and awaits approval.
 *
 * Body: { feedback?: string, monetizationContext?: MonetizationContextInput }
 */

import { executeOutlineGeneration } from '../../../services/outline-generation.service'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })

  const body = await readBody(event).catch(() => ({}))

  try {
    const result = await executeOutlineGeneration({
      outputId,
      feedback: body?.feedback,
      monetizationContext: body?.monetizationContext,
    })

    return {
      success: true,
      outline: result.outline,
      usage: result.usage,
      model: result.model,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('[API] Story Architect failed:', error)
    throw createError({ statusCode: 500, message: error.message || 'Failed to generate story outline' })
  }
})
