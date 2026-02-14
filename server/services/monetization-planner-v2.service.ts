/**
 * Monetization Planner V2 — Pipeline por Etapas
 *
 * Em vez de gerar todos os 15 teasers + Full Video de uma vez (e depender de
 * validação LLM inconsistente), este serviço gera o plano em etapas:
 *
 * Etapa 1: Blueprint Estratégico (distribuição, ângulos, formatos)
 *          → Validação PROGRAMÁTICA (instantânea, determinística)
 * Etapa 2: Full Video
 * Etapa 3: Gateway (1 teaser)
 * Etapa 4: Deep-Dives (N teasers em batch)
 * Etapa 5: Hook-Only (N teasers em batch)
 * Etapa 6: Publication Schedule
 *
 * Vantagens:
 * - Cada LLM call é focada (menos regras para respeitar)
 * - Anti-redundância natural (cada etapa sabe o que veio antes)
 * - Validação programática no blueprint (sem LLM validando LLM)
 * - Retry cirúrgico (regenera só a etapa que falhou)
 */

import { z } from 'zod'
import { loadSkill } from '../utils/skill-loader'
import { serializeConstantsCatalog, serializeRoleDistribution } from '../utils/constants-catalog'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import type { CreativeDirection } from './creative-direction-advisor.service'
import { buildDossierBlock } from '../utils/dossier-prompt-block'
import { buildCacheableMessages, logCacheMetrics } from './llm/anthropic-cache-helper'
import { calculateRoleDistribution } from '../constants/narrative-roles'
import { invokeWithLogging } from '../utils/llm-invoke-wrapper'
import { handleGroqJsonValidateError } from '../utils/groq-error-handler'

const LOG = '[MonetizationV2]'

// =============================================================================
// SCHEMAS
// =============================================================================

// ── Etapa 1: Blueprint ────────────────────────────────────────────────────────
const BlueprintTeaserSlotSchema = z.object({
  angleCategory: z.string().describe('Categoria do ângulo narrativo (do catálogo)'),
  angleName: z.string().describe('Nome descritivo do ângulo aplicado ao dossiê'),
  narrativeRole: z.enum(['gateway', 'deep-dive', 'hook-only']).describe('Papel narrativo'),
  shortFormatType: z.enum([
    'hook-brutal', 'pergunta-incomoda', 'plot-twist',
    'teaser-cinematografico', 'mini-documento', 'lista-rapida', 'frase-memoravel'
  ]).describe('Formato do short'),
  platform: z.enum(['TikTok', 'YouTube Shorts', 'Instagram Reels']).describe('Plataforma alvo'),
  scriptStyleId: z.string().describe('ID do estilo de roteiro'),
  scriptStyleName: z.string().describe('Nome do estilo de roteiro'),
  editorialObjectiveId: z.string().describe('ID do objetivo editorial'),
  editorialObjectiveName: z.string().describe('Nome do objetivo editorial')
})

const BlueprintFullVideoSlotSchema = z.object({
  angle: z.string().describe('Ângulo narrativo principal do Full Video'),
  scriptStyleId: z.string().describe('ID do estilo de roteiro'),
  scriptStyleName: z.string().describe('Nome do estilo de roteiro'),
  editorialObjectiveId: z.string().describe('ID do objetivo editorial'),
  editorialObjectiveName: z.string().describe('Nome do objetivo editorial')
})

function createBlueprintSchema(teaserCount: number) {
  const min = Math.max(4, teaserCount - 1)
  const max = Math.min(15, teaserCount + 1)
  return z.object({
    planTitle: z.string().describe('Título criativo do plano de monetização'),
    visualStyleId: z.string().describe('ID do estilo visual ÚNICO para todo o plano'),
    visualStyleName: z.string().describe('Nome do estilo visual'),
    fullVideo: BlueprintFullVideoSlotSchema.describe('Slot do Full Video'),
    teaserSlots: z.array(BlueprintTeaserSlotSchema).min(min).max(max).describe(`${teaserCount} slots de teasers com ângulos, roles e formatos`),
    estimatedTotalRevenue: z.string().describe('Estimativa de receita total'),
    strategicNotes: z.string().describe('Notas estratégicas')
  })
}

