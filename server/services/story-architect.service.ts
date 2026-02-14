/**
 * Story Architect Service
 * 
 * Usa LangChain + Structured Output (Sonnet) para gerar um plano narrativo
 * estruturado ANTES da geração do roteiro pelo Opus.
 * 
 * Fluxo: Dossiê → analyzeInsights → storyArchitect → generateScript
 * 
 * O outline gerado é salvo no campo Output.storyOutline (Json) e injetado
 * no prompt do Opus como "blueprint narrativo" que o roteirista deve seguir.
 */

import { z } from 'zod'
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { loadSkill } from '../utils/skill-loader'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import type { PersonContext, NeuralInsightContext } from '../utils/format-intelligence-context'
import { formatPersonsForPrompt, formatNeuralInsightsForPrompt } from '../utils/format-intelligence-context'
import { buildDossierBlock } from '../utils/dossier-prompt-block'
import { buildCacheableMessages, logCacheMetrics, shouldApplyCache } from './llm/anthropic-cache-helper'

// =============================================================================
// SCHEMA - Formato estruturado que a IA deve retornar
// =============================================================================

const HookVariantSchema = z.object({
  level: z.enum(['green', 'moderate', 'aggressive', 'lawless']).describe(
    'Nível tonal: green (seguro/informativo), moderate (provocativo mas contido), aggressive (no limite do YouTube), lawless (ultrapassa diretrizes — referência extrema)'
  ),
  hook: z.string().describe('Frase de hook (15-30 palavras) calibrada para o nível tonal'),
  rationale: z.string().describe('Por que esse tom funciona para este tema (1 frase)')
})

const RisingBeatSchema = z.object({
  order: z.number().describe('Ordem do beat (1, 2, 3...)'),
  revelation: z.string().describe('O que é revelado neste beat'),
  questionAnswered: z.string().describe('Que pergunta este beat responde'),
  newQuestion: z.string().describe('Que NOVA pergunta este beat levanta (curiosity gap)'),
  sourceReference: z.string().describe('Onde no material do dossiê está a evidência para este beat')
})

const SegmentDistributionSchema = z.object({
  hook: z.number().describe('Número de cenas para o HOOK (cada cena = 5s)'),
  context: z.number().describe('Número de cenas para CONTEXT/SETUP'),
  rising: z.number().describe('Número de cenas para RISING ACTION (todos os beats)'),
  climax: z.number().describe('Número de cenas para CLIMAX'),
  resolution: z.number().describe('Número de cenas para RESOLUTION'),
  cta: z.number().describe('Número de cenas para CTA')
})

const StoryOutlineSchema = z.object({
  // Estratégia de abertura
  hookStrategy: z.string().describe('Técnica de abertura e por que funciona para este tema'),
  hookVariants: z.array(HookVariantSchema).length(4).describe(
    '4 variantes de hook com níveis tonais diferentes (green, moderate, aggressive, lawless). O usuário escolherá uma.'
  ),

  // Setup
  promiseSetup: z.string().describe('Como o contexto será estabelecido após o hook + qual a promessa implícita'),

  // Beats narrativos
  risingBeats: z.array(RisingBeatSchema).min(2).max(8).describe('Beats de revelação progressiva em ordem (shorts competitivos: 2-4 beats)'),

  // Clímax (opcional para hook-only — pode ser vazio quando resolutionLevel=none)
  climaxMoment: z.string().describe('A revelação central que recontextualiza tudo. Para hook-only (resolutionLevel=none), pode ser vazio.'),
  climaxFormula: z.string().describe('Qual fórmula de clímax (Pattern Recognition, Document Drop, Connection Shock, Data Inflection, Problem-Solution). Para hook-only, pode ser vazio.'),

  // Resolução (opcional para hook-only — pode ser vazio quando resolutionLevel=none)
  resolutionPoints: z.array(z.string()).max(4).describe('2-3 pontos-chave do recap. Para hook-only (resolutionLevel=none), pode ser array vazio [].'),
  resolutionAngle: z.string().describe('A implicação maior — o que fica com o espectador. Para hook-only, pode ser vazio.'),

  // CTA (opcional para hook-only — pode ser minimalista)
  ctaApproach: z.string().describe('Estratégia de fechamento: deve incluir (1) convite para o espectador seguir/inscrever-se no canal, no tom do vídeo, e (2) menção ao canal The Gap Files como assinatura. Para hook-only, pode ser apenas assinatura minimalista ("The Gap Files").'),

  // Direção emocional (opcional para hook-only)
  emotionalArc: z.string().describe('Progressão emocional do início ao fim (ex: Curiosidade → Indignação → Compreensão). Para hook-only, pode ser vazio.'),
  toneProgression: z.string().describe('Como o tom da narração evolui (ex: Factual → Tenso → Revelador → Reflexivo). Para hook-only, pode ser vazio.'),

  // Decisões editoriais (opcional para hook-only)
  whatToReveal: z.array(z.string()).describe('Fatos/dados que DEVEM aparecer no roteiro. Para hook-only, pode ser array vazio [].'),
  whatToHold: z.array(z.string()).describe('Informações sugeridas mas NÃO explicitadas'),
  whatToIgnore: z.array(z.string()).describe('Material do dossiê que NÃO serve para este roteiro'),

  // Distribuição de tempo
  segmentDistribution: SegmentDistributionSchema.describe('Distribuição de cenas por segmento narrativo'),

  // ── Curva de tensão e Open Loops (Funnel Mechanics) ──────────
  tensionCurve: z.array(z.enum(['low', 'medium', 'high', 'pause', 'peak'])).describe(
    'Nível de intensidade de cada beat em ordem. DEVE incluir pelo menos 1 "pause" antes do "peak". ' +
    'Padrão ideal: low → medium → high → pause → peak. ' +
    'Intensidade linear constante = fadiga cognitiva. Ondas = retenção.'
  ),
  openLoops: z.array(z.object({
    question: z.string().describe('A pergunta/thread narrativo aberto'),
    openedAtBeat: z.number().describe('Em qual beat (order) este loop foi aberto'),
    closedAtBeat: z.number().nullable().describe('Em qual beat foi fechado (null = fica aberto — funil para Full Video)')
  })).min(1).describe(
    'Lista de threads narrativos abertos e fechados. ' +
    'Para teasers, DEVE haver pelo menos 1 loop com closedAtBeat=null (aberto no final). ' +
    'Para hook-only, TODOS os loops devem ter closedAtBeat=null.'
  ),
  resolutionLevel: z.enum(['none', 'partial', 'full']).describe(
    'Quanto o teaser resolve a história. ' +
    'none = pura provocação (hook-only). ' +
    'partial = contextualiza mas não fecha (gateway/deep-dive). ' +
    'full = história completa (APENAS para full video, NUNCA para teasers).'
  )
})

