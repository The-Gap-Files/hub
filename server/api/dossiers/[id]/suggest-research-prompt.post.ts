/**
 * POST /api/dossiers/[id]/suggest-research-prompt
 * 
 * Gera um prompt otimizado para o Gemini Deep Research Agent,
 * baseado nos metadados do dossiê (título, tema, tags, fontes existentes).
 * 
 * O prompt é editável pelo usuário antes de ser enviado ao Deep Research.
 */

import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { generateDeepResearchPrompt } from '../../../services/deep-research-prompt.service'

const SuggestPromptSchema = z.object({
  language: z.enum(['pt-br', 'en']).optional().default('pt-br'),
  depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
  classificationId: z.string().max(50).optional()
})

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  const body = await readBody(event)
  const { language, depth, classificationId } = SuggestPromptSchema.parse(body)

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      sources: {
        select: { title: true },
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!dossier) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  const result = await generateDeepResearchPrompt({
    title: dossier.title,
    theme: dossier.theme,
    classificationId,
    tags: dossier.tags,
    existingSourceTitles: dossier.sources.map(s => s.title),
    language,
    depth
  })

  return {
    prompt: result.prompt,
    usage: result.usage,
    provider: result.provider,
    model: result.model
  }
})