// ── Etapa 2: Full Video ────────────────────────────────────────────────────────
const FullVideoSchema = z.object({
  title: z.string().describe('Título otimizado para YouTube (máx. 80 chars)'),
  hook: z.string().describe('Frase de abertura (15-25 palavras)'),
  angle: z.string().describe('Ângulo narrativo principal'),
  structure: z.string().describe('Resumo da estrutura narrativa'),
  keyPoints: z.array(z.string()).min(3).max(5).describe('Pontos-chave do roteiro'),
  emotionalArc: z.string().describe('Progressão emocional'),
  estimatedViews: z.number().describe('Estimativa de views'),
  platform: z.enum(['YouTube']).describe('YouTube'),
  format: z.enum(['full-youtube']).describe('full-youtube'),
  scriptStyleId: z.string(),
  scriptStyleName: z.string(),
  editorialObjectiveId: z.string(),
  editorialObjectiveName: z.string(),
  visualPrompt: z.string().describe('Prompt de imagem em inglês')
})

// ── Etapa 3-5: Teasers (por categoria) ──────────────────────────────────────
const TeaserSchema = z.object({
  title: z.string().describe('Título curto e impactante'),
  hook: z.string().describe('Frase de abertura (até 15 palavras)'),
  angle: z.string().describe('Ângulo narrativo'),
  angleCategory: z.string().describe('Categoria do ângulo'),
  narrativeRole: z.enum(['gateway', 'deep-dive', 'hook-only']),
  shortFormatType: z.enum([
    'hook-brutal', 'pergunta-incomoda', 'plot-twist',
    'teaser-cinematografico', 'mini-documento', 'lista-rapida', 'frase-memoravel'
  ]),
  scriptOutline: z.string().describe('Estrutura resumida do script'),
  visualSuggestion: z.string().describe('Descrição curta do visual'),
  cta: z.string().describe('Call-to-action para o Full Video'),
  platform: z.enum(['TikTok', 'YouTube Shorts', 'Instagram Reels']),
  format: z.enum(['teaser-tiktok', 'teaser-reels']),
  estimatedViews: z.number(),
  scriptStyleId: z.string(),
  scriptStyleName: z.string(),
  editorialObjectiveId: z.string(),
  editorialObjectiveName: z.string(),
  avoidPatterns: z.array(z.string()).min(1).max(4),
  visualPrompt: z.string().describe('Prompt de imagem em inglês')
})

// ── Etapa 6: Schedule ──────────────────────────────────────────────────────────
const ScheduleItemSchema = z.object({
  dayOfWeek: z.string(),
  content: z.string(),
  platform: z.string(),
  notes: z.string().optional()
})

// =============================================================================
// TIPOS
// =============================================================================

export interface MonetizationPlannerV2Request {
  theme: string
  title: string
  visualIdentityContext?: string
  sources?: Array<{ title: string; content: string; sourceType: string; weight?: number }>
  notes?: Array<{ content: string; noteType: string }>
  images?: Array<{ description: string }>
  persons?: Array<{ name: string; role: string; description: string; visualDescription?: string; relevance?: string }>
  researchData?: any
  teaserDuration: 35 | 55 | 115
  fullVideoDuration: 300 | 600 | 900
  teaserCount?: number
  creativeDirection?: CreativeDirection
}

export interface MonetizationPlannerV2Result {
  plan: {
    planTitle: string
    visualStyleId: string
    visualStyleName: string
    fullVideo: z.infer<typeof FullVideoSchema>
    teasers: z.infer<typeof TeaserSchema>[]
    publicationSchedule: z.infer<typeof ScheduleItemSchema>[]
    estimatedTotalRevenue: string
    strategicNotes: string
  }
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
  stageTimings: Record<string, number>
}

// =============================================================================
// VALIDAÇÃO PROGRAMÁTICA DO BLUEPRINT
// =============================================================================

// Tabela de compatibilidade role × format
const ROLE_FORMAT_ALLOWED: Record<string, string[]> = {
  'gateway': ['plot-twist', 'teaser-cinematografico', 'lista-rapida', 'pergunta-incomoda'],
  'deep-dive': ['plot-twist', 'mini-documento', 'pergunta-incomoda', 'teaser-cinematografico', 'hook-brutal', 'lista-rapida'],
  'hook-only': ['hook-brutal', 'frase-memoravel', 'pergunta-incomoda', 'plot-twist', 'teaser-cinematografico']
}

