/**
 * Analyze Insights Service
 * 
 * Usa LangChain + Structured Output para analisar o conteúdo do dossiê
 * e gerar automaticamente insights neurais, curiosidades e dados de pesquisa.
 */

import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'

// =============================================================================
// SCHEMA - Formato estruturado que a IA deve retornar
// =============================================================================

const InsightItemSchema = z.object({
  content: z.string().describe('O texto do insight, curiosidade ou dado de pesquisa, escrito de forma clara e concisa'),
  noteType: z.enum(['insight', 'curiosity', 'research']).describe('insight = conexão analítica, padrão narrativo ou ângulo editorial. curiosity = fato surpreendente, contradição ou ponto pouco explorado. research = dado de pesquisa estruturado: fato verificável, estatística, data, nome ou referência documental')
})

const AnalysisResponseSchema = z.object({
  items: z.array(InsightItemSchema).min(1).max(15).describe('Lista de insights, curiosidades e dados de pesquisa extraídos do material')
})

type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>

// =============================================================================
// TIPOS
// =============================================================================

export interface AnalyzeInsightsRequest {
  sourceText: string
  theme: string
  sources?: Array<{ title: string; content: string; sourceType: string }>
  existingNotes?: Array<{ content: string; noteType: string }>
  images?: Array<{ description: string }>
}

export interface AnalyzeInsightsResult {
  items: Array<{ content: string; noteType: 'insight' | 'curiosity' | 'research' }>
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// =============================================================================
// SERVICE
// =============================================================================

export async function analyzeInsights(
  request: AnalyzeInsightsRequest,
  providerConfig: { name: string; apiKey: string; model?: string; baseUrl?: string }
): Promise<AnalyzeInsightsResult> {
  console.log('[AnalyzeInsights] 🧠 Iniciando análise neural do dossiê...')

  // Criar modelo baseado no provider configurado
  const providerName = providerConfig.name.toLowerCase()
  let structuredLlm: any

  if (providerName === 'anthropic') {
    const insightsModel = process.env.ANTHROPIC_MODEL_INSIGHTS || providerConfig.model || 'claude-sonnet-4-20250514'
    const model = new ChatAnthropic({
      anthropicApiKey: providerConfig.apiKey,
      modelName: insightsModel,
      temperature: 0.8,
      maxTokens: 4096
    })
    structuredLlm = model.withStructuredOutput(AnalysisResponseSchema, { includeRaw: true })
  } else {
    // OpenAI (default)
    const model = new ChatOpenAI({
      openAIApiKey: providerConfig.apiKey,
      modelName: providerConfig.model ?? 'gpt-4o-mini',
      configuration: {
        baseURL: providerConfig.baseUrl ?? 'https://api.openai.com/v1'
      },
      temperature: 0.8,
      timeout: 60000,
      maxRetries: 2
    })
    structuredLlm = model.withStructuredOutput(AnalysisResponseSchema, { includeRaw: true })
  }

  // Montar o prompt
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(request)

  const resolvedModel = providerName === 'anthropic'
    ? (process.env.ANTHROPIC_MODEL_INSIGHTS || providerConfig.model || 'claude-sonnet-4-20250514')
    : (providerConfig.model || 'gpt-4o-mini')
  console.log(`[AnalyzeInsights] 📤 Enviando para ${providerName} (${resolvedModel})...`)

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ]

