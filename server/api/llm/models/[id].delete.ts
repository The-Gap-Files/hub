/**
 * DELETE /api/llm/models/:id — Remove um model
 */
import { prisma } from '../../../utils/prisma'
import { invalidateMediaCache } from '../../../services/media/media-factory'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Model ID é obrigatório'
    })
  }

  // Verificar se o model existe
  const existing = await prisma.llmModel.findUnique({ where: { id } })
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: `Model "${id}" não encontrado`
    })
  }

  await prisma.llmModel.delete({ where: { id } })

  invalidateMediaCache()
  console.log(`[LLM API] DELETE /models/${id} — Model removido`)

  return { success: true }
})