interface BlueprintValidation {
  valid: boolean
  violations: string[]
  autoFixed: boolean
}

function validateBlueprint(blueprint: any, expectedTeaserCount: number): BlueprintValidation {
  const violations: string[] = []
  const slots = blueprint.teaserSlots || []

  // 1. Contagem de roles
  const gateways = slots.filter((s: any) => s.narrativeRole === 'gateway')
  const deepDives = slots.filter((s: any) => s.narrativeRole === 'deep-dive')
  const hookOnlys = slots.filter((s: any) => s.narrativeRole === 'hook-only')

  if (gateways.length !== 1) {
    violations.push(`Gateway: esperado 1, encontrado ${gateways.length}`)
  }

  // Distribuição (tolerante)
  const remaining = slots.length - 1 // excluindo gateway
  if (remaining > 0) {
    const ddPercent = deepDives.length / remaining
    const hoPercent = hookOnlys.length / remaining
    if (ddPercent > 0.65) violations.push(`Deep-dive: ${(ddPercent * 100).toFixed(0)}% excede 65% do restante`)
    if (hoPercent > 0.50) violations.push(`Hook-only: ${(hoPercent * 100).toFixed(0)}% excede 50% do restante`)
    if (hookOnlys.length === 0) violations.push('Zero hook-only: necessário pelo menos 1 para alcance viral')
  }

  // 2. Ângulos duplicados
  const angles = slots.map((s: any) => s.angleCategory)
  const uniqueAngles = new Set(angles)
  if (uniqueAngles.size < angles.length) {
    const dupes = angles.filter((a: string, i: number) => angles.indexOf(a) !== i)
    violations.push(`Ângulos duplicados: ${[...new Set(dupes)].join(', ')}`)
  }

  // 3. Compatibilidade role × format
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const allowed = ROLE_FORMAT_ALLOWED[slot.narrativeRole]
    if (allowed && !allowed.includes(slot.shortFormatType)) {
      violations.push(`Teaser ${i + 1}: role "${slot.narrativeRole}" incompatível com format "${slot.shortFormatType}"`)
    }
  }

  // 4. Diversidade de formatos
  const formats = slots.map((s: any) => s.shortFormatType)
  const formatCounts: Record<string, number> = {}
  formats.forEach((f: string) => { formatCounts[f] = (formatCounts[f] || 0) + 1 })
  const maxFormatCount = Math.max(...Object.values(formatCounts))
  if (maxFormatCount > Math.ceil(slots.length * 0.5)) {
    const dominant = Object.entries(formatCounts).find(([_, c]) => c === maxFormatCount)
    violations.push(`Format "${dominant?.[0]}" usado ${maxFormatCount}x (>${Math.ceil(slots.length * 0.5)} = 50%)`)
  }
  const uniqueFormats = new Set(formats)
  if (uniqueFormats.size < 3 && slots.length >= 4) {
    violations.push(`Apenas ${uniqueFormats.size} formatos únicos (mínimo: 3)`)
  }

  // 5. Gateway deve ser o primeiro
  if (slots.length > 0 && slots[0].narrativeRole !== 'gateway') {
    // Auto-fix: reordenar
    const gwIdx = slots.findIndex((s: any) => s.narrativeRole === 'gateway')
    if (gwIdx > 0) {
      const gw = slots.splice(gwIdx, 1)[0]
      slots.unshift(gw)
      blueprint.teaserSlots = slots
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    autoFixed: false
  }
}

