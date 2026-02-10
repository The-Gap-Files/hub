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
import { serializeConstantsCatalog } from '../utils/constants-catalog'
import type { CreativeDirection } from './creative-direction-advisor.service'

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
  format: z.literal('full-youtube'),
  // ── Creative Direction ─────────────────────────────────────────
  scriptStyleId: z.string().describe('ID do estilo de roteiro atribuído (ex: "mystery", "documentary")'),
  scriptStyleName: z.string().describe('Nome legível do estilo de roteiro'),
  editorialObjectiveId: z.string().describe('ID do objetivo editorial (ex: "hidden-truth", "viral-hook")'),
  editorialObjectiveName: z.string().describe('Nome legível do objetivo editorial'),
  // ── Visual Preview ──────────────────────────────────────────────
  visualPrompt: z.string().describe('Prompt de imagem (inglês, 1 parágrafo) descrevendo uma cena representativa no estilo visual ÚNICO do plano. Deve incluir atmosfera, iluminação, composição e estilo artístico.'),
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
  estimatedViews: z.number().describe('Estimativa de views na plataforma'),
  // ── Creative Direction ─────────────────────────────────────────
  scriptStyleId: z.string().describe('ID do estilo de roteiro atribuído a este teaser'),
  scriptStyleName: z.string().describe('Nome legível do roteiro'),
  editorialObjectiveId: z.string().describe('ID do objetivo editorial deste teaser'),
  editorialObjectiveName: z.string().describe('Nome legível do objetivo editorial'),
  // ── Visual Preview ──────────────────────────────────────────────
  visualPrompt: z.string().describe('Prompt de imagem (inglês, 1 parágrafo) para este teaser, usando o estilo visual ÚNICO do plano. Deve refletir o ângulo narrativo específico do teaser.'),
})

const PublicationScheduleSchema = z.object({
  dayOfWeek: z.string().describe('Dia da semana (ex: "Segunda")'),
  content: z.string().describe('O que publicar (ex: "Full Video no YouTube")'),
  platform: z.string().describe('Plataforma alvo'),
  notes: z.string().optional().describe('Notas adicionais sobre timing')
})

const MonetizationPlanSchema = z.object({
  // ── Estilo Visual Único do Plano ───────────────────────────────
  visualStyleId: z.string().describe('ID do estilo visual ÚNICO para TODO o plano (ex: "ghibli-dark", "cyberpunk"). Todos os itens compartilham este estilo.'),
  visualStyleName: z.string().describe('Nome legível do estilo visual escolhido para o plano'),
  // ── Conteúdo ──────────────────────────────────────────────────
  fullVideo: FullVideoSuggestionSchema.describe('Sugestão do vídeo completo para YouTube'),
  teasers: z.array(TeaserSuggestionSchema).min(4).max(6).describe('Lista de 4-6 teasers com ângulos diferentes'),
  publicationSchedule: z.array(PublicationScheduleSchema).min(4).max(10).describe('Cronograma de publicação semanal'),
  estimatedTotalRevenue: z.string().describe('Estimativa de receita total do pacote (ex: "$80-120")'),
  strategicNotes: z.string().describe('Notas estratégicas sobre o plano (o que funciona melhor para este tema)')
})

type MonetizationPlan = z.infer<typeof MonetizationPlanSchema>

// Schema para regeneração individual (retorna só 1 item)
const SingleTeaserSchema = TeaserSuggestionSchema.describe('Teaser regenerado com ângulo diferente')
const SingleFullVideoSchema = FullVideoSuggestionSchema.describe('Full Video regenerado com ângulo diferente')

// Schema para regeneração do cronograma
const RegeneratedScheduleSchema = z.object({
  publicationSchedule: z.array(PublicationScheduleSchema).min(4).max(10)
    .describe('Cronograma de publicação semanal atualizado com os títulos e plataformas atuais')
})

// =============================================================================
// TIPOS
// =============================================================================

