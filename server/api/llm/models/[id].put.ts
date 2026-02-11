/**
 * PUT /api/llm/models/:id — Atualiza um model existente
 *
 * Body: { name?, contextWindow?, costTier?, supportsStructuredOutput?, supportsVision?, isActive? }
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

  const body = await readBody(event)
  const {
    name,
    contextWindow,
    costTier,
    supportsStructuredOutput,
    supportsVision,
    isActive,
    inputSchema: rawInputSchema
  } = body as {
    name?: string
    contextWindow?: number
    costTier?: number
    supportsStructuredOutput?: boolean
    supportsVision?: boolean
    isActive?: boolean
    inputSchema?: string | Record<string, unknown> | null
  }

  // Verificar se o model existe
  const existing = await prisma.llmModel.findUnique({ where: { id } })
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: `Model "${id}" não encontrado`
    })
  }

  // Montar objeto de update apenas com campos enviados
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (contextWindow !== undefined) data.contextWindow = contextWindow
  if (costTier !== undefined) data.costTier = costTier
  if (supportsStructuredOutput !== undefined) data.supportsStructuredOutput = supportsStructuredOutput
  if (supportsVision !== undefined) data.supportsVision = supportsVision
  if (isActive !== undefined) data.isActive = isActive

  // inputSchema: string JSON, objeto, null (limpar), ou undefined (nao alterar)
  if (rawInputSchema !== undefined) {
    if (rawInputSchema === null || rawInputSchema === '') {
      data.inputSchema = null
    } else {
      try {
        data.inputSchema = typeof rawInputSchema === 'string' ? JSON.parse(rawInputSchema) : rawInputSchema
      } catch {
        throw createError({ statusCode: 400, message: 'inputSchema não é um JSON válido' })
      }
    }
  }

  const model = await prisma.llmModel.update({
    where: { id },
    data
  })

  invalidateMediaCache()
  console.log(`[LLM API] PUT /models/${id} — Model atualizado`)

  return model
})
