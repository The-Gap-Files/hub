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
  content: z.string().describe('Resposta completa e detalhada à pergunta do usuário, baseada no material fornecido'),
  noteType: z.enum(['insight', 'curiosity', 'research']).describe('Tipo de informação da resposta: insight = análise/conexão, curiosity = fato surpreendente, research = dado factual')
})

// =============================================================================
// INTERFACES
// =============================================================================

export interface IntelligenceQueryRequest {
  query: string
  source: 'docs' | 'web'
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
      maxTokens: 2048
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

function buildQuerySystemPrompt(source: 'docs' | 'web'): string {
  if (source === 'docs') {
    return `Você é um analista de inteligência editorial. O usuário fará uma pergunta sobre o material de um dossiê (fontes documentais + notas existentes).

Sua função é responder a pergunta com base EXCLUSIVAMENTE no material fornecido adiante. Seja detalhado, preciso e cite trechos ou dados específicos sempre que possível.

## REGRAS:
- Responda SOMENTE com base no material do dossiê fornecido
- Se a informação não estiver no material, diga claramente: "Esta informação não consta no material do dossiê"
- Cite fontes específicas quando aplicável (ex: "Conforme mencionado na fonte X...", "A fonte Y indica...")
- Seja conciso mas completo
- Escreva em português brasileiro
- Classifique sua resposta como insight (análise/conexão), curiosity (fato surpreendente) ou research (dado factual)`
  }

  return `Você é um pesquisador editorial especializado. O usuário fará uma pergunta sobre um tema e você deve responder com seu conhecimento geral, trazendo informações verificáveis, dados relevantes e contexto.

O tema do dossiê é fornecido para contexto, mas sua resposta deve ir além do material — trazendo conhecimento externo.

## REGRAS:
- Traga dados complementares ao material do dossiê
- Priorize informações verificáveis: datas, nomes, locais, fontes históricas
- Inclua detalhes que enriqueçam a narrativa (perfeitos para curiosidades e fatos pouco conhecidos)
- Se não tiver certeza de um dado, indique com "segundo registros..." ou "há relatos de que..."
- Seja conciso mas detalhado
- Escreva em português brasileiro
- Classifique sua resposta como insight (análise/conexão), curiosity (fato surpreendente) ou research (dado factual)`
}

function buildQueryUserPrompt(request: IntelligenceQueryRequest): string {
  let prompt = `TEMA DO DOSSIÊ: ${request.theme}\n\n`

  if (request.source === 'docs') {
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

  prompt += `\n❓ PERGUNTA DO USUÁRIO:\n${request.query}\n\nResponda de forma detalhada e estruturada.`

  return prompt
}
