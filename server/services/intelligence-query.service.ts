/**
 * Intelligence Query Service
 * 
 * Processa consultas de inteligência contra os documentos do dossiê
 * ou busca informações na web via IA.
 */

import { z } from 'zod'
import { createLlmForTask, getAssignment } from './llm/llm-factory'

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
  sources?: Array<{ title: string; content: string; sourceType: string; weight?: number }>
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
  request: IntelligenceQueryRequest
): Promise<IntelligenceQueryResult> {
  console.log(`[IntelligenceQuery] 🔎 Consulta: "${request.query}" (source: ${request.source})`)

  const assignment = await getAssignment('intelligence-query')
  const model = await createLlmForTask('intelligence-query')
  const m = model as any
  const isGroqLlama4 = assignment.provider.toLowerCase().includes('groq') && assignment.model.includes('llama-4')
  const structuredLlm = assignment.provider === 'replicate' && typeof m.withStructuredOutputReplicate === 'function'
    ? m.withStructuredOutputReplicate(QueryResponseSchema, { includeRaw: true })
    : m.withStructuredOutput(QueryResponseSchema, { includeRaw: true, ...(isGroqLlama4 ? { method: 'jsonMode' } : {}) })

  const systemPrompt = buildQuerySystemPrompt(request.source)
  const userPrompt = buildQueryUserPrompt(request)

  const startTime = Date.now()

  const { invokeWithLogging } = await import('../utils/llm-invoke-wrapper')
  const response = await invokeWithLogging(structuredLlm, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { taskId: 'intelligence-query', provider: assignment.provider, model: assignment.model })

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
    provider: assignment.provider.toUpperCase(),
    model: assignment.model
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
      // Distribuir budget de tokens proporcional ao peso
      const totalWeight = request.sources.reduce((sum, s) => sum + (s.weight ?? 1.0), 0)
      prompt += `📚 FONTES DO DOSSIÊ:\n`
      // Ordenar por peso descendente
      const sorted = [...request.sources].sort((a, b) => (b.weight ?? 1.0) - (a.weight ?? 1.0))
      sorted.forEach((source, i) => {
        const weight = source.weight ?? 1.0
        const perSourceChars = Math.floor(totalBudget * (weight / totalWeight))
        const truncated = source.content.length > perSourceChars
          ? source.content.substring(0, perSourceChars) + '...'
          : source.content
        const weightLabel = weight !== 1.0 ? ` [peso: ${weight}]` : ''
        prompt += `[${i + 1}] (${source.sourceType}) ${source.title}${weightLabel}\n${truncated}\n---\n`
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
