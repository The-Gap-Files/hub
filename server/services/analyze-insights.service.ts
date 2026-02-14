/**
 * Analyze Insights Service
 * 
 * Usa LangChain + Structured Output para analisar o conteúdo do dossiê
 * e gerar automaticamente insights neurais, curiosidades e dados de pesquisa.
 */

import { z } from 'zod'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createLlmForTask, getAssignment } from './llm/llm-factory'

// =============================================================================
// SCHEMA - Formato estruturado que a IA deve retornar
// =============================================================================

const InsightItemSchema = z.object({
  content: z.string().describe('O texto do insight, curiosidade ou dado de pesquisa, escrito de forma clara e concisa'),
  noteType: z.enum(['insight', 'curiosity', 'research']).describe('insight = conexão analítica, padrão narrativo ou ângulo editorial. curiosity = fato surpreendente, contradição ou ponto pouco explorado. research = dado de pesquisa estruturado: fato verificável, estatística, data, nome ou referência documental')
})

const PersonItemSchema = z.object({
  name: z.string().describe('Nome completo da pessoa'),
  role: z.string().optional().describe('Papel narrativo: investigador, vítima, suspeito, testemunha, cientista, líder, autor, etc.'),
  description: z.string().describe('Descrição breve da pessoa e sua relevância no contexto do dossiê (1-2 frases)'),
  visualDescription: z.string().optional().describe('Descrição visual da pessoa para consistência em geração de imagens/vídeos: aparência física, vestimenta típica, expressão, edad aparente. Ex: "Homem caucasiano, 50 anos, cabelo grisalho curto, terno escuro, expressão severa"'),
  aliases: z.array(z.string()).optional().describe('Apelidos, codinomes ou outros nomes pelos quais a pessoa é conhecida'),
  relevance: z.enum(['primary', 'secondary', 'mentioned']).describe('primary = protagonista ou figura central. secondary = papel importante mas não central. mentioned = citado brevemente')
})

const AnalysisResponseSchema = z.object({
  items: z.array(InsightItemSchema).min(1).max(15).describe('Lista de insights, curiosidades e dados de pesquisa extraídos do material'),
  persons: z.array(PersonItemSchema).max(10).describe('Lista de pessoas-chave identificadas no material. Apenas pessoas reais ou personagens relevantes, não figuras genéricas.')
})

type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>

// =============================================================================
// TIPOS
// =============================================================================

export interface AnalyzeInsightsRequest {
  theme: string
  sources?: Array<{ title: string; content: string; sourceType: string; weight?: number }>
  existingNotes?: Array<{ content: string; noteType: string }>
  images?: Array<{ description: string }>
  existingPersons?: Array<{ name: string }>
}

export interface AnalyzeInsightsResult {
  items: Array<{ content: string; noteType: 'insight' | 'curiosity' | 'research' }>
  persons: Array<{ name: string; role?: string; description: string; visualDescription?: string; aliases?: string[]; relevance: 'primary' | 'secondary' | 'mentioned' }>
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// =============================================================================
// SERVICE
// =============================================================================

export async function analyzeInsights(
  request: AnalyzeInsightsRequest
): Promise<AnalyzeInsightsResult> {
  console.log('[AnalyzeInsights] 🧠 Iniciando análise neural do dossiê...')

  // Criar modelo via LLM Factory (provider/modelo configurável via UI)
  const assignment = await getAssignment('analysis')
  const model = await createLlmForTask('analysis')
  const m = model as any
  const isGroqLlama4 = assignment.provider.toLowerCase().includes('groq') && assignment.model.includes('llama-4')
  const structuredLlm = assignment.provider === 'replicate' && typeof m.withStructuredOutputReplicate === 'function'
    ? m.withStructuredOutputReplicate(AnalysisResponseSchema, { includeRaw: true })
    : m.withStructuredOutput(AnalysisResponseSchema, { includeRaw: true, ...(isGroqLlama4 ? { method: 'jsonMode' } : {}) })

  // Montar o prompt
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(request)

  console.log(`[AnalyzeInsights] 📤 Enviando para ${assignment.provider} (${assignment.model})...`)

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ]

