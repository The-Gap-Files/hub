/**
 * Gemini Schema Sanitizer
 *
 * A API Gemini (function_declarations / functionCalling) aceita apenas um subconjunto
 * limitado do JSON Schema: type, properties, required, description, enum, items.
 *
 * Campos como const, default, minItems, maxItems, minimum, maximum, minLength, maxLength,
 * nullable, anyOf, oneOf, allOf, not, $ref, $schema, additionalProperties, etc.
 * causam erro 400 "Invalid argument" ou "Unknown name".
 *
 * Este utilitário limpa recursivamente um Zod schema (convertido para JSON Schema)
 * removendo todos os campos incompatíveis ANTES de enviar ao Gemini.
 *
 * Uso: wrapa o schema Zod com sanitizeSchemaForGemini() no createStructuredOutput.
 */

/** Campos que o Gemini function_declarations aceita */
const GEMINI_ALLOWED_KEYS = new Set([
  'type',
  'properties',
  'required',
  'description',
  'enum',
  'items',
  'format',
  // Estruturais (necessários para traversal)
  'anyOf',
  'oneOf',
  'allOf',
])

/**
 * Remove recursivamente campos não suportados pelo Gemini de um JSON Schema.
 * Converte anyOf/oneOf simples (ex: [type, null]) para o tipo principal.
 */
function sanitizeNode(node: any): any {
  if (node === null || node === undefined) return node
  if (typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(sanitizeNode)

  const result: Record<string, any> = {}

  // Resolver anyOf/oneOf que são apenas "tipo | null" (gerado por .nullable()/.optional())
  if (node.anyOf || node.oneOf) {
    const variants = node.anyOf || node.oneOf
    if (Array.isArray(variants)) {
      // Filtrar variantes nulas
      const nonNull = variants.filter((v: any) => v?.type !== 'null')
      if (nonNull.length === 1) {
        // Ex: anyOf: [{type: "string"}, {type: "null"}] → {type: "string"}
        const merged = { ...node, ...nonNull[0] }
        delete merged.anyOf
        delete merged.oneOf
        return sanitizeNode(merged)
      }
      // anyOf com múltiplos tipos reais — Gemini não suporta, converter para string
      if (nonNull.length > 1) {
        const descriptions = [
          node.description,
          `Valores possíveis: ${nonNull.map((v: any) => v.const ?? v.enum?.join('/') ?? v.type).join(' | ')}`
        ].filter(Boolean).join('. ')
        return { type: 'string', description: descriptions }
      }
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'const') {
      // const: "value" → enum: ["value"]
      result.enum = [value]
      continue
    }

    if (key === 'default' || key === 'nullable' || key === '$schema' ||
      key === 'additionalProperties' || key === 'strict' ||
      key === 'minItems' || key === 'maxItems' ||
      key === 'minimum' || key === 'maximum' ||
      key === 'minLength' || key === 'maxLength' ||
      key === 'exclusiveMinimum' || key === 'exclusiveMaximum' ||
      key === 'multipleOf' || key === 'pattern' ||
      key === 'uniqueItems' || key === '$ref' ||
      key === 'not' || key === 'if' || key === 'then' || key === 'else' ||
      key === 'prefixItems' || key === 'unevaluatedProperties') {
      continue // Skip — Gemini não suporta
    }

    result[key] = sanitizeNode(value)
  }

  return result
}

/**
 * Sanitiza um JSON Schema (ou objeto com estrutura de JSON Schema)
 * para ser compatível com a API Gemini function_declarations.
 */
export function sanitizeSchemaForGemini(jsonSchema: Record<string, any>): Record<string, any> {
  return sanitizeNode(jsonSchema)
}