// Auto-fix: corrige violações simples sem precisar de LLM
function autoFixBlueprint(blueprint: any): { fixed: boolean; changes: string[] } {
  const changes: string[] = []
  const slots = blueprint.teaserSlots || []

  // Fix role × format incompatibilities
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const allowed = ROLE_FORMAT_ALLOWED[slot.narrativeRole]
    if (allowed && !allowed.includes(slot.shortFormatType)) {
      const oldFormat = slot.shortFormatType
      // Escolher o primeiro formato compatível que não esteja muito usado
      const formatCounts: Record<string, number> = {}
      slots.forEach((s: any) => { formatCounts[s.shortFormatType] = (formatCounts[s.shortFormatType] || 0) + 1 })
      const bestFormat = allowed.find(f => (formatCounts[f] || 0) < Math.ceil(slots.length * 0.3)) || allowed[0]
      slot.shortFormatType = bestFormat
      changes.push(`Teaser ${i + 1}: format "${oldFormat}" → "${bestFormat}" (incompatível com role "${slot.narrativeRole}")`)
    }
  }

  // Fix: duplicated angles (append index suffix)
  const seenAngles = new Set<string>()
  for (let i = 0; i < slots.length; i++) {
    if (seenAngles.has(slots[i].angleCategory)) {
      // Não podemos facilmente corrigir ângulos duplicados sem LLM
      // Deixar como violação para retry
    }
    seenAngles.add(slots[i].angleCategory)
  }

  return { fixed: changes.length > 0, changes }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createStructuredOutput(model: any, schema: any, provider: string) {
  const isGemini = provider.toLowerCase().includes('gemini') || provider.toLowerCase().includes('google')
  const isReplicate = provider.toLowerCase().includes('replicate')
  const isGroq = provider.toLowerCase().includes('groq')
  if (isReplicate && typeof (model as any).withStructuredOutputReplicate === 'function') {
    return (model as any).withStructuredOutputReplicate(schema, { includeRaw: true })
  }
  let method: string | undefined
  if (isGemini) method = 'jsonSchema'
  else if (isGroq) {
    const modelName = (model as any).model || (model as any).modelName || ''
    if (modelName.includes('llama-4')) method = 'jsonMode'
  }
  return (model as any).withStructuredOutput(schema, {
    includeRaw: true,
    ...(method ? { method } : {})
  })
}

async function invokeStage(
  stageName: string,
  schema: any,
  systemPrompt: string,
  userPrompt: string,
  dossierBlock: string,
  assignment: { provider: string; model: string }
): Promise<{ parsed: any; usage: { inputTokens: number; outputTokens: number; totalTokens: number }; elapsed: number }> {
  const model = await createLlmForTask('monetization', { maxTokens: 16384 })
  const structuredLlm = createStructuredOutput(model, schema, assignment.provider)

  const isAnthropicProvider = assignment.provider.toLowerCase().includes('anthropic')
  const cacheResult = buildCacheableMessages({
    dossierBlock,
    systemPrompt,
    taskPrompt: userPrompt,
    providerName: isAnthropicProvider ? 'ANTHROPIC' : assignment.provider
  })

  const startTime = Date.now()
  let result: { parsed: any; raw: any } | null = null
  let groqFallbackData: any = null

  try {
    result = await invokeWithLogging(structuredLlm, cacheResult.messages, {
      taskId: `monetization-${stageName}`,
      provider: assignment.provider,
      model: assignment.model
    })
  } catch (error: any) {
    // Tratar erro Groq json_validate_failed — extrair dados do failed_generation
    const groqResult = handleGroqJsonValidateError(
      error, `${LOG} [${stageName}]`, `monetization-${stageName}`
    )
    if (groqResult.success) {
      console.warn(`${LOG} ⚠️ ${stageName}: Groq json_validate_failed — usando failed_generation`)
      groqFallbackData = groqResult.data
    } else {
      throw error
    }
  }

  const elapsed = (Date.now() - startTime) / 1000

  const usage = result?.raw?.usage_metadata || result?.raw?.response_metadata?.usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0

  // Resolver parsed: resultado direto > fallback Groq > fallback raw
  let parsed = result?.parsed ?? groqFallbackData
  if (!parsed) {
    console.warn(`${LOG} ⚠️ ${stageName}: parsed é null, tentando fallback do raw...`)
    parsed = fallbackParseFromRaw(result?.raw, `${LOG} [${stageName}]`)
    if (!parsed) {
      throw new Error(`${stageName}: LLM retornou resposta não-parseável (parsed=null, fallback falhou)`)
    }
  }

  console.log(`${LOG} ✅ ${stageName} concluído em ${elapsed.toFixed(2)}s (${inputTokens}+${outputTokens} tokens)`)

  return {
    parsed,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
    elapsed
  }
}

/**
 * Fallback parser: extrai JSON da resposta raw quando parsed é null (Zod v4 compat)
 */