export type StoryOutline = z.infer<typeof StoryOutlineSchema>
export type HookVariant = z.infer<typeof HookVariantSchema>

// =============================================================================
// TIPOS
// =============================================================================

export interface StoryArchitectRequest {
  theme: string
  visualIdentityContext?: string
  sources?: Array<{ title: string; content: string; type: string; weight?: number }>
  userNotes?: string[]
  editorialObjective?: string // Texto do editorial objective
  scriptStyleId?: string // 'documentary' | 'mystery' | etc.
  dossierCategory?: string // Classificação temática: 'true-crime', 'conspiração', etc.
  targetDuration: number // Em segundos
  language?: string

  // Persons & Neural Insights (Intelligence Center)
  persons?: PersonContext[]
  neuralInsights?: NeuralInsightContext[]

  // Asset descriptions (descrições textuais dos assets visuais do dossiê)
  imageDescriptions?: string[]

  // Diretrizes do usuário (do Output)
  mustInclude?: string
  mustExclude?: string

  // Dados estruturados do dossiê (fatos, datas, pessoas em JSON)
  researchData?: any

  // Monetization Context (quando gerado a partir de um item do plano de monetização)
  monetizationContext?: {
    itemType: 'teaser' | 'fullVideo'
    title: string
    hook: string
    angle: string
    angleCategory: string
    narrativeRole?: string // 'gateway' | 'deep-dive' | 'hook-only'
    shortFormatType?: string // 'hook-brutal' | 'pergunta-incomoda' | 'plot-twist' | etc.
    scriptOutline?: string
    cta?: string
    strategicNotes?: string
    avoidPatterns?: string[]
  }
}

