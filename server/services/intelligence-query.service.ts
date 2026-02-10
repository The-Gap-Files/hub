/**
 * Intelligence Query Service
 * 
 * Processa consultas de inteligência contra os documentos do dossiê
 * ou busca informações na web via IA.
 */

import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'

// =============================================================================
// SCHEMA
// =============================================================================

const QueryResponseSchema = z.object({
  content: z.string().describe('Resposta direta e concisa à pergunta do usuário, em no máximo 3-5 frases. Vá direto ao ponto, sem preâmbulos.'),
  noteType: z.enum(['insight', 'curiosity', 'research']).describe('Tipo de informação da resposta: insight = análise/conexão, curiosity = fato surpreendente, research = dado factual')
})

// =============================================================================
// INTERFACES
// =============================================================================

export interface IntelligenceQueryRequest {
  query: string
  source: 'docs' | 'web' | 'both'
  theme: string
  sources?: Array<{ title: string; content: string; sourceType: string }>
  existingNotes?: Array<{ content: string; noteType: string }>
}

export interface IntelligenceQueryResult {
  content: string
  noteType: 'insight' | 'curiosity' | 'research'
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// =============================================================================
// SERVICE
// =============================================================================

export async function intelligenceQuery(
  request: IntelligenceQueryRequest,
  providerConfig: { name: string; apiKey: string; model?: string; baseUrl?: string }
): Promise<IntelligenceQueryResult> {
  console.log(`[IntelligenceQuery] 🔎 Consulta: "${request.query}" (source: ${request.source})`)

  const providerName = providerConfig.name.toLowerCase()
  let structuredLlm: any

  if (providerName === 'anthropic') {
    const queryModel = process.env.ANTHROPIC_MODEL_INSIGHTS || providerConfig.model || 'claude-sonnet-4-20250514'
    const model = new ChatAnthropic({
      anthropicApiKey: providerConfig.apiKey,
      modelName: queryModel,
      temperature: 0.6,
      maxTokens: 1024
    })
    structuredLlm = model.withStructuredOutput(QueryResponseSchema, { includeRaw: true })
  } else {
    const model = new ChatOpenAI({
      openAIApiKey: providerConfig.apiKey,
      modelName: providerConfig.model ?? 'gpt-4o-mini',
      configuration: {
        baseURL: providerConfig.baseUrl ?? 'https://api.openai.com/v1'
      },
      temperature: 0.6,
      timeout: 60000,
      maxRetries: 2
    })
    structuredLlm = model.withStructuredOutput(QueryResponseSchema, { includeRaw: true })
  }

  const systemPrompt = buildQuerySystemPrompt(request.source)
  const userPrompt = buildQueryUserPrompt(request)

  const startTime = Date.now()

  const response = await structuredLlm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ])

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const content = response.parsed as z.infer<typeof QueryResponseSchema>

  const usage = response.raw?.usage_metadata ?? response.raw?.usage ?? {}
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

  console.log(`[IntelligenceQuery] ✅ Resposta em ${elapsed}s — ${totalTokens} tokens`)

  return {
    content: content.content,
    noteType: content.noteType,
    usage: { inputTokens, outputTokens, totalTokens },
    provider: providerName.toUpperCase(),
    model: providerConfig.model ?? (providerName === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini')
  }
}

// =============================================================================
// PROMPTS
// =============================================================================

function buildQuerySystemPrompt(source: 'docs' | 'web' | 'both'): string {
  if (source === 'docs') {
    return `Você é um analista de inteligência editorial. Responda perguntas sobre o dossiê de forma CURTA e DIRETA.

## REGRAS OBRIGATÓRIAS:
- Máximo 3-5 frases. Vá direto ao ponto.
- NUNCA reformule a pergunta. NUNCA faça introdução. Comece pela resposta.
- Responda SOMENTE com base no material fornecido
- Se não consta no material, diga apenas: "Não consta no material do dossiê."
- Cite a fonte brevemente quando relevante (ex: "Segundo a fonte X, ...")
- Escreva em português brasileiro
- Classifique como insight, curiosity ou research`
  }

  if (source === 'both') {
    return `Você é um analista de inteligência editorial com acesso ao material do dossiê E conhecimento externo. Responda de forma CURTA e DIRETA.

## REGRAS OBRIGATÓRIAS:
- Máximo 3-5 frases. Vá direto ao ponto.
- NUNCA reformule a pergunta. NUNCA faça introdução. Comece pela resposta.
- Use o material do dossiê como base principal
- Complemente com seu conhecimento externo quando o material for insuficiente
- Distinga claramente: "No dossiê: ..." vs "Além do dossiê: ..."
- Escreva em português brasileiro
- Classifique como insight, curiosity ou research`
  }

  return `Você é um pesquisador editorial. Responda perguntas trazendo conhecimento externo de forma CURTA e PRECISA.

## REGRAS OBRIGATÓRIAS:
- Máximo 3-5 frases. Vá direto ao ponto.
- NUNCA reformule a pergunta. NUNCA faça introdução. Comece pela resposta.
- Priorize dados verificáveis: datas, nomes, locais, fontes
- Se não tiver certeza, use "segundo registros..." ou "há relatos..."
- Escreva em português brasileiro
- Classifique como insight, curiosity ou research`
}

function buildQueryUserPrompt(request: IntelligenceQueryRequest): string {
  let prompt = `TEMA DO DOSSIÊ: ${request.theme}\n\n`

  if (request.source === 'docs' || request.source === 'both') {
    // Incluir todas as fontes do dossiê (arquitetura flat/democratizada)
    if (request.sources && request.sources.length > 0) {
      const totalBudget = 16000
      const perSourceChars = Math.floor(totalBudget / request.sources.length)
      prompt += `📚 FONTES DO DOSSIÊ:\n`
      request.sources.forEach((source, i) => {
        const truncated = source.content.length > perSourceChars
          ? source.content.substring(0, perSourceChars) + '...'
          : source.content
        prompt += `[${i + 1}] (${source.sourceType}) ${source.title}\n${truncated}\n---\n`
      })
      prompt += '\n'
    }

    if (request.existingNotes && request.existingNotes.length > 0) {
      const notesText = request.existingNotes.slice(0, 20).map((n, i) => `[${i + 1}] (${n.noteType}) ${n.content}`).join('\n')
      prompt += `🧠 NOTAS EXISTENTES:\n${notesText}\n\n`
    }
  }

  prompt += `\n❓ PERGUNTA:\n${request.query}\n\nResponda em no máximo 3-5 frases, direto ao ponto.`

  return prompt
}