function fallbackParseFromRaw(rawMessage: any, logPrefix: string): any | null {
  // Tentativa 1: tool_calls (Anthropic/OpenAI function calling)
  const toolCalls = rawMessage?.tool_calls || rawMessage?.lc_kwargs?.tool_calls
  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    const firstTool = toolCalls[0]
    if (firstTool?.args) {
      console.log(`${logPrefix} ✅ Fallback via tool_calls[0].args`)
      return firstTool.args
    }
    if (firstTool?.input) {
      console.log(`${logPrefix} ✅ Fallback via tool_calls[0].input`)
      return firstTool.input
    }
  }

  // Tentativa 2: content text
  const candidates = rawMessage?.lc_kwargs?.content || rawMessage?.content
  try {
    if (typeof candidates === 'string') {
      const cleaned = candidates.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      console.log(`${logPrefix} ✅ Fallback via content string`)
      return parsed
    }
    if (Array.isArray(candidates)) {
      for (const part of candidates) {
        if (part?.type === 'text' && part?.text) {
          const cleaned = part.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const parsed = JSON.parse(cleaned)
          console.log(`${logPrefix} ✅ Fallback via array content`)
          return parsed
        }
      }
    }
  } catch (e: any) {
    console.warn(`${logPrefix} ⚠️ Fallback falhou: ${e.message}`)
  }
  return null
}

// =============================================================================
// MAIN PIPELINE
// =============================================================================