export interface RegenerateItemRequest {
  type: 'teaser' | 'fullVideo'
  index?: number
  currentPlan: MonetizationPlan
  dossierContext: {
    theme: string
    title: string
    sources?: Array<{ title: string; content: string; sourceType: string }>
    notes?: Array<{ content: string; noteType: string }>
  }
  teaserDuration: 60 | 120 | 180
  fullVideoDuration: 300 | 600 | 900
  userSuggestion?: string
}

export interface RegenerateItemResult {
  item: any
  updatedSchedule?: any[]
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

export interface MonetizationPlannerRequest {
  theme: string
  title: string
  sources?: Array<{ title: string; content: string; sourceType: string }>
  notes?: Array<{ content: string; noteType: string }>
  images?: Array<{ description: string }>
  teaserDuration: 60 | 120 | 180
  fullVideoDuration: 300 | 600 | 900
  /** Direção criativa pré-gerada (opcional). Se fornecida, guia as escolhas de estilo. */
  creativeDirection?: CreativeDirection
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

  // Catálogo de constants para a IA conhecer as opções disponíveis
  const catalog = serializeConstantsCatalog()

  // Bloco de creative direction pré-gerada (se houver)
  let creativeDirectionBlock = ''
  if (request.creativeDirection) {
    const cd = request.creativeDirection
    creativeDirectionBlock = `

## 🎨 DIREÇÃO CRIATIVA PRÉ-APROVADA

O usuário já passou por uma análise de direção criativa. Use estas recomendações como GUIA (não obrigação absoluta, mas forte preferência):

**Full Video:**
- Roteiro: \`${cd.fullVideo.scriptStyle.id}\` (${cd.fullVideo.scriptStyle.name})
- Visual: \`${cd.fullVideo.visualStyle.id}\` (${cd.fullVideo.visualStyle.name})
- Editorial: \`${cd.fullVideo.editorialObjective.id}\` (${cd.fullVideo.editorialObjective.name})

**Teasers (sugestões por ângulo):**
${cd.teaserRecommendations.map((t, i) => `${i + 1}. Ângulo "${t.suggestedAngle}": roteiro=\`${t.scriptStyle.id}\`, visual=\`${t.visualStyle.id}\`, editorial=\`${t.editorialObjective.id}\``).join('\n')}

Se a direção criativa recomendou "custom", use seu melhor julgamento com base no conteúdo do dossiê.`
  }

  return `${skillContent}

## 📚 CATÁLOGO DE CONSTANTS DISPONÍVEIS

Para cada item (Full Video e cada Teaser), você DEVE atribuir:
- **scriptStyleId** + **scriptStyleName**: Estilo de roteiro
- **visualStyleId** + **visualStyleName**: Estilo visual
- **editorialObjectiveId** + **editorialObjectiveName**: Objetivo editorial

Use APENAS os IDs listados abaixo. Cada teaser pode ter combinação DIFERENTE do Full Video.

${catalog}
${creativeDirectionBlock}

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
${request.fullVideoDuration === 900 ? '- Documentário completo. Hook épico → Contexto profundo → 5-7 beats detalhados → Clímax elaborado → Resolução com múltiplas camadas → CTA reflexivo.\n- Permite nuances, fontes adicionais e conexões históricas.' : ''}

Retorne SEMPRE em JSON estruturado.`
}

// =============================================================================
// REGENERATE SINGLE ITEM
// =============================================================================

export async function regenerateMonetizationItem(
  request: RegenerateItemRequest,
  providerConfig: { name: string; apiKey: string; model?: string; baseUrl?: string }
): Promise<RegenerateItemResult> {
  const isTeaser = request.type === 'teaser'
  const schema = isTeaser ? SingleTeaserSchema : SingleFullVideoSchema
  const label = isTeaser ? `Teaser #${(request.index ?? 0) + 1}` : 'Full Video'

  console.log(`[MonetizationPlanner] 🔄 Regenerando ${label}...`)

  const providerName = providerConfig.name.toLowerCase()
  let structuredLlm: any

