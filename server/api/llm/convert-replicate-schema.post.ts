/**
 * Converte JSON Schema do Replicate para o formato MediaModelInputSchema.
 * POST body: { jsonSchema: object }
 * Retorna: { inputSchema: MediaModelInputSchema } ou erro.
 */

import { convertReplicateJsonSchemaToMediaModelInputSchema } from '#server/utils/replicate-schema-converter'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jsonSchema = body?.jsonSchema ?? body

  if (!jsonSchema) {
    throw createError({
      statusCode: 400,
      message: 'Corpo inválido. Envie { "jsonSchema": { ... } } com o JSON Schema do Replicate.',
    })
  }

  const inputSchema = convertReplicateJsonSchemaToMediaModelInputSchema(jsonSchema)

  if (!inputSchema) {
    throw createError({
      statusCode: 400,
      message:
        'Não foi possível converter o schema. Verifique se possui "properties" e ao menos um campo de prompt (prompt, text, etc.).',
    })
  }

  return { inputSchema }
})