  try {
    const startTime = Date.now()
    const { invokeWithLogging } = await import('../utils/llm-invoke-wrapper')
    const result = await invokeWithLogging(structuredLlm, messages, {
      taskId: 'analyze-insights',
      provider: assignment.provider,
      model: assignment.model
    })
    const content = result.parsed as AnalysisResponse
    const rawMessage = result.raw as any
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    // Extrair token usage
    const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
    const inputTokens = usage?.input_tokens ?? 0
    const outputTokens = usage?.output_tokens ?? 0
    const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

    const personsCount = content.persons?.length || 0
    console.log(`[AnalyzeInsights] ✅ Análise concluída em ${elapsed}s — ${content.items.length} itens + ${personsCount} pessoas`)
    console.log(`[AnalyzeInsights] 📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)

    const insights = content.items.filter(i => i.noteType === 'insight').length
    const curiosities = content.items.filter(i => i.noteType === 'curiosity').length
    const research = content.items.filter(i => i.noteType === 'research').length
    console.log(`[AnalyzeInsights] 💡 ${insights} insights + 🔍 ${curiosities} curiosidades + 📊 ${research} dados de pesquisa + 👤 ${personsCount} pessoas`)

    return {
      items: content.items,
      persons: content.persons || [],
      usage: { inputTokens, outputTokens, totalTokens },
      provider: assignment.provider.toUpperCase(),
      model: assignment.model
    }
  } catch (error: any) {
    const { handleGroqJsonValidateError } = await import('../utils/groq-error-handler')
    const result = handleGroqJsonValidateError<any>(error, '[AnalyzeInsights]')

    if (result.success) {
      console.warn('[AnalyzeInsights] ⚠️ Usando resposta parcial do failed_generation')
      return {
        items: result.data.items || [],
        persons: result.data.persons || [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        provider: assignment.provider.toUpperCase(),
        model: assignment.model
      }
    }

    console.error('[AnalyzeInsights] ❌ Erro na análise:', error)
    throw error
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildSystemPrompt(): string {
  return `Você é um analista de inteligência editorial especializado em extrair insights profundos, curiosidades surpreendentes, dados de pesquisa estruturados e PESSOAS-CHAVE de material bruto.

Sua função é analisar o dossiê fornecido (fontes do dossiê + notas existentes) e retornar:
1. Uma lista de descobertas divididas em três categorias (items)
2. Uma lista de pessoas-chave identificadas no material (persons)

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
- Dados que servem como base factual para roteiros e scripts

## PESSOAS-CHAVE (persons)
Identifique todas as pessoas relevantes mencionadas no material:
- **name**: Nome completo como aparece no material
- **role**: Papel narrativo (investigador, vítima, suspeito, testemunha, cientista, líder, político, jornalista, etc.)
- **description**: Quem é esta pessoa e por que é relevante no contexto (1-2 frases)
- **visualDescription**: Descrição visual da pessoa para geração de imagens/vídeos consistentes. Inclua: aparência física, idade aparente, vestimenta típica, expressão. Ex: "Homem caucasiano, ~50 anos, cabelo grisalho curto, terno escuro, expressão severa"
- **aliases**: Lista de apelidos, codinomes ou outros nomes conhecidos
- **relevance**: "primary" (protagonista/figura central), "secondary" (papel importante mas não central), "mentioned" (citado brevemente)

## REGRAS:
- Gere entre 6 e 15 itens no total
- Balance entre as três categorias (priorize o que o material oferece)
- Gere pelo menos 2 itens de cada categoria quando possível
- Cada item deve ser autocontido e compreensível isoladamente
- Escreva em português brasileiro
- Seja específico — evite generalidades vagas
- NÃO repita informações que já existam nas notas existentes do dossiê
- NÃO repita pessoas que já foram extraídas anteriormente
- Priorize descobertas que agreguem valor à produção de conteúdo
- Para visualDescription, seja específico o suficiente para que um modelo de IA consiga gerar a pessoa consistentemente entre cenas`
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
  // Budget unificado: fontes (85%), notas+imagens (15%)
  const sourcesBudget = Math.floor(MAX_PROMPT_TOKENS * 0.85)
  const metaBudget = Math.floor(MAX_PROMPT_TOKENS * 0.15)

  let prompt = `Analise o seguinte dossiê e extraia insights neurais, curiosidades e dados de pesquisa:\n\n`

  prompt += `📋 TEMA: ${request.theme}\n\n`

  // Fontes (todas tratadas igualmente — arquitetura flat/democratizada)
  if (request.sources && request.sources.length > 0) {
    // Calcular budget proporcional ao peso de cada fonte
    const totalWeight = request.sources.reduce((sum, s) => sum + (s.weight ?? 1.0), 0)
    prompt += `📚 FONTES DO DOSSIÊ:\n`
    request.sources.forEach((source, i) => {
      const weight = source.weight ?? 1.0
      const perSourceBudget = Math.floor(sourcesBudget * (weight / totalWeight))
      const truncatedContent = truncateText(source.content, perSourceBudget)
      const weightLabel = weight !== 1.0 ? ` [peso: ${weight}]` : ''
      prompt += `[${i + 1}] (${source.sourceType}) ${source.title}${weightLabel}\n${truncatedContent}\n---\n`
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

  if (request.existingPersons && request.existingPersons.length > 0) {
    const personsText = request.existingPersons.map((p, i) => `[${i + 1}] ${p.name}`).join('\n')
    prompt += `👤 PESSOAS JÁ EXTRAÍDAS (NÃO repetir):\n${personsText}\n\n`
  }

  prompt += `\nRetorne os insights, curiosidades, dados de pesquisa E pessoas-chave no formato JSON estruturado.`

  // Log de diagnóstico
  const totalTokens = estimateTokens(prompt)
  console.log(`[AnalyzeInsights] 📏 Prompt: ~${totalTokens.toLocaleString()} tokens estimados`)

  return prompt
}