  try {
    const startTime = Date.now()
    const result = await structuredLlm.invoke(messages)
    const content = result.parsed as AnalysisResponse
    const rawMessage = result.raw as any
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    // Extrair token usage
    const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
    const inputTokens = usage?.input_tokens ?? 0
    const outputTokens = usage?.output_tokens ?? 0
    const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

    console.log(`[AnalyzeInsights] ✅ Análise concluída em ${elapsed}s — ${content.items.length} itens gerados`)
    console.log(`[AnalyzeInsights] 📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)

    const insights = content.items.filter(i => i.noteType === 'insight').length
    const curiosities = content.items.filter(i => i.noteType === 'curiosity').length
    const research = content.items.filter(i => i.noteType === 'research').length
    console.log(`[AnalyzeInsights] 💡 ${insights} insights + 🔍 ${curiosities} curiosidades + 📊 ${research} dados de pesquisa`)

    return {
      items: content.items,
      usage: { inputTokens, outputTokens, totalTokens },
      provider: providerName.toUpperCase(),
      model: providerConfig.model ?? (providerName === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini')
    }
  } catch (error) {
    console.error('[AnalyzeInsights] ❌ Erro na análise:', error)
    throw error
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildSystemPrompt(): string {
  return `Você é um analista de inteligência editorial especializado em extrair insights profundos, curiosidades surpreendentes e dados de pesquisa estruturados de material bruto.

Sua função é analisar o dossiê fornecido (documento principal + fontes secundárias + notas existentes) e retornar uma lista de descobertas divididas em três categorias:

## INSIGHT NEURAL (noteType: "insight")
- Conexões não-óbvias entre informações do material
- Padrões narrativos que podem ser explorados
- Ângulos editoriais únicos e diferenciados
- Contradições internas que geram tensão narrativa
- Relações causais implícitas no material

## CURIOSIDADE (noteType: "curiosity")  
- Fatos surpreendentes ou pouco conhecidos
- Dados estatísticos impactantes
- Detalhes sensoriais ou humanos que enriquecem a narrativa
- Elementos que geram engajamento e retenção do público
- Pontos que provocam reflexão ou debate

## DADO DE PESQUISA (noteType: "research")
- Fatos verificáveis e objetivos (nomes, datas, locais)
- Estatísticas e números concretos mencionados no material
- Referências documentais ou bibliográficas
- Linhas do tempo e sequências cronológicas
- Atores-chave e suas relações (quem, o quê, quando, onde)
- Dados que servem como base factual para roteiros e scripts

## REGRAS:
- Gere entre 6 e 15 itens no total
- Balance entre as três categorias (priorize o que o material oferece)
- Gere pelo menos 2 itens de cada categoria quando possível
- Cada item deve ser autocontido e compreensível isoladamente
- Escreva em português brasileiro
- Seja específico — evite generalidades vagas
- NÃO repita informações que já existam nas notas existentes do dossiê
- Priorize descobertas que agreguem valor à produção de conteúdo`
}

// =============================================================================
// TRUNCAMENTO INTELIGENTE
// =============================================================================

/** Limite seguro de tokens para o prompt (deixa margem para system prompt + output) */
const MAX_PROMPT_TOKENS = 150_000
const CHARS_PER_TOKEN = 4

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function truncateText(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n[... CONTEÚDO TRUNCADO POR LIMITE DE CONTEXTO ...]'
}

function buildUserPrompt(request: AnalyzeInsightsRequest): string {
  // Budget allocation: documento principal (60%), fontes (25%), notas+imagens (15%)
  const docBudget = Math.floor(MAX_PROMPT_TOKENS * 0.60)
  const sourcesBudget = Math.floor(MAX_PROMPT_TOKENS * 0.25)
  const metaBudget = Math.floor(MAX_PROMPT_TOKENS * 0.15)

  let prompt = `Analise o seguinte dossiê e extraia insights neurais, curiosidades e dados de pesquisa:\n\n`

  prompt += `📋 TEMA: ${request.theme}\n\n`

  // Documento principal (com truncamento se necessário)
  const truncatedDoc = truncateText(request.sourceText, docBudget)
  prompt += `📄 DOCUMENTO PRINCIPAL:\n${truncatedDoc}\n\n`

  // Fontes secundárias (distribui budget entre elas)
  if (request.sources && request.sources.length > 0) {
    const perSourceBudget = Math.floor(sourcesBudget / request.sources.length)
    prompt += `📚 FONTES SECUNDÁRIAS:\n`
    request.sources.forEach((source, i) => {
      const truncatedContent = truncateText(source.content, perSourceBudget)
      prompt += `[${i + 1}] (${source.sourceType}) ${source.title}\n${truncatedContent}\n---\n`
    })
    prompt += '\n'
  }

  // Imagens e notas existentes (usa budget de meta)
  let metaUsed = 0

  if (request.images && request.images.length > 0) {
    prompt += `🖼️ IMAGENS DE REFERÊNCIA (descrições):\n`
    request.images.forEach((img, i) => {
      prompt += `[${i + 1}] ${img.description}\n`
    })
    prompt += '\n'
    metaUsed += estimateTokens(request.images.map(i => i.description).join('\n'))
  }

  if (request.existingNotes && request.existingNotes.length > 0) {
    const notesRemaining = metaBudget - metaUsed
    const notesText = request.existingNotes.map((note, i) => `[${i + 1}] (${note.noteType}) ${note.content}`).join('\n')
    const truncatedNotes = truncateText(notesText, notesRemaining)
    prompt += `🧠 NOTAS JÁ EXISTENTES (NÃO repetir estes):\n${truncatedNotes}\n\n`
  }

  prompt += `\nRetorne os insights, curiosidades e dados de pesquisa no formato JSON estruturado.`

  // Log de diagnóstico
  const totalTokens = estimateTokens(prompt)
  const wasTruncated = truncatedDoc.includes('[... CONTEÚDO TRUNCADO')
  console.log(`[AnalyzeInsights] 📏 Prompt: ~${totalTokens.toLocaleString()} tokens estimados${wasTruncated ? ' (TRUNCADO)' : ''}`)

  return prompt
}