export interface StoryArchitectResult {
  outline: StoryOutline
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// =============================================================================
// SERVICE
// =============================================================================

export async function generateStoryOutline(
  request: StoryArchitectRequest
): Promise<StoryArchitectResult> {
  console.log('[StoryArchitect] 🏗️ Iniciando planejamento narrativo...')

  const assignment = await getAssignment('story-architect')
  const model = await createLlmForTask('story-architect')

  // Gemini API requer method 'jsonSchema' (Zod v4 compat)
  const isGemini = assignment.provider.toLowerCase().includes('gemini') || assignment.provider.toLowerCase().includes('google')
  const isReplicate = assignment.provider.toLowerCase().includes('replicate')
  // Groq Llama 4: forçar jsonMode. GPT-OSS: SDK autodetecta jsonSchema → sem override.
  const isGroqLlama4 = assignment.provider.toLowerCase().includes('groq') && assignment.model.includes('llama-4')

  let structuredLlm: any
  if (isReplicate && typeof (model as any).withStructuredOutputReplicate === 'function') {
    console.log('[StoryArchitect] 🔧 Structured output: replicate (invoke + parse)')
    structuredLlm = (model as any).withStructuredOutputReplicate(StoryOutlineSchema, { includeRaw: true })
  } else {
    const method = isGemini ? 'jsonSchema' : isGroqLlama4 ? 'jsonMode' : undefined
    structuredLlm = (model as any).withStructuredOutput(StoryOutlineSchema, {
      includeRaw: true,
      ...(method ? { method } : {})
    })
  }

  const systemPrompt = buildSystemPrompt(request)
  const userPrompt = buildUserPrompt(request)

  // ── Prompt Caching: montar dossiê canônico ──────────────────────
  const dossierBlock = buildDossierBlock({
    theme: request.theme,
    visualIdentityContext: request.visualIdentityContext,
    sources: request.sources,
    userNotes: request.userNotes,
    imageDescriptions: request.imageDescriptions,
    persons: request.persons,
    neuralInsights: request.neuralInsights
  })

  const isAnthropicProvider = assignment.provider.toLowerCase().includes('anthropic') || assignment.provider.toLowerCase().includes('claude')
  const cacheResult = buildCacheableMessages({
    dossierBlock,
    systemPrompt,
    taskPrompt: userPrompt,
    providerName: isAnthropicProvider ? 'ANTHROPIC' : assignment.provider
  })

  console.log(`[StoryArchitect] 📤 Enviando para ${assignment.provider} (${assignment.model})...`)
  console.log('[StoryArchitect] 🎯 Editorial Objective:', request.editorialObjective ? 'Sim' : 'Não definido')
  console.log('[StoryArchitect] 🎬 Script Style:', request.scriptStyleId || 'default')
  console.log('[StoryArchitect] ⏱️ Target Duration:', request.targetDuration, 'seconds')
  console.log('[StoryArchitect] 👤 Persons:', request.persons?.length || 0)
  console.log('[StoryArchitect] 🧠 Neural Insights:', request.neuralInsights?.length || 0)
  if (request.monetizationContext) {
    console.log(`[StoryArchitect] 💰 Monetization: ${request.monetizationContext.itemType} (${request.monetizationContext.angleCategory})`)
  }
  if (cacheResult.cacheEnabled) {
    console.log(`[StoryArchitect] 🗄️ Cache ativado — dossiê: ~${cacheResult.estimatedCacheTokens} tokens`)
  }

  const messages = [...cacheResult.messages]

  try {
    const startTime = Date.now()
    const { invokeWithLogging } = await import('../utils/llm-invoke-wrapper')
    const result = await invokeWithLogging(structuredLlm, messages, {
      taskId: 'story-architect',
      provider: assignment.provider,
      model: assignment.model
    })
    let content = result.parsed as StoryOutline | null
    const rawMessage = result.raw as any
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    // Fallback: Zod v4 compat — parsed pode ser null com Gemini
    if (!content) {
      console.warn('[StoryArchitect] ⚠️ result.parsed é null — tentando fallback manual...')
      try {
        const candidates = rawMessage?.lc_kwargs?.content || rawMessage?.content
        if (typeof candidates === 'string') {
          const cleaned = candidates.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          content = JSON.parse(cleaned)
          console.log('[StoryArchitect] ✅ Fallback parse bem sucedido')
        } else if (Array.isArray(candidates)) {
          for (const part of candidates) {
            if (part?.type === 'text' && part?.text) {
              const cleaned = part.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
              content = JSON.parse(cleaned)
              console.log('[StoryArchitect] ✅ Fallback parse bem sucedido (array)')
              break
            }
          }
        }
      } catch (e) {
        console.warn('[StoryArchitect] ⚠️ Fallback parse falhou:', e)
      }
      if (!content) {
        throw new Error('Falha no parsing do outline. Nem structured output nem fallback manual funcionaram.')
      }
    }

    // -- VALIDAÇÃO NARRATIVA (AUTO-CORREÇÃO) --
    // Trigger: teasers com narrativeRole OU fullVideo (que não tem narrativeRole)
    const hasValidationContext = content && request.monetizationContext && (
      request.monetizationContext.narrativeRole || request.monetizationContext.itemType === 'fullVideo'
    )
    if (hasValidationContext) {
      const { narrativeRole, angleCategory, avoidPatterns, itemType, angle } = request.monetizationContext!
      const maxRetries = 5
      let attempts = 0
      let isValid = false

      // Import dinâmico para evitar dependência circular se houver
      const { validateStoryOutline } = await import('./story-validator.service')

      while (!isValid && attempts < maxRetries) {
        console.log(`[StoryArchitect] 🔍 Validando narrativa (Tentativa ${attempts + 1}/${maxRetries + 1})...`)

        const validation = await validateStoryOutline(content, {
          itemType,
          narrativeRole: narrativeRole || 'full-video',
          angleCategory,
          angleDescription: angle,
          avoidPatterns
        })

        if (validation.approved) {
          isValid = true
          console.log(`[StoryArchitect] ✅ Outline APROVADO pelo validador.`)
        } else {
          attempts++
          console.warn(`[StoryArchitect] ❌ Outline REPROVADO. Violações: ${validation.violations?.join(' | ')}`)

          if (attempts <= maxRetries) {
            const correctionInstruction = `
🚨 FEEDBACK CRÍTICO DE CORREÇÃO (O ANTERIOR FOI REPROVADO):
O outline gerado VIOLOU as regras narrativas do ângulo/role.
MOTIVOS:
${validation.violations?.map(v => `- ${v}`).join('\n')}

INSTRUÇÃO DE CORREÇÃO:
${validation.corrections}

⚠️ GERE O OUTLINE NOVAMENTE CORRIGINDO ESSES PONTOS.
MANTENHA O QUE ESTAVA BOM, MAS REMOVA/ALTERE O QUE VIOLOU AS REGRAS.

⚠️ REGRA DE PRIORIDADE: Os avoidPatterns SEMPRE têm prioridade sobre qualquer outra regra.
Se datas são proibidas nos avoidPatterns, NÃO inclua datas (nem no anchor). Use apenas local.
`
            // Adiciona feedback e tenta de novo
            // Nota: Estamos re-usando o messages array, adicionando o output anterior e o feedback
            // Isso mantém o contexto do que foi gerado errado para ele saber o que NÃO fazer
            messages.push(new AIMessage(JSON.stringify(content)))
            messages.push(new HumanMessage(correctionInstruction))

            console.log(`[StoryArchitect] 🔄 Regenerando outline com feedback de correção...`)

            try {
              const retryResult = await invokeWithLogging(structuredLlm, messages, {
                taskId: 'story-architect-retry',
                provider: assignment.provider,
                model: assignment.model
              })
              const retryContent = retryResult.parsed as StoryOutline | null
              // Se o retry falhar no parse, mantemos o anterior (fail safe)
              if (retryContent) {
                content = retryContent
              } else {
                console.warn(`[StoryArchitect] ⚠️ Retry falhou no parsing. Mantendo versão anterior com erros.`)
                break // Sai do loop para não insistir em erro técnico
              }
            } catch (retryError: any) {
              // Rate limit: parar imediatamente para não desperdiçar tokens
              const statusCode = retryError?.status || retryError?.statusCode || retryError?.response?.status
              const errorMsg = retryError?.message || ''
              if (statusCode === 429 || errorMsg.includes('rate_limit') || errorMsg.includes('Rate limit')) {
                console.warn(`[StoryArchitect] ⚠️ Rate limit atingido. Parando retries e usando último outline disponível.`)
                break
              }
              throw retryError
            }
          }
        }
      }

      if (!isValid) {
        console.warn(`[StoryArchitect] ⚠️ Outline salvo com avisos após ${attempts} tentativas de correção.`)
      }
    }

    // Extrair token usage
    const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
    const inputTokens = usage?.input_tokens ?? 0
    const outputTokens = usage?.output_tokens ?? 0
    const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

    console.log(`[StoryArchitect] ✅ Plano narrativo gerado em ${elapsed}s`)
    console.log(`[StoryArchitect] 📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)

    // ── Log de métricas de cache ──────────────────────────────────
    if (cacheResult.cacheEnabled) {
      logCacheMetrics('StoryArchitect', rawMessage)
    }

    // Log das 3 variantes de hook
    if (content.hookVariants?.length) {
      content.hookVariants.forEach((v: any) => {
        const emoji = v.level === 'green' ? '🟢' : v.level === 'moderate' ? '🟡' : v.level === 'aggressive' ? '🔴' : '☠️'
        console.log(`[StoryArchitect] ${emoji} Hook (${v.level}): "${v.hook.substring(0, 60)}..."`)
      })
    }
    console.log(`[StoryArchitect] 📈 Beats: ${content.risingBeats.length} revelações progressivas`)
    console.log(`[StoryArchitect] 🎯 Clímax: ${content.climaxFormula}`)
    console.log(`[StoryArchitect] 💓 Arco emocional: ${content.emotionalArc}`)

    // Validar distribuição de cenas
    const totalScenes = Object.values(content.segmentDistribution).reduce((a, b) => a + b, 0)
    const expectedScenes = Math.ceil(request.targetDuration / 5)
    console.log(`[StoryArchitect] 📐 Distribuição: ${totalScenes} cenas planejadas (esperado: ${expectedScenes})`)

    return {
      outline: content,
      usage: { inputTokens, outputTokens, totalTokens },
      provider: assignment.provider.toUpperCase(),
      model: assignment.model
    }
  } catch (error: any) {
    const { handleGroqJsonValidateError } = await import('../utils/groq-error-handler')

    // Validação customizada: rejeitar se for o schema ao invés de dados
    const validateIsNotSchema = (data: any) => {
      if (data?.$schema || (data?.properties && !data?.hookStrategy)) {
        console.error('[StoryArchitect] ❌ Modelo retornou JSON Schema ao invés de dados. Schema muito complexo para GPT-OSS.')
        return false
      }
      return true
    }

    const result = handleGroqJsonValidateError<StoryOutline>(error, '[StoryArchitect]', validateIsNotSchema)

    if (result.success) {
      return {
        outline: result.data,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        provider: assignment.provider.toUpperCase(),
        model: assignment.model
      }
    }

    console.error('[StoryArchitect] ❌ Erro no planejamento narrativo:', error)
    throw error
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildSystemPrompt(request: StoryArchitectRequest): string {
  // Carregar a skill do Story Architect — usa skill especializada para full video
  const isFullVideo = request.monetizationContext?.itemType === 'fullVideo'
  const skillName = isFullVideo ? 'full-video/story-architect' : 'teaser/story-architect'
  const architectSkill = loadSkill(skillName)

  if (isFullVideo) {
    console.log('[StoryArchitect] 🎬 Usando skill FULL VIDEO para outline')
  }

  return `${architectSkill}

---
PARÂMETROS TÉCNICOS:
- Duração total do vídeo: ${request.targetDuration} segundos
- Cada cena dura 5 segundos
- Total de cenas esperado: ${Math.ceil(request.targetDuration / 5)}
- A soma de todas as cenas na distribuição DEVE ser igual a ${Math.ceil(request.targetDuration / 5)}
- Idioma do roteiro: ${request.language || 'pt-BR'}
- Tipo de conteúdo: ${isFullVideo ? 'FULL VIDEO (vídeo completo longo)' : 'TEASER (vídeo curto)'}`
}

function buildUserPrompt(request: StoryArchitectRequest): string {
  let prompt = `Analise o seguinte dossiê e crie o plano narrativo estruturado:\n\n`

  prompt += `📋 TEMA: ${request.theme}\n\n`

  // ── Contexto de Monetização (se veio de um item do plano) ──────────
  if (request.monetizationContext) {
    const mc = request.monetizationContext
    prompt += `🎯 CONTEXTO DE MONETIZAÇÃO — ESTE OUTLINE É BASEADO EM UM ITEM DO PLANO\n\n`
    prompt += `Este outline deve seguir a direção de um **${mc.itemType === 'teaser' ? 'teaser' : 'full video'}** planejado:\n`
    prompt += `- **Título planejado:** ${mc.title}\n`
    prompt += `- **Hook sugerido:** "${mc.hook}"\n`
    prompt += `- **Ângulo narrativo:** ${mc.angle} (categoria: ${mc.angleCategory})\n`
    if (mc.narrativeRole) {
      prompt += `- **Papel narrativo:** ${mc.narrativeRole}\n`
      if (mc.narrativeRole === 'gateway') {
        prompt += `  → Este é um vídeo PORTA DE ENTRADA. Deve contextualizar o tema COMPLETAMENTE para quem nunca ouviu falar do assunto.\n`
        prompt += `  → RESOLUÇÃO PARCIAL: contextualiza mas NÃO fecha a história. Deixe pelo menos 1-2 perguntas sem resposta.\n`
      } else if (mc.narrativeRole === 'deep-dive') {
        prompt += `  → Este é um MERGULHO DIRETO. Assume que o espectador já tem noção básica do tema. NO MÁXIMO 1 frase de contextualização. Vá DIRETO para o ângulo específico.\n`
        prompt += `  → RESOLUÇÃO MÍNIMA: revela um aspecto mas NÃO fecha o caso. O detalhe deve abrir MAIS perguntas.\n`
      } else if (mc.narrativeRole === 'hook-only') {
        prompt += `  → Este é um HOOK-ONLY — arma de alcance viral. Detonação cognitiva de 22-30 segundos.\n`
        prompt += `  → RUPTURA EM 2 SEGUNDOS: O primeiro beat DEVE causar ruptura cognitiva. Nada de construção antes do choque. Se o público pensa antes de sentir, ele desliza.\n`
        prompt += `  → 1 CONCEITO CENTRAL: O outline INTEIRO gira em torno de UMA ideia resumível em 1 frase mental. Se exige conectar 3+ entidades para entender, está denso demais.\n`
        prompt += `  → ESCALAÇÃO OBRIGATÓRIA: Cada beat MAIS intenso que o anterior. Zero platô. O último beat de conteúdo é o pico absoluto.\n`
        prompt += `  → NOMES UNIVERSAIS: Nomes obscuros quebram fluxo cognitivo. Use função ("o bispo", "o juiz"), não nomes históricos (Hinderbach, Tiberino). Exceção: nomes universalmente conhecidos.\n`
        prompt += `  → RESOLUÇÃO ZERO: Pura provocação. Nenhuma explicação, recap, conclusão moral ou reflexão filosófica. TODOS os loops ficam abertos.\n`
        prompt += `  → CTA INVISÍVEL: O público NÃO pode perceber que acabou. Corte seco + "The Gap Files." + silêncio. Sem "assista", "siga", "inscreva-se".\n`
        prompt += `  → REPLAY BAIT: Pelo menos 1 beat com detalhe visual/narrativo rápido demais para absorver totalmente. Força re-assistir.\n`
        prompt += `  → Para risingBeats: o campo "questionAnswered" DEVE ser "Não respondida" — hook-only NÃO responde perguntas.\n`
      }
    }
    if (mc.shortFormatType) {
      prompt += `- **Formato do short:** ${mc.shortFormatType}\n`
      prompt += `  → Adapte a mecânica narrativa ao formato. Consulte a tabela de FORMATOS DE SHORT na skill para beats, duração e estrutura ideais.\n`
    }
    if (mc.scriptOutline) {
      prompt += `- **Estrutura sugerida:** ${mc.scriptOutline}\n`
    }
    if (mc.cta) {
      prompt += `- **CTA sugerido:** ${mc.cta}\n`
    }
    if (mc.strategicNotes) {
      prompt += `\n💡 **NOTAS ESTRATÉGICAS DO PLANO DE MONETIZAÇÃO:**\n${mc.strategicNotes}\n`
      prompt += `Use essas notas para guiar o tom, a intensidade e os pontos de ênfase do plano narrativo.\n`
    }
    if (mc.avoidPatterns && mc.avoidPatterns.length > 0) {
      prompt += `\n⛔ **O QUE NÃO FAZER (ANTI-PADRÕES OBRIGATÓRIOS):**\n`
      mc.avoidPatterns.forEach((pattern, i) => {
        prompt += `${i + 1}. ${pattern}\n`
      })
      prompt += `\n🚨 REGRA ABSOLUTA: Os anti-padrões acima são INVIOLÁVEIS e se aplicam a TODOS os campos do outline:\n`
      prompt += `- hookVariants (as 4 frases de hook)\n`
      prompt += `- promiseSetup (o anchor/contexto)\n`
      prompt += `- risingBeats (todas as revelações, questionAnswered, newQuestion)\n`
      prompt += `- climaxMoment, resolutionPoints, ctaApproach\n`
      prompt += `Se um padrão diz "NÃO mencionar datas", NENHUM campo pode conter anos, séculos ou referências temporais numéricas.\n`
      prompt += `Se um padrão diz "NÃO explicar", NENHUM beat pode conter explicações.\n`
      prompt += `⚠️ avoidPatterns têm PRIORIDADE sobre qualquer outra regra (incluindo anchor mínimo). Se conflitarem, obedeça o avoidPattern.\n`
    }

    // Instrução sobre segmentDistribution.context baseada no narrativeRole
    if (mc.narrativeRole === 'deep-dive') {
      prompt += `\n📊 **REGRA DE DISTRIBUIÇÃO – DEEP-DIVE:** A seção "context" na segmentDistribution DEVE ser 0 ou no máximo 1. Redistribua as cenas para "rising" ou "climax". O espectador JÁ CONHECE o básico.\n`
    } else if (mc.narrativeRole === 'hook-only') {
      prompt += `\n📊 **REGRA DE DISTRIBUIÇÃO – HOOK-ONLY:** context=0, resolution=0, cta=1. Todas as cenas vão para hook + rising. O último beat de rising é o pico absoluto. CTA = corte seco + branding.\n`
    }

    prompt += `\n⚠️ INSTRUÇÃO CRÍTICA: Use o hook, ângulo e papel narrativo acima como GUIA. O plano narrativo deve ser coerente com essas diretrizes. Não invente um ângulo diferente.\n`

    // Regra de foco no ângulo — evitar contaminação narrativa
    if (mc.narrativeRole === 'deep-dive' || mc.narrativeRole === 'hook-only') {
      prompt += `\n🎯 **REGRA DE FOCO NARRATIVO (CRÍTICA):**\n`
      prompt += `Este teaser tem ângulo "${mc.angle}" (${mc.angleCategory}). `
      prompt += `TODOS os beats, o clímax e a resolução devem estar 100% DENTRO deste ângulo.\n`
      prompt += `- NÃO faça "saltos temporais" para eventos de outros ângulos/teasers do dossiê.\n`
      prompt += `- NÃO traga personagens ou eventos que não pertencem a este ângulo específico.\n`
      prompt += `- O dossiê pode ter múltiplos arcos (ex: 1475 E 2019), mas este teaser cobre APENAS o ângulo "${mc.angleCategory}".\n`
      prompt += `- Se o ângulo é sobre tortura medieval, NÃO mencione crimes modernos. Se é sobre psicologia de um atirador, NÃO reconte a história de 1475.\n`
      prompt += `- Pense assim: se o espectador vê APENAS este teaser, ele deve sair entendendo profundamente UM aspecto, não uma colagem superficial de vários.\n`
    }

    // Instruções específicas para full video
    if (mc.itemType === 'fullVideo') {
      prompt += `\n🎬 **INSTRUÇÕES PARA FULL VIDEO (CRÍTICA):**\n`
      prompt += `Este é um VÍDEO COMPLETO, não um teaser. A estrutura deve seguir o framework Three-Act:\n`
      prompt += `- ATO 1 (0-20%): Cold Open + Setup + Catalyst\n`
      prompt += `- ATO 2 (20-75%): Investigation + MIDPOINT obrigatório + Complications + Dark Moment\n`
      prompt += `- ATO 3 (75-100%): Break Into Three + Revelation + Resolution + CTA\n`
      prompt += `- O MIDPOINT (~50% do vídeo) é OBRIGATÓRIO — sem ele o vídeo perde retenção.\n`
      prompt += `- Preveja RE-ENGAGEMENT HOOKS a cada ~3 minutos (36 cenas).\n`
      prompt += `- A escalação de intensidade entre beats é LEI — nenhum beat pode ter menos intensidade que o anterior.\n`
      prompt += `- O ângulo definido ("${mc.angle}") deve guiar TODOS os beats, mas o full video pode explorar mais facetas dentro desse mesmo ângulo.\n`
    }

    prompt += `\n`
  }

  if (request.sources && request.sources.length > 0) {
    prompt += `📚 FONTES DO DOSSIÊ (ordenadas por peso/relevância):\n`
    // Ordenar por peso descendente para dar prioridade ao LLM
    const sorted = [...request.sources].sort((a, b) => (b.weight ?? 1.0) - (a.weight ?? 1.0))
    sorted.forEach((source, i) => {
      const weightLabel = (source.weight ?? 1.0) !== 1.0 ? ` [peso: ${source.weight}]` : ''
      prompt += `[${i + 1}] (${source.type}) ${source.title}${weightLabel}\n${source.content}\n---\n`
    })
    prompt += '\n'
  }

  if (request.userNotes && request.userNotes.length > 0) {
    prompt += `🧠 INSIGHTS E NOTAS:\n`
    request.userNotes.forEach((note, i) => {
      prompt += `- ${note}\n`
    })
    prompt += '\n'
  }

  // Persons (Intelligence Center)
  const personsBlock = formatPersonsForPrompt(request.persons || [])
  if (personsBlock) {
    prompt += personsBlock
    prompt += `⚠️ INSTRUÇÃO SOBRE PERSONAGENS: Distribua as pessoas-chave pelos beats narrativos. Personagens "primary" devem aparecer em múltiplos beats. Use os nomes exatos para garantir consistência.\n\n`
  }

  // Neural Insights (Intelligence Center)
  const insightsBlock = formatNeuralInsightsForPrompt(request.neuralInsights || [])
  if (insightsBlock) {
    prompt += insightsBlock
    prompt += `⚠️ INSTRUÇÃO SOBRE INTELIGÊNCIA NEURAL: Use os insights como combustível narrativo. Curiosidades são ideais para hooks e pattern interrupts. Dados de pesquisa servem como âncoras factuais nos beats.\n\n`
  }

  if (request.editorialObjective) {
    prompt += `🎯 OBJETIVO EDITORIAL (GOVERNA TODA A ESTRUTURA):\n${request.editorialObjective}\n\n`
  }

  if (request.scriptStyleId) {
    prompt += `🎬 ESTILO DE ROTEIRO: ${request.scriptStyleId}\n\n`
  }

  if (request.dossierCategory) {
    prompt += `🏷️ CLASSIFICAÇÃO TEMÁTICA: ${request.dossierCategory.toUpperCase()}\n\n`
  }

  // Dados estruturados do dossiê
  if (request.researchData) {
    prompt += `📊 DADOS ESTRUTURADOS (FATOS, DATAS, CONEXÕES):\n${JSON.stringify(request.researchData, null, 2)}\n\n`
  }

  // Diretrizes do usuário — DEVEM ser respeitadas no planejamento dos beats
  let guidelines = ''
  if (request.mustInclude) guidelines += `\n✅ DEVE INCLUIR NO PLANO: ${request.mustInclude}`
  if (request.mustExclude) guidelines += `\n🚫 NÃO PODE CONTER NO PLANO: ${request.mustExclude}`
  if (guidelines) {
    prompt += `⚠️ DIRETRIZES OBRIGATÓRIAS DO USUÁRIO:${guidelines}\n\n`
    prompt += `🚨 Estas diretrizes são INVIOLÁVEIS. Os beats narrativos, o clímax e a resolução DEVEM respeitar estas regras. Não planeje beats que violem o "NÃO PODE CONTER" nem omita o que "DEVE INCLUIR".\n\n`
  }

  prompt += `⏱️ DURAÇÃO TOTAL: ${request.targetDuration} segundos (${Math.ceil(request.targetDuration / 5)} cenas de 5s cada)\n\n`

  prompt += `Crie o plano narrativo completo no formato JSON estruturado. Lembre-se: pense no CLÍMAX primeiro, depois construa o caminho até ele.`

  return prompt
}

// =============================================================================
// HELPER: Formatar outline para injeção no prompt do roteirista
// =============================================================================

/**
 * Converte o StoryOutline em texto legível para injeção no prompt do Opus.
 * Este texto é adicionado ao user prompt do generateScript.
 */
export function formatOutlineForPrompt(outline: StoryOutline & { _monetizationMeta?: any, _selectedHookLevel?: string, _customHook?: string }): string {
  const beats = outline.risingBeats
    .map((b, i) => `  ${i + 1}. ${b.revelation} → Levanta: "${b.newQuestion}"`)
    .join('\n')

  const dist = outline.segmentDistribution
  const meta = outline._monetizationMeta
  const role = meta?.narrativeRole as string | undefined

  // Resolver o hook selecionado pelo usuário (custom → _customHook, fallback: moderate → primeiro disponível)
  const selectedLevel = (outline as any)._selectedHookLevel || 'moderate'

  let hookText: string
  let hookLevel: string

  if (selectedLevel === 'custom' && (outline as any)._customHook) {
    hookText = (outline as any)._customHook
    hookLevel = 'custom'
  } else {
    const selectedVariant = outline.hookVariants?.find(v => v.level === selectedLevel)
      || outline.hookVariants?.find(v => v.level === 'moderate')
      || outline.hookVariants?.[0]
    // Fallback para outlines antigos que ainda têm hookCandidate
    hookText = selectedVariant?.hook || (outline as any).hookCandidate || ''
    hookLevel = selectedVariant?.level || 'moderate'
  }

  // Bloco de papel narrativo — aparece DENTRO do blueprint, não como nota extra
  let narrativeRoleBlock = ''
  if (role === 'deep-dive') {
    narrativeRoleBlock = `
━━ 🔍 PAPEL NARRATIVO: DEEP-DIVE (MERGULHO DIRETO) ━━
🚨 REGRA ABSOLUTA QUE SOBRESCREVE O BLUEPRINT ABAIXO:
- O espectador JÁ CONHECE o tema. NÃO recontar a história.
- A seção CONTEXT/SETUP abaixo deve ter NO MÁXIMO 1 cena com UMA frase de contexto.
- Se o blueprint abaixo indica ${dist.context} cenas de contexto, REDUZA para 1 ou 0.
- Use as cenas "sobrando" para expandir RISING ACTION ou CLÍMAX.
- Comece DIRETO pelo ângulo específico do hook.
- EXEMPLO DO QUE NÃO FAZER: "Trento, 1475. Um menino..." — isso é contextualização.
`
  } else if (role === 'hook-only') {
    narrativeRoleBlock = `
━━ 💥 PAPEL NARRATIVO: HOOK-ONLY (ARMA VIRAL) ━━
🚨 REGRAS ABSOLUTAS QUE GOVERNAM ESTE ROTEIRO:
- RUPTURA EM 2 SEGUNDOS: A primeira frase DEVE causar ruptura cognitiva. Sem construção.
- 1 CONCEITO CENTRAL: Todo o roteiro gira em torno de UMA ideia. Sem colagem de fatos.
- ESCALAÇÃO: Cada cena MAIS intensa que a anterior. Sem platô. A penúltima cena é o PICO.
- NOMES UNIVERSAIS: Use funções ("o bispo", "o juiz"), não nomes obscuros. Se o público não conhece, use a função.
- ZERO RESOLUÇÃO: Nenhuma explicação, recap, conclusão moral ou reflexão. TODOS os loops abertos.
- CTA INVISÍVEL: Última cena = "The Gap Files." + silêncio. Sem "assista", "siga", "inscreva-se".
- REPLAY BAIT: Pelo menos 1 cena com detalhe que passa rápido demais → força re-assistir.
- Ignore a seção CONTEXT/SETUP completamente.
`
  } else if (role === 'gateway') {
    narrativeRoleBlock = `
━━ 🚪 PAPEL NARRATIVO: GATEWAY (PORTA DE ENTRADA) ━━
Este é o PRIMEIRO CONTATO do espectador com o tema. 
Siga o blueprint normalmente — contextualize COMPLETAMENTE.
`
  }

  // Ajustar label de context/setup com base no role
  let contextLabel = `━━ CONTEXT/SETUP (${dist.context} cenas) ━━
${outline.promiseSetup}`
  if (role === 'deep-dive') {
    contextLabel = `━━ CONTEXT/SETUP (MÁXIMO 1 cena — DEEP-DIVE ativa) ━━
${outline.promiseSetup}
⚠️ Reduza para 1 frase breve. As cenas extras vão para RISING ACTION.`
  } else if (role === 'hook-only') {
    contextLabel = `━━ CONTEXT/SETUP (IGNORAR — HOOK-ONLY ativa) ━━
Não usar. Pular direto para RISING ACTION.`
  }

  // Emoji do nível tonal selecionado
  const levelEmoji = hookLevel === 'green' ? '🟢' : hookLevel === 'aggressive' ? '🔴' : hookLevel === 'lawless' ? '☠️' : hookLevel === 'custom' ? '✍️' : '🟡'

  return `🏗️ PLANO NARRATIVO (SIGA ESTE BLUEPRINT OBRIGATORIAMENTE):
${narrativeRoleBlock}
━━ HOOK (${dist.hook} cenas) ━━
Estratégia: ${outline.hookStrategy}
${levelEmoji} Tom selecionado: ${hookLevel.toUpperCase()}
Referência de tom: "${hookText}"

${contextLabel}

━━ RISING ACTION (${dist.rising} cenas) ━━
Beats de revelação (nesta ordem):
${beats}

━━ CLÍMAX (${dist.climax} cenas) ━━
Fórmula: ${outline.climaxFormula}
Revelação central: ${outline.climaxMoment}

━━ RESOLUTION (${dist.resolution} cenas) ━━
Pontos-chave: ${outline.resolutionPoints.join(' | ')}
Ângulo: ${outline.resolutionAngle}

━━ CTA (${dist.cta} cenas) ━━
${outline.ctaApproach}

━━ DIREÇÃO EMOCIONAL ━━
Arco: ${outline.emotionalArc}
Tom: ${outline.toneProgression}

━━ DECISÕES EDITORIAIS ━━
INCLUIR: ${outline.whatToReveal.join('; ')}
SEGURAR: ${outline.whatToHold.length > 0 ? outline.whatToHold.join('; ') : 'Nenhum'}
IGNORAR: ${outline.whatToIgnore.length > 0 ? outline.whatToIgnore.join('; ') : 'Nenhum'}
${outline.tensionCurve ? `
━━ CURVA DE TENSÃO (SIGA ESTA INTENSIDADE POR BEAT) ━━
${outline.tensionCurve.map((level, i) => `Beat ${i + 1}: ${level.toUpperCase()}`).join(' → ')}
🚨 Respeite as PAUSAS — elas criam contraste antes dos picos. Sem pausa, tudo soa igual.` : ''}
${outline.openLoops && outline.openLoops.length > 0 ? `
━━ OPEN LOOPS (THREADS NARRATIVOS) ━━
${outline.openLoops.map(loop => `• "${loop.question}" — ${loop.closedAtBeat !== null ? `Fechado no beat ${loop.closedAtBeat}` : '⚠️ NÃO FECHAR — funil para Full Video'}`).join('\n')}
🚨 Loops marcados como "NÃO FECHAR" devem ficar SEM RESPOSTA no roteiro. O espectador deve sair com essa pergunta na cabeça.` : ''}
${outline.resolutionLevel ? `
━━ NÍVEL DE RESOLUÇÃO: ${outline.resolutionLevel.toUpperCase()} ━━
${outline.resolutionLevel === 'none' ? '🚨 RESOLUÇÃO ZERO — Pura provocação. NENHUMA explicação, recap ou conclusão. Corte seco.' : ''}${outline.resolutionLevel === 'partial' ? '🚨 RESOLUÇÃO PARCIAL — Contextualiza mas NÃO fecha. Deixe perguntas sem resposta.' : ''}${outline.resolutionLevel === 'full' ? 'Resolução completa — história fechada com todas as respostas.' : ''}` : ''}

🚨 SIGA ESTE PLANO. A estrutura, ordem dos beats e distribuição de cenas já foram pensadas. Seu trabalho agora é ESCREVER cada cena seguindo este blueprint.`
}