export async function generateMonetizationPlanV2(
  request: MonetizationPlannerV2Request
): Promise<MonetizationPlannerV2Result> {
  const teaserCount = Math.min(15, Math.max(4, request.teaserCount ?? 6))
  const stageTimings: Record<string, number> = {}
  const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  console.log(`${LOG} 🚀 Pipeline por etapas iniciado (${teaserCount} teasers)`)

  const assignment = await getAssignment('monetization')
  console.log(`${LOG} Usando ${assignment.provider} (${assignment.model})`)

  // ── Dossiê block (reutilizado em todas as etapas) ──────────────
  const dossierBlock = buildDossierBlock({
    theme: request.theme,
    title: request.title,
    visualIdentityContext: request.visualIdentityContext,
    sources: request.sources?.map(s => ({
      title: s.title, content: s.content, type: s.sourceType,
      weight: s.weight ?? 1.0
    })),
    userNotes: request.notes?.map(n => n.content),
    imageDescriptions: request.images?.map(i => i.description).filter(Boolean),
    persons: request.persons?.map(p => ({
      name: p.name, role: p.role, description: p.description,
      visualDescription: p.visualDescription, relevance: p.relevance || ''
    }))
  })

  // Creative direction block (se houver)
  let creativeDirectionBlock = ''
  if (request.creativeDirection) {
    const cd = request.creativeDirection
    creativeDirectionBlock = `\n## 🎨 DIREÇÃO CRIATIVA PRÉ-APROVADA\n\n` +
      `**Full Video:** roteiro=\`${cd.fullVideo.scriptStyle.id}\`, visual=\`${cd.fullVideo.visualStyle.id}\`, editorial=\`${cd.fullVideo.editorialObjective.id}\`\n` +
      `**Teasers:**\n${cd.teaserRecommendations.map((t, i) => `${i + 1}. Ângulo "${t.suggestedAngle}": roteiro=\`${t.scriptStyle.id}\`, editorial=\`${t.editorialObjective.id}\``).join('\n')}\n`
  }

  // Configuração de duração
  const teaserLabel = request.teaserDuration === 35 ? 'ultra-curtos (35s)' : request.teaserDuration === 55 ? 'curtos (55s)' : 'médios (115s)'
  const fullLabel = `${request.fullVideoDuration / 60} minutos`
  const configBlock = `\n## ⚙️ CONFIGURAÇÃO\n- Teasers: ${teaserCount}x ${teaserLabel}\n- Full Video: ${fullLabel}\n`

  // =====================================================================
  // ETAPA 1: BLUEPRINT ESTRATÉGICO
  // =====================================================================
  console.log(`${LOG} ── ETAPA 1/6: Blueprint Estratégico ──`)

  const blueprintSkill = loadSkill('monetization/blueprint')
  const catalogBlock = serializeConstantsCatalog()
  const roleDistBlock = serializeRoleDistribution(teaserCount)

  let blueprint: any
  let violations: string[] = []
  const MAX_BLUEPRINT_RETRIES = 5

  for (let attempt = 0; attempt <= MAX_BLUEPRINT_RETRIES; attempt++) {
    const blueprintSystemPrompt = `${blueprintSkill}${creativeDirectionBlock}${configBlock}\n\n${catalogBlock}\n\n${roleDistBlock}`
    const blueprintUserPrompt = attempt === 0
      ? `Crie o blueprint estratégico para o dossiê acima. Gere ${teaserCount} slots de teasers com ângulos, roles e formatos.`
      : `CORREÇÃO OBRIGATÓRIA:\n${violations.join('\n')}\n\nRegere o blueprint corrigindo as violações acima.`

    const BlueprintSchema = createBlueprintSchema(teaserCount)
    const result = await invokeStage('blueprint', BlueprintSchema, blueprintSystemPrompt, blueprintUserPrompt, dossierBlock, assignment)
    stageTimings['blueprint'] = result.elapsed
    totalUsage.inputTokens += result.usage.inputTokens
    totalUsage.outputTokens += result.usage.outputTokens
    totalUsage.totalTokens += result.usage.totalTokens

    blueprint = result.parsed

    // Auto-fix first
    const fixResult = autoFixBlueprint(blueprint)
    if (fixResult.fixed) {
      console.log(`${LOG} 🔧 Auto-fix aplicado: ${fixResult.changes.join('; ')}`)
    }

    // Validate
    const validation = validateBlueprint(blueprint, teaserCount)
    if (validation.valid) {
      console.log(`${LOG} ✅ Blueprint APROVADO${attempt > 0 ? ` (após ${attempt} retries)` : ''}`)
      break
    }

    violations = validation.violations
    console.warn(`${LOG} ❌ Blueprint REPROVADO (tentativa ${attempt + 1}/${MAX_BLUEPRINT_RETRIES + 1}): ${violations.join('; ')}`)

    if (attempt >= MAX_BLUEPRINT_RETRIES) {
      throw new Error(`Blueprint reprovado após ${MAX_BLUEPRINT_RETRIES + 1} tentativas: ${violations.join('; ')}`)
    }
  }

  const slots = blueprint.teaserSlots
  const gatewaySlots = slots.filter((s: any) => s.narrativeRole === 'gateway')
  const deepDiveSlots = slots.filter((s: any) => s.narrativeRole === 'deep-dive')
  const hookOnlySlots = slots.filter((s: any) => s.narrativeRole === 'hook-only')

  console.log(`${LOG} 📊 Blueprint: G=${gatewaySlots.length} DD=${deepDiveSlots.length} HO=${hookOnlySlots.length} | ${new Set(slots.map((s: any) => s.angleCategory)).size} ângulos únicos`)

  // =====================================================================
  // ETAPA 2: FULL VIDEO
  // =====================================================================
  console.log(`${LOG} ── ETAPA 2/6: Full Video ──`)

  const fullVideoSkill = loadSkill('monetization/full-video')
  const teaserAnglesBlock = `\n## ÂNGULOS DOS TEASERS (para NÃO sobrepor)\n${slots.map((s: any, i: number) => `${i + 1}. ${s.angleCategory}: ${s.angleName}`).join('\n')}\n`

  const fullVideoResult = await invokeStage(
    'full-video', FullVideoSchema,
    `${fullVideoSkill}${creativeDirectionBlock}${configBlock}${teaserAnglesBlock}\n\nEstilo visual do plano: ${blueprint.visualStyleId} (${blueprint.visualStyleName})`,
    `Gere a sugestão completa do Full Video.\n\nÂngulo principal definido no blueprint: "${blueprint.fullVideo.angle}"\nscriptStyleId: "${blueprint.fullVideo.scriptStyleId}"\neditorialObjectiveId: "${blueprint.fullVideo.editorialObjectiveId}"`,
    dossierBlock, assignment
  )
  stageTimings['full-video'] = fullVideoResult.elapsed
  totalUsage.inputTokens += fullVideoResult.usage.inputTokens
  totalUsage.outputTokens += fullVideoResult.usage.outputTokens
  totalUsage.totalTokens += fullVideoResult.usage.totalTokens

  const fullVideo = fullVideoResult.parsed

  // =====================================================================
  // ETAPA 3: GATEWAY (1 teaser)
  // =====================================================================
  console.log(`${LOG} ── ETAPA 3/6: Gateway ──`)

  const gatewaySkill = loadSkill('monetization/gateway')
  const gwSlot = gatewaySlots[0]

  const gatewayResult = await invokeStage(
    'gateway',
    z.object({ teasers: z.array(TeaserSchema).length(1) }),
    `${gatewaySkill}${configBlock}\n\nEstilo visual do plano: ${blueprint.visualStyleId} (${blueprint.visualStyleName})\n\nHook do Full Video (NÃO repetir): "${fullVideo.hook}"`,
    `Gere o teaser GATEWAY para o dossiê.\n\nSlot definido no blueprint:\n- angleCategory: "${gwSlot.angleCategory}"\n- angleName: "${gwSlot.angleName}"\n- shortFormatType: "${gwSlot.shortFormatType}"\n- platform: "${gwSlot.platform}"\n- scriptStyleId: "${gwSlot.scriptStyleId}"\n- editorialObjectiveId: "${gwSlot.editorialObjectiveId}"\n\nRetorne um JSON com campo "teasers" contendo exatamente 1 teaser.`,
    dossierBlock, assignment
  )
  stageTimings['gateway'] = gatewayResult.elapsed
  totalUsage.inputTokens += gatewayResult.usage.inputTokens
  totalUsage.outputTokens += gatewayResult.usage.outputTokens
  totalUsage.totalTokens += gatewayResult.usage.totalTokens

  const gatewayTeaser = gatewayResult.parsed.teasers[0]
  const allTeasers = [gatewayTeaser]
  const usedHooks = [fullVideo.hook, gatewayTeaser.hook]

  // =====================================================================
  // ETAPA 4: DEEP-DIVES (N teasers)
  // =====================================================================
  console.log(`${LOG} ── ETAPA 4/6: Deep-Dives (${deepDiveSlots.length}) ──`)

  if (deepDiveSlots.length > 0) {
    const deepDiveSkill = loadSkill('monetization/deep-dive')
    const slotsBlock = deepDiveSlots.map((s: any, i: number) =>
      `${i + 1}. angleCategory="${s.angleCategory}", angleName="${s.angleName}", shortFormatType="${s.shortFormatType}", platform="${s.platform}", scriptStyleId="${s.scriptStyleId}", editorialObjectiveId="${s.editorialObjectiveId}"`
    ).join('\n')

    const deepDiveResult = await invokeStage(
      'deep-dives',
      z.object({ teasers: z.array(TeaserSchema).min(deepDiveSlots.length).max(deepDiveSlots.length + 1) }),
      `${deepDiveSkill}${configBlock}\n\nEstilo visual: ${blueprint.visualStyleId} (${blueprint.visualStyleName})\n\n## HOOKS JÁ USADOS (NÃO REPETIR)\n${usedHooks.map((h, i) => `${i + 1}. "${h}"`).join('\n')}\n\n## GATEWAY JÁ GERADO (NÃO repetir informações)\nHook: "${gatewayTeaser.hook}"\nÂngulo: ${gatewayTeaser.angleCategory}\nOutline: ${gatewayTeaser.scriptOutline}`,
      `Gere ${deepDiveSlots.length} teasers DEEP-DIVE para o dossiê.\n\nSlots definidos no blueprint:\n${slotsBlock}\n\nRetorne um JSON com campo "teasers" contendo exatamente ${deepDiveSlots.length} teasers.`,
      dossierBlock, assignment
    )
    stageTimings['deep-dives'] = deepDiveResult.elapsed
    totalUsage.inputTokens += deepDiveResult.usage.inputTokens
    totalUsage.outputTokens += deepDiveResult.usage.outputTokens
    totalUsage.totalTokens += deepDiveResult.usage.totalTokens

    const ddTeasers = deepDiveResult.parsed.teasers || []
    allTeasers.push(...ddTeasers)
    usedHooks.push(...ddTeasers.map((t: any) => t.hook))
  }

  // =====================================================================
  // ETAPA 5: HOOK-ONLY (N teasers)
  // =====================================================================
  console.log(`${LOG} ── ETAPA 5/6: Hook-Only (${hookOnlySlots.length}) ──`)

  if (hookOnlySlots.length > 0) {
    const hookOnlySkill = loadSkill('monetization/hook-only')
    const slotsBlock = hookOnlySlots.map((s: any, i: number) =>
      `${i + 1}. angleCategory="${s.angleCategory}", angleName="${s.angleName}", shortFormatType="${s.shortFormatType}", platform="${s.platform}", scriptStyleId="${s.scriptStyleId}", editorialObjectiveId="${s.editorialObjectiveId}"`
    ).join('\n')

    const hookOnlyResult = await invokeStage(
      'hook-only',
      z.object({ teasers: z.array(TeaserSchema).min(hookOnlySlots.length).max(hookOnlySlots.length + 1) }),
      `${hookOnlySkill}${configBlock}\n\nEstilo visual: ${blueprint.visualStyleId} (${blueprint.visualStyleName})\n\n## HOOKS JÁ USADOS (NÃO REPETIR)\n${usedHooks.map((h, i) => `${i + 1}. "${h}"`).join('\n')}\n\n## TEASERS JÁ GERADOS (NÃO repetir territórios)\n${allTeasers.map((t, i) => `${i + 1}. [${t.narrativeRole}] ${t.angleCategory}: "${t.hook}"`).join('\n')}`,
      `Gere ${hookOnlySlots.length} teasers HOOK-ONLY para o dossiê.\n\nSlots definidos no blueprint:\n${slotsBlock}\n\nRetorne um JSON com campo "teasers" contendo exatamente ${hookOnlySlots.length} teasers.`,
      dossierBlock, assignment
    )
    stageTimings['hook-only'] = hookOnlyResult.elapsed
    totalUsage.inputTokens += hookOnlyResult.usage.inputTokens
    totalUsage.outputTokens += hookOnlyResult.usage.outputTokens
    totalUsage.totalTokens += hookOnlyResult.usage.totalTokens

    const hoTeasers = hookOnlyResult.parsed.teasers || []
    allTeasers.push(...hoTeasers)
  }

  // =====================================================================
  // ETAPA 6: PUBLICATION SCHEDULE
  // =====================================================================
  console.log(`${LOG} ── ETAPA 6/6: Publication Schedule ──`)

  const scheduleSkill = loadSkill('monetization/schedule')
  const itemsSummary = [
    `Full Video: "${fullVideo.title}" (YouTube)`,
    ...allTeasers.map((t: any, i: number) => `Teaser ${i + 1} [${t.narrativeRole}]: "${t.title}" (${t.platform})`)
  ].join('\n')

  const scheduleResult = await invokeStage(
    'schedule',
    z.object({ schedule: z.array(ScheduleItemSchema).min(4).max(20) }),
    `${scheduleSkill}`,
    `Crie o cronograma de publicação para:\n\n${itemsSummary}\n\nRetorne um JSON com campo "schedule" contendo o cronograma.`,
    '', // Schedule não precisa do dossiê completo
    assignment
  )
  stageTimings['schedule'] = scheduleResult.elapsed
  totalUsage.inputTokens += scheduleResult.usage.inputTokens
  totalUsage.outputTokens += scheduleResult.usage.outputTokens
  totalUsage.totalTokens += scheduleResult.usage.totalTokens

  const schedule = scheduleResult.parsed.schedule || []

  // =====================================================================
  // RESULTADO FINAL
  // =====================================================================
  const totalTime = Object.values(stageTimings).reduce((a, b) => a + b, 0)
  console.log(`${LOG} 🏁 Pipeline completo em ${totalTime.toFixed(2)}s (${allTeasers.length} teasers)`)
  console.log(`${LOG} ⏱️ Timings: ${Object.entries(stageTimings).map(([k, v]) => `${k}=${v.toFixed(1)}s`).join(' | ')}`)
  console.log(`${LOG} 📊 Tokens totais: ${totalUsage.inputTokens} in + ${totalUsage.outputTokens} out = ${totalUsage.totalTokens}`)

  return {
    plan: {
      planTitle: blueprint.planTitle,
      visualStyleId: blueprint.visualStyleId,
      visualStyleName: blueprint.visualStyleName,
      fullVideo,
      teasers: allTeasers,
      publicationSchedule: schedule,
      estimatedTotalRevenue: blueprint.estimatedTotalRevenue,
      strategicNotes: blueprint.strategicNotes
    },
    usage: totalUsage,
    provider: assignment.provider.toUpperCase(),
    model: assignment.model,
    stageTimings
  }
}
