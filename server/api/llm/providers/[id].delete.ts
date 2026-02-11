/**
 * DELETE /api/llm/providers/:id — Remove um provider e todos os seus models
 *
 * Prisma cascade cuida da remoção dos models associados.
 */
import { prisma } from '../../../utils/prisma'
import { invalidateMediaCache } from '../../../services/media/media-factory'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Provider ID é obrigatório'
    })
  }

  // Verificar se o provider existe
  const existing = await prisma.llmProvider.findUnique({ where: { id } })
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: `Provider "${id}" não encontrado`
    })
  }

  await prisma.llmProvider.delete({ where: { id } })

  invalidateMediaCache()
  console.log(`[LLM API] DELETE /providers/${id} — Provider removido (cascade nos models)`)

  return { success: true }
})
