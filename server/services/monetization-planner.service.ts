/**
 * Monetization Planner Service
 * 
 * Usa LangChain + Structured Output para analisar o conteúdo do dossiê
 * e gerar um plano de monetização Document-First:
 * 1 Full Video (YouTube) + 4-6 Teasers (TikTok/Shorts/Reels)
 */

import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { loadSkill } from '../utils/skill-loader'

// =============================================================================
// SCHEMA — Formato estruturado que a IA deve retornar
// =============================================================================

const FullVideoSuggestionSchema = z.object({
  title: z.string().describe('Título otimizado para YouTube (máx. 80 chars)'),
  hook: z.string().describe('Frase de abertura (15-25 palavras)'),
  angle: z.string().describe('Ângulo narrativo principal'),
  structure: z.string().describe('Resumo da estrutura narrativa'),
  keyPoints: z.array(z.string()).min(3).max(5).describe('Pontos-chave que devem aparecer no roteiro'),
  emotionalArc: z.string().describe('Progressão emocional do início ao fim'),
  estimatedViews: z.number().describe('Estimativa conservadora de views'),
  platform: z.literal('YouTube'),
  format: z.literal('full-youtube')
})

const TeaserSuggestionSchema = z.object({
  title: z.string().describe('Título curto e impactante'),
  hook: z.string().describe('Frase de abertura (até 15 palavras), DIFERENTE de todos os outros teasers'),
  angle: z.string().describe('Ângulo narrativo ÚNICO deste teaser'),
  angleCategory: z.enum([
    'cronológico', 'econômico', 'religioso', 'político', 'humano',
    'conspirativo', 'científico', 'geopolítico', 'cultural', 'paradoxal'
  ]).describe('Categoria do ângulo'),
  scriptOutline: z.string().describe('Estrutura resumida do script (Hook → Setup → Revelação → CTA)'),
  visualSuggestion: z.string().describe('Descrição curta do visual sugerido'),
  cta: z.string().describe('Call-to-action para o Full Video'),
  platform: z.enum(['TikTok', 'YouTube Shorts', 'Instagram Reels']).describe('Plataforma alvo'),
  format: z.enum(['teaser-tiktok', 'teaser-reels']).describe('ID do formato de vídeo'),
  estimatedViews: z.number().describe('Estimativa de views na plataforma')
})

const PublicationScheduleSchema = z.object({
  dayOfWeek: z.string().describe('Dia da semana (ex: "Segunda")'),
  content: z.string().describe('O que publicar (ex: "Full Video no YouTube")'),
  platform: z.string().describe('Plataforma alvo'),
  notes: z.string().optional().describe('Notas adicionais sobre timing')
})

const MonetizationPlanSchema = z.object({
  fullVideo: FullVideoSuggestionSchema.describe('Sugestão do vídeo completo para YouTube'),
  teasers: z.array(TeaserSuggestionSchema).min(4).max(6).describe('Lista de 4-6 teasers com ângulos diferentes'),
  publicationSchedule: z.array(PublicationScheduleSchema).min(4).max(10).describe('Cronograma de publicação semanal'),
  estimatedTotalRevenue: z.string().describe('Estimativa de receita total do pacote (ex: "$80-120")'),
  strategicNotes: z.string().describe('Notas estratégicas sobre o plano (o que funciona melhor para este tema)')
})

type MonetizationPlan = z.infer<typeof MonetizationPlanSchema>

// =============================================================================
// TIPOS
// =============================================================================

export interface MonetizationPlannerRequest {
  sourceText: string
  theme: string
  title: string
  sources?: Array<{ title: string; content: string; sourceType: string }>
  notes?: Array<{ content: string; noteType: string }>
  images?: Array<{ description: string }>
  teaserDuration: 60 | 120 | 180
  fullVideoDuration: 300 | 600 | 900
}

export interface MonetizationPlannerResult {
  plan: MonetizationPlan
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// =============================================================================
// SERVICE
// =============================================================================

export async function generateMonetizationPlan(
  request: MonetizationPlannerRequest,
  providerConfig: { name: string; apiKey: string; model?: string; baseUrl?: string }
): Promise<MonetizationPlannerResult> {
  console.log('[MonetizationPlanner] 💰 Iniciando geração de plano de monetização...')
  console.log(`[MonetizationPlanner] ⏱️ Teasers: ${request.teaserDuration}s | Full: ${request.fullVideoDuration / 60}min`)

  // Criar modelo baseado no provider configurado
  const providerName = providerConfig.name.toLowerCase()
  let structuredLlm: any

  if (providerName === 'anthropic') {
    const insightsModel = process.env.ANTHROPIC_MODEL_INSIGHTS || providerConfig.model || 'claude-sonnet-4-20250514'
    const model = new ChatAnthropic({
      anthropicApiKey: providerConfig.apiKey,
      modelName: insightsModel,
      temperature: 0.85,
      maxTokens: 8192
    })
    structuredLlm = model.withStructuredOutput(MonetizationPlanSchema, { includeRaw: true })
  } else {
    // OpenAI (default)
    const model = new ChatOpenAI({
      openAIApiKey: providerConfig.apiKey,
      modelName: providerConfig.model ?? 'gpt-4o-mini',
      configuration: {
        baseURL: providerConfig.baseUrl ?? 'https://api.openai.com/v1'
      },
      temperature: 0.85,
      timeout: 120000,
      maxRetries: 2
    })
    structuredLlm = model.withStructuredOutput(MonetizationPlanSchema, { includeRaw: true })
  }

  // Carregar skill de monetização
  const skillContent = loadSkill('monetization-planner')

  // Montar prompts
  const systemPrompt = buildSystemPrompt(skillContent, request)
  const userPrompt = buildUserPrompt(request)

  const resolvedModel = providerName === 'anthropic'
    ? (process.env.ANTHROPIC_MODEL_INSIGHTS || providerConfig.model || 'claude-sonnet-4-20250514')
    : (providerConfig.model || 'gpt-4o-mini')
  console.log(`[MonetizationPlanner] 📤 Enviando para ${providerName} (${resolvedModel})...`)

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ]

