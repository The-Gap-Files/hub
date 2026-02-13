import { createLlmForTask } from '../../../services/llm/llm-factory'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')
  if (!dossierId) {
    throw createError({ statusCode: 400, statusMessage: 'Dossier ID obrigatório' })
  }

  // Buscar dados básicos do dossiê
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { title: true, theme: true, tags: true }
  })

  if (!dossier) {
    throw createError({ statusCode: 404, statusMessage: 'Dossiê não encontrado' })
  }

  const llm = await createLlmForTask('creative-direction', { temperature: 0.4 })

  const prompt = `You are a visual intelligence analyst cataloging evidence for a documentary investigation dossier.

DOSSIER CONTEXT:
- Title: "${dossier.title}"
- Theme: "${dossier.theme || 'N/A'}"
- Tags: ${(dossier.tags as string[])?.join(', ') || 'none'}

An image has just been pasted/uploaded to act as visual reference material for this investigation.

Generate a concise asset identifier and classification tags for this image.

Rules:
- The identifier should be a short, descriptive codename in English (3-5 words max, use underscores). It should feel like a classified document label.
- Tags should be 3-5 relevant keywords in English, lowercase, separated by commas. They should reflect the likely visual content categories relevant to this dossier topic.
- Be creative but contextually accurate based on the dossier topic.

Respond ONLY in this exact format (no markdown, no explanation):
IDENTIFIER: <identifier>
TAGS: <tag1>, <tag2>, <tag3>`

  const response = await llm.invoke(prompt)
  const text = typeof response.content === 'string'
    ? response.content
    : (response.content as any[]).map((c: any) => c.text || '').join('')

  // Parse response
  const identifierMatch = text.match(/IDENTIFIER:\s*(.+)/i)
  const tagsMatch = text.match(/TAGS:\s*(.+)/i)

  return {
    identifier: identifierMatch?.[1]?.trim() || `Asset_${Date.now().toString(36)}`,
    tags: tagsMatch?.[1]?.trim() || ''
  }
})
