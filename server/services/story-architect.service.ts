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
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { loadSkill } from '../utils/skill-loader'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import type { PersonContext, NeuralInsightContext } from '../utils/format-intelligence-context'
import { formatPersonsForPrompt, formatNeuralInsightsForPrompt } from '../utils/format-intelligence-context'

// =============================================================================
// SCHEMA - Formato estruturado que a IA deve retornar
// =============================================================================

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
  hookCandidate: z.string().describe('Frase de hook candidata (15-25 palavras) como referência de tom'),

  // Setup
  promiseSetup: z.string().describe('Como o contexto será estabelecido após o hook + qual a promessa implícita'),

  // Beats narrativos
  risingBeats: z.array(RisingBeatSchema).min(3).max(8).describe('Beats de revelação progressiva em ordem'),

  // Clímax
  climaxMoment: z.string().describe('A revelação central que recontextualiza tudo'),
  climaxFormula: z.string().describe('Qual fórmula de clímax (Pattern Recognition, Document Drop, Connection Shock, Data Inflection, Problem-Solution)'),

  // Resolução
  resolutionPoints: z.array(z.string()).min(2).max(4).describe('2-3 pontos-chave do recap'),
  resolutionAngle: z.string().describe('A implicação maior — o que fica com o espectador'),

  // CTA
  ctaApproach: z.string().describe('Estratégia de fechamento: deve incluir (1) convite para o espectador seguir/inscrever-se no canal, no tom do vídeo, e (2) menção ao canal The Gap Files como assinatura. Pode combinar reflexão, provocação ou convite direto.'),

  // Direção emocional
  emotionalArc: z.string().describe('Progressão emocional do início ao fim (ex: Curiosidade → Indignação → Compreensão)'),
  toneProgression: z.string().describe('Como o tom da narração evolui (ex: Factual → Tenso → Revelador → Reflexivo)'),

  // Decisões editoriais
  whatToReveal: z.array(z.string()).min(1).describe('Fatos/dados que DEVEM aparecer no roteiro'),
  whatToHold: z.array(z.string()).describe('Informações sugeridas mas NÃO explicitadas'),
  whatToIgnore: z.array(z.string()).describe('Material do dossiê que NÃO serve para este roteiro'),

  // Distribuição de tempo
  segmentDistribution: SegmentDistributionSchema.describe('Distribuição de cenas por segmento narrativo')
})

export type StoryOutline = z.infer<typeof StoryOutlineSchema>

// =============================================================================
// TIPOS
// =============================================================================

export interface StoryArchitectRequest {
  theme: string
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

  // Monetization Context (quando gerado a partir de um item do plano de monetização)
  monetizationContext?: {
    itemType: 'teaser' | 'fullVideo'
    title: string
    hook: string
    angle: string
    angleCategory: string
    narrativeRole?: string // 'gateway' | 'deep-dive' | 'hook-only'
    scriptOutline?: string
    cta?: string
    strategicNotes?: string
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
  const structuredLlm = (model as any).withStructuredOutput(StoryOutlineSchema, {
    includeRaw: true,
    ...(isGemini ? { method: 'jsonSchema' } : {})
  })

  const systemPrompt = buildSystemPrompt(request)
  const userPrompt = buildUserPrompt(request)

  console.log(`[StoryArchitect] 📤 Enviando para ${assignment.provider} (${assignment.model})...`)
  console.log('[StoryArchitect] 🎯 Editorial Objective:', request.editorialObjective ? 'Sim' : 'Não definido')
  console.log('[StoryArchitect] 🎬 Script Style:', request.scriptStyleId || 'default')
  console.log('[StoryArchitect] ⏱️ Target Duration:', request.targetDuration, 'seconds')
  console.log('[StoryArchitect] 👤 Persons:', request.persons?.length || 0)
  console.log('[StoryArchitect] 🧠 Neural Insights:', request.neuralInsights?.length || 0)
  if (request.monetizationContext) {
    console.log(`[StoryArchitect] 💰 Monetization: ${request.monetizationContext.itemType} (${request.monetizationContext.angleCategory})`)
  }

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ]

  try {
    const startTime = Date.now()
    const result = await structuredLlm.invoke(messages)
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

    // Extrair token usage
    const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
    const inputTokens = usage?.input_tokens ?? 0
    const outputTokens = usage?.output_tokens ?? 0
    const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

    console.log(`[StoryArchitect] ✅ Plano narrativo gerado em ${elapsed}s`)
    console.log(`[StoryArchitect] 📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)
    console.log(`[StoryArchitect] 🎬 Hook: "${content.hookCandidate.substring(0, 60)}..."`)
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
  } catch (error) {
    console.error('[StoryArchitect] ❌ Erro no planejamento narrativo:', error)
    throw error
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildSystemPrompt(request: StoryArchitectRequest): string {
  // Carregar a skill do Story Architect
  const architectSkill = loadSkill('story-architect')

  return `${architectSkill}

---
PARÂMETROS TÉCNICOS:
- Duração total do vídeo: ${request.targetDuration} segundos
- Cada cena dura 5 segundos
- Total de cenas esperado: ${Math.ceil(request.targetDuration / 5)}
- A soma de todas as cenas na distribuição DEVE ser igual a ${Math.ceil(request.targetDuration / 5)}
- Idioma do roteiro: ${request.language || 'pt-BR'}`
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
      } else if (mc.narrativeRole === 'deep-dive') {
        prompt += `  → Este é um MERGULHO DIRETO. Assume que o espectador já tem noção básica do tema. NO MÁXIMO 1 frase de contextualização. Vá DIRETO para o ângulo específico.\n`
      } else if (mc.narrativeRole === 'hook-only') {
        prompt += `  → Este é um GANCHO PURO. ZERO contextualização. Comece DIRETO pela revelação ou contradição mais chocante. A falta de contexto é INTENCIONAL — força curiosidade.\n`
      }
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
    prompt += `\n⚠️ INSTRUÇÃO CRÍTICA: Use o hook, ângulo e papel narrativo acima como GUIA. O plano narrativo deve ser coerente com essas diretrizes. Não invente um ângulo diferente.\n\n`
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
export function formatOutlineForPrompt(outline: StoryOutline & { _monetizationMeta?: any }): string {
  const beats = outline.risingBeats
    .map((b, i) => `  ${i + 1}. ${b.revelation} → Levanta: "${b.newQuestion}"`)
    .join('\n')

  const dist = outline.segmentDistribution
  const meta = outline._monetizationMeta
  const role = meta?.narrativeRole as string | undefined

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
━━ 💥 PAPEL NARRATIVO: HOOK-ONLY (GANCHO PURO) ━━
🚨 REGRA ABSOLUTA QUE SOBRESCREVE O BLUEPRINT ABAIXO:
- ZERO contextualização. NENHUMA. Ignore a seção CONTEXT/SETUP completamente.
- Comece DIRETO pela revelação ou contradição mais chocante.
- NÃO explique quem, onde ou quando — vá DIRETO para o "quê" e o "por quê".
- Use TODAS as cenas para impacto máximo (HOOK + RISING + CLÍMAX + CTA).
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

  return `🏗️ PLANO NARRATIVO (SIGA ESTE BLUEPRINT OBRIGATORIAMENTE):
${narrativeRoleBlock}
━━ HOOK (${dist.hook} cenas) ━━
Estratégia: ${outline.hookStrategy}
Referência de tom: "${outline.hookCandidate}"

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

🚨 SIGA ESTE PLANO. A estrutura, ordem dos beats e distribuição de cenas já foram pensadas. Seu trabalho agora é ESCREVER cada cena seguindo este blueprint.`
}