  if (providerName === 'anthropic') {
    const insightsModel = process.env.ANTHROPIC_MODEL_INSIGHTS || providerConfig.model || 'claude-sonnet-4-20250514'
    const model = new ChatAnthropic({
      anthropicApiKey: providerConfig.apiKey,
      modelName: insightsModel,
      temperature: 0.95,
      maxTokens: 4096
    })
    structuredLlm = model.withStructuredOutput(schema, { includeRaw: true })
  } else {
    const model = new ChatOpenAI({
      openAIApiKey: providerConfig.apiKey,
      modelName: providerConfig.model ?? 'gpt-4o-mini',
      configuration: { baseURL: providerConfig.baseUrl ?? 'https://api.openai.com/v1' },
      temperature: 0.95,
      timeout: 60000,
      maxRetries: 2
    })
    structuredLlm = model.withStructuredOutput(schema, { includeRaw: true })
  }

  // Montar prompt de regeneração
  const existingAngles = request.currentPlan.teasers.map(t => t.angleCategory)
  const currentItem = isTeaser && request.index != null
    ? request.currentPlan.teasers[request.index]
    : request.currentPlan.fullVideo

  // Bloco de sugestão do usuário (se houver)
  const suggestionBlock = request.userSuggestion
    ? `

## Sugestão do usuário (ORIENTAÇÃO, NÃO OBRIGAÇÃO):
O usuário deixou uma sugestão. Trate como DIREÇÃO CRIATIVA, não como instrução literal.
Use como inspiração para guiar o ângulo, mas aplique seu próprio julgamento editorial.
Se a sugestão não fizer sentido para o conteúdo, ignore-a e siga o melhor caminho narrativo.

> "${request.userSuggestion}"`
    : ''

  // Catálogo de constants para regeneração
  const catalog = serializeConstantsCatalog()

  const systemMsg = `Você é um estrategista de conteúdo especializado em Document-First para YouTube, TikTok, Shorts e Reels.

O usuário já tem um plano de monetização gerado. Ele quer REGENERAR apenas ${isTeaser ? 'um teaser específico' : 'o Full Video'} com um ângulo COMPLETAMENTE DIFERENTE.

## Catálogo de Constants Disponíveis

Para o item regenerado, você DEVE atribuir scriptStyleId/Name, visualStyleId/Name, editorialObjectiveId/Name.

${catalog}

## Regras:
1. O novo item DEVE ter um ângulo narrativo totalmente diferente do atual
2. ${isTeaser ? `Evite as categorias já usadas: ${existingAngles.join(', ')}` : 'Traga uma perspectiva inesperada, diferente da atual'}
3. Mantenha a qualidade e o formato estruturado
4. O hook DEVE ser original e diferente
5. Atribua scriptStyleId, visualStyleId e editorialObjectiveId usando os IDs do catálogo acima
6. Retorne em JSON estruturado
7. Se o usuário deixou uma sugestão, use-a como DIREÇÃO CRIATIVA — não como ordem. Avalie se faz sentido e adapte ao conteúdo`

  const userMsg = `## Dossiê
Título: ${request.dossierContext.title}
Tema: ${request.dossierContext.theme}

## Item atual (que o usuário NÃO gostou):
${JSON.stringify(currentItem, null, 2)}

## Ângulos já existentes no plano:
${existingAngles.join(', ')}
${suggestionBlock}

Gere um ${isTeaser ? `teaser de ${request.teaserDuration}s` : `Full Video de ${request.fullVideoDuration / 60} minutos`} com ângulo COMPLETAMENTE DIFERENTE.`

  const messages = [
    new SystemMessage(systemMsg),
    new HumanMessage(userMsg)
  ]

  const startTime = Date.now()
  const result = await structuredLlm.invoke(messages)
  const content = result.parsed
  const rawMessage = result.raw as any
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

  const resolvedModel = providerName === 'anthropic'
    ? (process.env.ANTHROPIC_MODEL_INSIGHTS || providerConfig.model || 'claude-sonnet-4-20250514')
    : (providerConfig.model || 'gpt-4o-mini')

  console.log(`[MonetizationPlanner] ✅ ${label} regenerado em ${elapsed}s (${totalTokens} tokens)`)

