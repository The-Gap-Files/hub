/**
 * Creative Direction Advisor Service
 * 
 * Usa LangChain + Structured Output para analisar o conteúdo do dossiê
 * e recomendar a direção criativa ideal:
 * - Estilo de Roteiro (scriptStyle)
 * - Estilo Visual (visualStyle)
 * - Objetivo Editorial (editorialObjective)
 * 
 * Se nenhuma constant existente for ideal, sugere criação de novas.
 * Cada recomendação vem com justificativa detalhada.
 */

import { z } from 'zod'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { loadSkill } from '../utils/skill-loader'
import { serializeConstantsCatalog } from '../utils/constants-catalog'
import { createLlmForTask, getAssignment } from './llm/llm-factory'

// =============================================================================
// SCHEMAS — Formato estruturado que a IA deve retornar
// =============================================================================

/** Recomendação de uma constant específica */
const StyleRecommendationSchema = z.object({
  id: z.string().describe('ID exato da constant existente, ou "custom" se nenhuma é adequada'),
  name: z.string().describe('Nome legível do estilo/objetivo'),
  reasoning: z.string().describe('Justificativa detalhada de por que esta é a melhor escolha para este dossiê'),
})

/** Direção criativa para um item de conteúdo (fullVideo ou teaser) */
const ItemDirectionSchema = z.object({
  scriptStyle: StyleRecommendationSchema.describe('Estilo de roteiro recomendado'),
  visualStyle: StyleRecommendationSchema.describe('Estilo visual recomendado'),
  editorialObjective: StyleRecommendationSchema.describe('Objetivo editorial recomendado'),
})

/** Recomendação de direção criativa para um ângulo de teaser */
const TeaserDirectionSchema = ItemDirectionSchema.extend({
  suggestedAngle: z.string().describe('Ângulo narrativo sugerido (ex: "econômico", "humano", "conspirativo")'),
  briefRationale: z.string().describe('Resumo de por que esta combinação funciona para este ângulo específico'),
})

/** Sugestão de nova constant quando as existentes não atendem */
const CustomSuggestionSchema = z.object({
  type: z.enum(['scriptStyle', 'visualStyle', 'editorialObjective'])
    .describe('Tipo da constant a ser criada'),
  proposedId: z.string()
    .describe('ID sugerido em slug-format (ex: "thriller-investigativo")'),
  name: z.string()
    .describe('Nome legível da nova constant'),
  description: z.string()
    .describe('Descrição curta (1-2 frases)'),
  specification: z.string()
    .describe('Especificação COMPLETA pronta para uso como constant. Para scriptStyle: instructions com identidade+objetivo+estrutura+técnicas+tom. Para visualStyle: baseStyle+lightingTags+atmosphereTags+compositionTags+tags. Para editorialObjective: instruction completa.'),
  justification: z.string()
    .describe('Por que as constants existentes não atendem e por que esta nova seria melhor'),
})

/** Schema completo da resposta do Creative Direction Advisor */
const CreativeDirectionSchema = z.object({
  analysis: z.string()
    .describe('Análise geral do dossiê: tema, tom, público-alvo, potencial de conteúdo, nível de densidade informacional'),
  fullVideo: ItemDirectionSchema
    .describe('Direção criativa recomendada para o Full Video (YouTube)'),
  teaserRecommendations: z.array(TeaserDirectionSchema).min(3).max(6)
    .describe('Recomendações criativas para diferentes ângulos de teaser, uma por ângulo narrativo previsto'),
  customSuggestions: z.array(CustomSuggestionSchema)
    .describe('Sugestões de NOVAS constants se as existentes não são ideais. Array VAZIO [] se as existentes são suficientes.'),
  confidence: z.number().min(0).max(100)
    .describe('Confiança (0-100) de que as constants existentes atendem o dossiê. Abaixo de 60 = customSuggestions DEVE ter pelo menos 1 item.'),
})

export type CreativeDirection = z.infer<typeof CreativeDirectionSchema>

// =============================================================================
// TIPOS
// =============================================================================

export interface CreativeDirectionRequest {
  theme: string
  title: string
  sources?: Array<{ title: string; content: string; sourceType: string; weight?: number }>
  notes?: Array<{ content: string; noteType: string }>
}