  try {
    const startTime = Date.now()
    const result = await structuredLlm.invoke(messages)
    const content = result.parsed as MonetizationPlan
    const rawMessage = result.raw as any
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    // Extrair token usage
    const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
    const inputTokens = usage?.input_tokens ?? 0
    const outputTokens = usage?.output_tokens ?? 0
    const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

    console.log(`[MonetizationPlanner] ✅ Plano gerado em ${elapsed}s`)
    console.log(`[MonetizationPlanner] 📊 1 Full Video + ${content.teasers.length} Teasers`)
    console.log(`[MonetizationPlanner] 📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)
    console.log(`[MonetizationPlanner] 💵 Receita estimada: ${content.estimatedTotalRevenue}`)

    return {
      plan: content,
      usage: { inputTokens, outputTokens, totalTokens },
      provider: providerName.toUpperCase(),
      model: resolvedModel
    }
  } catch (error) {
    console.error('[MonetizationPlanner] ❌ Erro na geração:', error)
    throw error
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildSystemPrompt(skillContent: string, request: MonetizationPlannerRequest): string {
  const teaserLabel = request.teaserDuration === 60 ? 'curtos (60s)' : request.teaserDuration === 120 ? 'médios (120s)' : 'longos (180s)'
  const fullLabel = `${request.fullVideoDuration / 60} minutos`

  return `${skillContent}

## ⚙️ CONFIGURAÇÃO DESTA SESSÃO

- **Duração dos Teasers:** ${teaserLabel} (${request.teaserDuration} segundos cada)
- **Duração do Full Video:** ${fullLabel} (${request.fullVideoDuration} segundos)
- **Quantidade de Teasers:** Gere entre 4 e 6 teasers, priorizando diversidade de ângulos

### Calibração de profundidade por duração:

**Teasers ${request.teaserDuration}s:**
${request.teaserDuration === 60 ? '- Extremamente direto. Hook (3s) → 1 revelação impactante (40s) → CTA (5s).\n- Sem setup elaborado. Vá direto ao ponto mais chocante.\n- Cada teaser é uma única "bala" de conteúdo.' : ''}
${request.teaserDuration === 120 ? '- Hook (3s) → Setup breve (25s) → Desenvolvimento (50s) → Revelação (30s) → CTA (10s).\n- Permite contexto e buildup antes da revelação.\n- Mais espaço para storytelling, mas ainda precisa ser tenso.' : ''}
${request.teaserDuration === 180 ? '- Hook (5s) → Setup (30s) → Desenvolvimento com 2-3 beats (90s) → Revelação (40s) → CTA (15s).\n- Quase um mini-documentário. Permite arco narrativo completo.\n- Ideal para ângulos que precisam de contexto.' : ''}

**Full Video ${fullLabel}:**
${request.fullVideoDuration === 300 ? '- Vídeo compacto. Hook forte → Contexto mínimo → 3 beats principais → Clímax → CTA rápido.\n- Sem filler. Cada segundo conta.' : ''}
${request.fullVideoDuration === 600 ? '- Formato clássico. Hook → Contexto sólido → 4-5 beats com escalada → Clímax com twist → Resolução → CTA.\n- Equilíbrio entre profundidade e ritmo.' : ''}
${request.fullVideoDuration === 900 ? '- Documentário completo. Hook épico → Contexto profundo → 5-7 beats detalhados → Clímax elaborado → Resolução com múltiplas camadas → CTA reflexivo.\n- Permite nuances, fontes secundárias e conexões históricas.' : ''}

Retorne SEMPRE em JSON estruturado.`
}

function buildUserPrompt(request: MonetizationPlannerRequest): string {
  let prompt = `Analise o seguinte dossiê e crie um plano de monetização Document-First:\n\n`

  prompt += `📋 TÍTULO: ${request.title}\n`
  prompt += `📋 TEMA: ${request.theme}\n\n`
  prompt += `📄 DOCUMENTO PRINCIPAL:\n${request.sourceText}\n\n`

  if (request.sources && request.sources.length > 0) {
    prompt += `📚 FONTES SECUNDÁRIAS:\n`
    request.sources.forEach((source, i) => {
      prompt += `[${i + 1}] (${source.sourceType}) ${source.title}\n${source.content}\n---\n`
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

  if (request.images && request.images.length > 0) {
    prompt += `🖼️ IMAGENS DE REFERÊNCIA:\n`
    request.images.forEach((img, i) => {
      prompt += `[${i + 1}] ${img.description}\n`
    })
    prompt += '\n'
  }

  prompt += `\nCrie o plano de monetização completo em JSON estruturado.`
  prompt += `\nLembre-se: teasers de ${request.teaserDuration}s e full video de ${request.fullVideoDuration / 60} minutos.`

  return prompt
}