  // ── Passo 2: Regenerar cronograma com o plano atualizado ──
  const updatedPlan = { ...request.currentPlan }
  if (isTeaser && request.index != null) {
    updatedPlan.teasers = [...updatedPlan.teasers]
    updatedPlan.teasers[request.index] = content
  } else {
    updatedPlan.fullVideo = content
  }

  let updatedSchedule: any[] | undefined
  let scheduleTokens = { input: 0, output: 0 }

  try {
    console.log(`[MonetizationPlanner] 📅 Regenerando cronograma...`)

    let scheduleLlm: any
    if (providerName === 'anthropic') {
      const insightsModel2 = process.env.ANTHROPIC_MODEL_INSIGHTS || providerConfig.model || 'claude-sonnet-4-20250514'
      const model2 = new ChatAnthropic({
        anthropicApiKey: providerConfig.apiKey,
        modelName: insightsModel2,
        temperature: 0.7,
        maxTokens: 2048
      })
      scheduleLlm = model2.withStructuredOutput(RegeneratedScheduleSchema, { includeRaw: true })
    } else {
      const model2 = new ChatOpenAI({
        openAIApiKey: providerConfig.apiKey,
        modelName: providerConfig.model ?? 'gpt-4o-mini',
        configuration: { baseURL: providerConfig.baseUrl ?? 'https://api.openai.com/v1' },
        temperature: 0.7,
        timeout: 30000,
        maxRetries: 1
      })
      scheduleLlm = model2.withStructuredOutput(RegeneratedScheduleSchema, { includeRaw: true })
    }

    const fullVideoTitle = updatedPlan.fullVideo.title
    const teaserList = updatedPlan.teasers
      .map((t: any, i: number) => `${i + 1}. "${t.title}" (${t.platform}, ${t.angleCategory})`)
      .join('\n')

    const scheduleMessages = [
      new SystemMessage(`Você é um estrategista de publicação de conteúdo. Crie um cronograma de publicação semanal otimizado para os vídeos listados. Use os títulos e plataformas EXATOS fornecidos. Distribua os conteúdos ao longo da semana para maximizar engajamento. Retorne em JSON estruturado.`),
      new HumanMessage(`Crie o cronograma de publicação para este pacote de conteúdo:

## Full Video (YouTube):
"${fullVideoTitle}"

## Teasers:
${teaserList}

Distribua ao longo da semana (Segunda a Domingo). O Full Video geralmente vai no meio da semana. Teasers vão antes e depois para gerar expectativa e reforço.`)
    ]

    const scheduleResult = await scheduleLlm.invoke(scheduleMessages)
    updatedSchedule = scheduleResult.parsed?.publicationSchedule
    const scheduleRaw = scheduleResult.raw as any
    const scheduleUsage = scheduleRaw?.usage_metadata || scheduleRaw?.response_metadata?.usage
    scheduleTokens.input = scheduleUsage?.input_tokens ?? 0
    scheduleTokens.output = scheduleUsage?.output_tokens ?? 0

    console.log(`[MonetizationPlanner] 📅 Cronograma atualizado (${scheduleTokens.input + scheduleTokens.output} tokens)`)
  } catch (scheduleError) {
    console.warn('[MonetizationPlanner] ⚠️ Falha ao regenerar cronograma (mantendo anterior):', scheduleError)
    // Não é fatal — o cronograma antigo permanece
  }

  return {
    item: content,
    updatedSchedule,
    usage: {
      inputTokens: inputTokens + scheduleTokens.input,
      outputTokens: outputTokens + scheduleTokens.output,
      totalTokens: totalTokens + scheduleTokens.input + scheduleTokens.output
    },
    provider: providerName.toUpperCase(),
    model: resolvedModel
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildUserPrompt(request: MonetizationPlannerRequest): string {
  let prompt = `Analise o seguinte dossiê e crie um plano de monetização Document-First:\n\n`

  prompt += `📋 TÍTULO: ${request.title}\n`
  prompt += `📋 TEMA: ${request.theme}\n\n`

  if (request.sources && request.sources.length > 0) {
    prompt += `📚 FONTES DO DOSSIÊ:\n`
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