export interface CreativeDirectionResult {
  direction: CreativeDirection
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// =============================================================================
// SERVICE
// =============================================================================

export async function generateCreativeDirection(
  request: CreativeDirectionRequest
): Promise<CreativeDirectionResult> {
  console.log('[CreativeDirection] 🎨 Iniciando análise de direção criativa...')

  // Criar modelo via LLM Factory
  const assignment = await getAssignment('creative-direction')
  const model = await createLlmForTask('creative-direction')
  const isReplicate = assignment.provider.toLowerCase().includes('replicate')
  const isGroqLlama4 = assignment.provider.toLowerCase().includes('groq') && assignment.model.includes('llama-4')
  const m = model as any
  const structuredLlm = isReplicate && typeof m.withStructuredOutputReplicate === 'function'
    ? m.withStructuredOutputReplicate(CreativeDirectionSchema, { includeRaw: true })
    : m.withStructuredOutput(CreativeDirectionSchema, { includeRaw: true, ...(isGroqLlama4 ? { method: 'jsonMode' } : {}) })

  // Carregar skill + catálogo de constants
  const skillContent = loadSkill('creative-direction-advisor')
  const catalog = serializeConstantsCatalog()

  // Montar prompts
  const systemPrompt = buildSystemPrompt(skillContent, catalog)
  const userPrompt = buildUserPrompt(request)

  console.log(`[CreativeDirection] 📤 Enviando para ${assignment.provider} (${assignment.model})...`)

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ]

  const startTime = Date.now()
  const { invokeWithLogging } = await import('../utils/llm-invoke-wrapper')
  const result = await invokeWithLogging(structuredLlm, messages, {
    taskId: 'creative-direction-advisor',
    provider: assignment.provider,
    model: assignment.model
  })
  const content = result.parsed as CreativeDirection
  const rawMessage = result.raw as any
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  // Extrair token usage
  const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

  console.log(`[CreativeDirection] ✅ Análise concluída em ${elapsed}s`)
  console.log(`[CreativeDirection] 🎯 Confiança nas constants existentes: ${content.confidence}%`)
  console.log(`[CreativeDirection] 📊 Full Video: ${content.fullVideo.scriptStyle.id} + ${content.fullVideo.visualStyle.id} + ${content.fullVideo.editorialObjective.id}`)
  console.log(`[CreativeDirection] 📊 Teasers: ${content.teaserRecommendations.length} recomendações`)
  console.log(`[CreativeDirection] 📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)

  if (content.customSuggestions.length > 0) {
    console.log(`[CreativeDirection] 💡 ${content.customSuggestions.length} sugestão(ões) de nova(s) constant(s):`)
    content.customSuggestions.forEach(s => {
      console.log(`  → [${s.type}] ${s.proposedId}: "${s.name}"`)
    })
  }

  return {
    direction: content,
    usage: { inputTokens, outputTokens, totalTokens },
    provider: assignment.provider.toUpperCase(),
    model: assignment.model
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildSystemPrompt(skillContent: string, catalog: string): string {
  return `${skillContent}

## 📚 CATÁLOGO COMPLETO DE CONSTANTS DISPONÍVEIS

Abaixo estão TODAS as constants existentes no sistema. Você DEVE escolher entre elas ao recomendar.
Se recomendar "custom" como id, OBRIGATORIAMENTE preencha customSuggestions com a especificação completa.

${catalog}

## ⚙️ INSTRUÇÕES FINAIS

- Use os IDs EXATOS das constants ao recomendar (ex: "mystery", "ghibli-dark", "hidden-truth")
- Se um \`id\` for "custom", ele DEVE corresponder a um item em \`customSuggestions\`
- O \`confidence\` deve refletir HONESTAMENTE se as constants existentes atendem este dossiê
- Se \`confidence\` < 60, \`customSuggestions\` DEVE ter pelo menos 1 item
- Retorne SEMPRE em JSON estruturado`
}

function buildUserPrompt(request: CreativeDirectionRequest): string {
  let prompt = `Analise o seguinte dossiê e recomende a direção criativa ideal:\n\n`

  prompt += `📋 TÍTULO: ${request.title}\n`
  prompt += `📋 TEMA: ${request.theme}\n\n`

  if (request.sources && request.sources.length > 0) {
    prompt += `📚 FONTES DO DOSSIÊ (ordenadas por peso/relevância):\n`
    const sorted = [...request.sources].sort((a, b) => (b.weight ?? 1.0) - (a.weight ?? 1.0))
    sorted.forEach((source, i) => {
      const weightLabel = (source.weight ?? 1.0) !== 1.0 ? ` [peso: ${source.weight}]` : ''
      prompt += `[${i + 1}] (${source.sourceType}) ${source.title}${weightLabel}\n${source.content}\n---\n`
    })
    prompt += '\n'
  }

  if (request.notes && request.notes.length > 0) {
    prompt += `🧠 NOTAS E INSIGHTS DO DOSSIÊ:\n`
    request.notes.forEach((note, i) => {
      prompt += `[${i + 1}] (${note.noteType}) ${note.content}\n`
    })
    prompt += '\n'
  }

  prompt += `\nCom base no material acima, recomende a direção criativa completa em JSON estruturado.`
  prompt += `\nLembre-se: analise o conteúdo ANTES de decidir. Justifique CADA escolha.`

  return prompt
}
