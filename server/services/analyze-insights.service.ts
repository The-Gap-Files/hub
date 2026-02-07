/**
 * Analyze Insights Service
 * 
 * Usa LangChain + Structured Output para analisar o conteúdo do dossiê
 * e gerar automaticamente insights neurais e curiosidades.
 */

import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'

// =============================================================================
// SCHEMA - Formato estruturado que a IA deve retornar
// =============================================================================

const InsightItemSchema = z.object({
  content: z.string().describe('O texto do insight ou curiosidade, escrito de forma clara e concisa'),
  noteType: z.enum(['insight', 'curiosity']).describe('insight = conexão analítica, padrão narrativo ou ângulo editorial. curiosity = fato surpreendente, contradição ou ponto pouco explorado')
})

const AnalysisResponseSchema = z.object({
  items: z.array(InsightItemSchema).min(1).max(15).describe('Lista de insights e curiosidades extraídos do material')
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
  items: Array<{ content: string; noteType: 'insight' | 'curiosity' }>
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
    const model = new ChatAnthropic({
      anthropicApiKey: providerConfig.apiKey,
      modelName: providerConfig.model ?? 'claude-sonnet-4-20250514',
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

  console.log('[AnalyzeInsights] 📤 Enviando para', providerName, '...')

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
    console.log(`[AnalyzeInsights] 💡 ${insights} insights + 🔍 ${curiosities} curiosidades`)

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
  return `Você é um analista de inteligência editorial especializado em extrair insights profundos e curiosidades surpreendentes de material bruto.

Sua função é analisar o dossiê fornecido (documento principal + fontes secundárias + notas existentes) e retornar uma lista de descobertas divididas em duas categorias:

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

## REGRAS:
- Gere entre 4 e 10 itens no total
- Balance entre insights e curiosidades (não precisa ser 50/50, depende do material)
- Cada item deve ser autocontido e compreensível isoladamente
- Escreva em português brasileiro
- Seja específico — evite generalidades vagas
- NÃO repita informações que já existam nas notas existentes do dossiê
- Priorize descobertas que agreguem valor à produção de conteúdo`
}

function buildUserPrompt(request: AnalyzeInsightsRequest): string {
  let prompt = `Analise o seguinte dossiê e extraia insights neurais e curiosidades:\n\n`

  prompt += `📋 TEMA: ${request.theme}\n\n`
  prompt += `📄 DOCUMENTO PRINCIPAL:\n${request.sourceText}\n\n`

  if (request.sources && request.sources.length > 0) {
    prompt += `📚 FONTES SECUNDÁRIAS:\n`
    request.sources.forEach((source, i) => {
      prompt += `[${i + 1}] (${source.sourceType}) ${source.title}\n${source.content}\n---\n`
    })
    prompt += '\n'
  }

  if (request.images && request.images.length > 0) {
    prompt += `🖼️ IMAGENS DE REFERÊNCIA (descrições):\n`
    request.images.forEach((img, i) => {
      prompt += `[${i + 1}] ${img.description}\n`
    })
    prompt += '\n'
  }

  if (request.existingNotes && request.existingNotes.length > 0) {
    prompt += `🧠 NOTAS JÁ EXISTENTES (NÃO repetir estes):\n`
    request.existingNotes.forEach((note, i) => {
      prompt += `[${i + 1}] (${note.noteType}) ${note.content}\n`
    })
    prompt += '\n'
  }

  prompt += `\nRetorne os insights e curiosidades no formato JSON estruturado.`

  return prompt
}
