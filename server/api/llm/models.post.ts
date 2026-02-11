/**
 * POST /api/llm/models — Cria um novo model
 *
 * Body: { modelId, name, providerId, contextWindow?, costTier?, supportsStructuredOutput?, supportsVision? }
 */
import { prisma } from '../../utils/prisma'
import { invalidateMediaCache } from '../../services/media/media-factory'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const {
    modelId,
    name,
    providerId,
    contextWindow,
    costTier,
    supportsStructuredOutput,
    supportsVision,
    inputSchema: rawInputSchema
  } = body as {
    modelId: string
    name: string
    providerId: string
    contextWindow?: number
    costTier?: number
    supportsStructuredOutput?: boolean
    supportsVision?: boolean
    inputSchema?: string | Record<string, unknown>
  }

  // Parsear inputSchema: aceita JSON string ou objeto direto
  let inputSchema: any = null
  if (rawInputSchema) {
    try {
      inputSchema = typeof rawInputSchema === 'string' ? JSON.parse(rawInputSchema) : rawInputSchema
    } catch {
      throw createError({ statusCode: 400, message: 'inputSchema não é um JSON válido' })
    }
  }

  // Validações
  if (!modelId || !name || !providerId) {
    throw createError({
      statusCode: 400,
      message: 'modelId, name e providerId são obrigatórios'
    })
  }

  // Verificar se o provider existe
  const provider = await prisma.llmProvider.findUnique({
    where: { id: providerId }
  })

  if (!provider) {
    throw createError({
      statusCode: 404,
      message: `Provider "${providerId}" não encontrado`
    })
  }

  const model = await prisma.llmModel.create({
    data: {
      modelId,
      name,
      providerId,
      contextWindow: contextWindow ?? 128000,
      costTier: costTier ?? 2,
      supportsStructuredOutput: supportsStructuredOutput ?? true,
      supportsVision: supportsVision ?? false,
      inputSchema
    }
  })

  invalidateMediaCache()
  console.log(`[LLM API] POST /models — Model "${model.modelId}" criado para provider "${providerId}"`)

  return model
})
