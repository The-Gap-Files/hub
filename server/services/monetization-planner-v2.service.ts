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
import { BriefBundleV1Schema, formatBriefBundleV1AsDossierBlock, TeaserMicroBriefV1Schema } from '../types/briefing.types'
import { sanitizeSchemaForGemini } from '../utils/gemini-schema-sanitizer'
import { toJsonSchema } from '@langchain/core/utils/json_schema'

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
  platform: z.string().describe('Plataforma alvo obrigatória: sempre "YouTube Shorts"'),
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
    fullVideos: z.array(BlueprintFullVideoSlotSchema).length(3).describe('3 slots de Full Video (EP1, EP2, EP3)'),
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
  platform: z.string().describe('Plataforma obrigatória: sempre "YouTube"'),
  format: z.string().describe('Formato obrigatório: sempre "full-youtube"'),
  scriptStyleId: z.string(),
  scriptStyleName: z.string(),
  editorialObjectiveId: z.string(),
  editorialObjectiveName: z.string(),
  visualPrompt: z.string().describe('Prompt de imagem em inglês'),
  sceneCount: z.number().int().nullable().optional().describe('Quantidade alvo de cenas para o vídeo longo (definida pelo sistema)')
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
  microBriefV1: TeaserMicroBriefV1Schema.describe('Micro-brief isolado por teaser (fatos e safety específicos)'),
  scriptOutline: z.string().describe('Estrutura resumida do script'),
  visualSuggestion: z.string().describe('Descrição curta do visual'),
  cta: z.string().nullable().optional().describe('Call-to-action para o Full Video (hook-only: null/empty)'),
  platform: z.string().describe('Plataforma obrigatória: sempre "YouTube Shorts"'),
  format: z.string().describe('Formato obrigatório: sempre "teaser-youtube-shorts"'),
  estimatedViews: z.number(),
  scriptStyleId: z.string(),
  scriptStyleName: z.string(),
  editorialObjectiveId: z.string(),
  editorialObjectiveName: z.string(),
  avoidPatterns: z.array(z.string()).min(1).max(4),
  visualPrompt: z.string().describe('Prompt de imagem em inglês'),
  sceneCount: z.number().int().nullable().optional().describe('Quantidade alvo de cenas do teaser (definida pelo sistema)'),
  targetEpisode: z.number().int().describe('Episódio alvo deste teaser: 1, 2 ou 3. Gateway=sempre 1. Deep-dive/Hook-only=alinhado ao ângulo do episódio.')
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
  /** Brief persistido do Dossier para reduzir contexto em TEASERS */
  briefBundleV1?: any
  teaserDuration: 35 | 55 | 115
  fullVideoDuration: 300 | 600 | 900
  teaserCount?: number
  sceneConfig?: {
    hookOnly: number
    deepDive: number
    gateway: number
    fullVideo: number
  }
  creativeDirection?: CreativeDirection
}

export interface MonetizationPlannerV2Result {
  plan: {
    planTitle: string
    visualStyleId: string
    visualStyleName: string
    fullVideos: Array<z.infer<typeof FullVideoSchema> & { episodeNumber: 1 | 2 | 3; angleCategory: 'episode-1' | 'episode-2' | 'episode-3'; sceneCount: number }>
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

  // 0. Full Videos (EP1–EP3)
  const fullVideos = blueprint.fullVideos
  if (!Array.isArray(fullVideos)) {
    violations.push('Full Videos: esperado array "fullVideos"')
  } else if (fullVideos.length !== 3) {
    violations.push(`Full Videos: esperado 3 episódios, encontrado ${fullVideos.length}`)
  } else {
    const episodeAngles = fullVideos.map((fv: any) => fv?.angle).filter(Boolean)
    if (episodeAngles.length !== 3) violations.push('Full Videos: episódios sem "angle" válido')
    const uniqueEpisodeAngles = new Set(episodeAngles)
    if (uniqueEpisodeAngles.size !== episodeAngles.length) violations.push('Full Videos: ângulos duplicados entre episódios')
  }

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

/**
 * Structured output method: Gemini → functionCalling; Groq llama-4 → jsonMode;
 * Groq gpt-oss → jsonSchema (strict mode, avoids json_validate_failed).
 * Nota: jsonMode foi removido de @langchain/google-genai v2.x — apenas jsonSchema e functionCalling são suportados.
 * functionCalling evita as limitações de response_schema (const, default) da API Gemini.
 *
 * Gemini: Converte Zod → JSON Schema → sanitiza (remove campos incompatíveis como
 * const, default, minItems, maxItems, etc.) → passa JSON Schema puro + zodSchema para parse.
 */
function createStructuredOutput(model: any, schema: any, provider: string, modelId?: string) {
  const isGemini = provider.toLowerCase().includes('gemini') || provider.toLowerCase().includes('google')
  const isReplicate = provider.toLowerCase().includes('replicate')
  const isGroq = provider.toLowerCase().includes('groq')
  if (isReplicate && typeof (model as any).withStructuredOutputReplicate === 'function') {
    return (model as any).withStructuredOutputReplicate(schema, { includeRaw: true })
  }

  // Gemini: sanitizar schema para remover campos que a API rejeita
  if (isGemini) {
    const jsonSchema = sanitizeSchemaForGemini(toJsonSchema(schema))
    return (model as any).withStructuredOutput(jsonSchema, {
      includeRaw: true,
      method: 'functionCalling',
      zodSchema: schema // Usado para parsing/validação da resposta
    })
  }

  let method: string | undefined
  if (isGroq) {
    const modelName = modelId ?? (model as any).model ?? (model as any).modelName ?? ''
    if (modelName.includes('gpt-oss')) method = 'jsonSchema'
    else if (modelName.includes('llama-4')) method = 'jsonMode'
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
  const model = await createLlmForTask('monetization', { maxTokens: 16384, temperature: 0.5 })
  const structuredLlm = createStructuredOutput(model, schema, assignment.provider, assignment.model)

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
      error, `${LOG} [${stageName}]`, `monetization-${stageName}`, undefined, cacheResult.messages
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

  // Tentativa 2: content text (strip code fences e tentar parse)
  const stripFences = (s: string) =>
    s.replace(/```[\w]*\n?/g, '').replace(/```\n?/g, '').trim()
  const tryParse = (raw: string): any | null => {
    const cleaned = stripFences(raw)
    try {
      return JSON.parse(cleaned)
    } catch {
      const firstBrace = cleaned.search(/\{|\[/)
      if (firstBrace >= 0) {
        try {
          return JSON.parse(cleaned.slice(firstBrace))
        } catch {
          // ignora
        }
      }
    }
    return null
  }
  const candidates = rawMessage?.lc_kwargs?.content || rawMessage?.content
  try {
    if (typeof candidates === 'string') {
      const parsed = tryParse(candidates)
      if (parsed != null) {
        console.log(`${logPrefix} ✅ Fallback via content string`)
        return parsed
      }
    }
    if (Array.isArray(candidates)) {
      for (const part of candidates) {
        if (part?.type === 'text' && part?.text) {
          const parsed = tryParse(part.text)
          if (parsed != null) {
            console.log(`${logPrefix} ✅ Fallback via array content`)
            return parsed
          }
        }
      }
    }
  } catch (e: any) {
    console.warn(`${logPrefix} ⚠️ Fallback falhou: ${e.message}`)
  }
  return null
}

// =============================================================================
// TEASER UNWRAP HELPER
// =============================================================================

/**
 * Safely unwraps a single teaser from an invokeStage result.
 * Handles cases where Groq's failed_generation fallback returns:
 *   - { teasers: [{ ... }] }  (expected shape)
 *   - { title, hook, ... }    (teaser at root, no wrapper)
 *   - [{ ... }]               (bare array)
 */
function unwrapSingleTeaser(parsed: any, stageName: string): any {
  // Case 1: expected shape
  if (Array.isArray(parsed?.teasers) && parsed.teasers.length > 0) {
    return parsed.teasers[0]
  }
  // Case 2: bare array
  if (Array.isArray(parsed) && parsed.length > 0) {
    console.warn(`${LOG} ⚠️ ${stageName}: parsed é array sem wrapper — usando parsed[0]`)
    return parsed[0]
  }
  // Case 3: teaser at root (has typical teaser fields)
  if (parsed && typeof parsed === 'object' && (parsed.title || parsed.hook || parsed.narrativeRole)) {
    console.warn(`${LOG} ⚠️ ${stageName}: parsed é teaser na raiz (sem wrapper "teasers") — usando diretamente`)
    return parsed
  }
  throw new Error(`${stageName}: resposta não contém teasers válidos (parsed.teasers=${JSON.stringify(parsed?.teasers)})`)
}

/**
 * Safely unwraps an array of teasers from an invokeStage result.
 * Handles the same fallback shapes as unwrapSingleTeaser.
 */
function unwrapTeaserArray(parsed: any, stageName: string): any[] {
  if (Array.isArray(parsed?.teasers) && parsed.teasers.length > 0) {
    return parsed.teasers
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    console.warn(`${LOG} ⚠️ ${stageName}: parsed é array sem wrapper — usando diretamente`)
    return parsed
  }
  if (parsed && typeof parsed === 'object' && (parsed.title || parsed.hook || parsed.narrativeRole)) {
    console.warn(`${LOG} ⚠️ ${stageName}: parsed é teaser na raiz (sem wrapper "teasers") — wrapping em array`)
    return [parsed]
  }
  console.warn(`${LOG} ⚠️ ${stageName}: sem teasers encontrados no parsed — retornando []`)
  return []
}

/**
 * Fills missing fields on a teaser that came from a Groq failed_generation fallback.
 * Uses the blueprint slot data as defaults so the teaser is always complete.
 */
function hydrateTeaserDefaults(teaser: any, slot: any, stageName: string): any {
  if (!teaser || typeof teaser !== 'object') return teaser

  const missing: string[] = []
  const defaults: Record<string, any> = {
    narrativeRole: slot?.narrativeRole,
    angleCategory: slot?.angleCategory,
    angle: slot?.angleName || slot?.angleCategory,
    shortFormatType: slot?.shortFormatType,
    platform: 'YouTube Shorts',
    format: 'teaser-youtube-shorts',
    scriptStyleId: slot?.scriptStyleId || 'mystery',
    scriptStyleName: slot?.scriptStyleName || slot?.scriptStyleId || 'mystery',
    editorialObjectiveId: slot?.editorialObjectiveId || 'viral-hook',
    editorialObjectiveName: slot?.editorialObjectiveName || slot?.editorialObjectiveId || 'viral-hook',
    estimatedViews: 50000,
    scriptOutline: teaser.hook ? `Hook: ${teaser.hook}` : 'Script outline não gerado',
    visualSuggestion: 'Atmosfera documental com textura de arquivo',
    avoidPatterns: ['contextualização excessiva', 'nomes obscuros', 'CTA visível'],
    visualPrompt: 'Dark documentary atmosphere with archival textures, cinematic lighting, no faces',
    cta: teaser.narrativeRole === 'hook-only' ? null : (teaser.cta ?? null),
    targetEpisode: 1,
  }

  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (teaser[key] === undefined || teaser[key] === null || teaser[key] === '') {
      // Don't overwrite narrativeRole/angleCategory if already set
      if (key === 'cta' && teaser.narrativeRole === 'hook-only') {
        teaser[key] = null
        continue
      }
      teaser[key] = defaultValue
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    console.warn(`${LOG} 🩹 ${stageName}: hydrated ${missing.length} missing fields: ${missing.join(', ')}`)
  }

  return teaser
}

// =============================================================================
// MAIN PIPELINE
// =============================================================================

export async function generateMonetizationPlanV2(
  request: MonetizationPlannerV2Request
): Promise<MonetizationPlannerV2Result> {
  const teaserCount = Math.min(15, Math.max(4, request.teaserCount ?? 6))
  const sceneConfig = request.sceneConfig ?? {
    hookOnly: 4,
    deepDive: 6,
    gateway: 5,
    fullVideo: 150
  }
  const stageTimings: Record<string, number> = {}
  const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  console.log(`${LOG} 🚀 Pipeline por etapas iniciado (${teaserCount} teasers)`)

  const assignment = await getAssignment('monetization')
  console.log(`${LOG} Usando ${assignment.provider} (${assignment.model})`)

  // ── Dossiê block ────────────────────────────────────────────────
  // Full Video continua usando o dossiê completo. Teasers podem usar brief.
  const fullDossierBlock = buildDossierBlock({
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

  const briefParsed = BriefBundleV1Schema.safeParse(request.briefBundleV1)
  const teaserDossierBlock = briefParsed.success
    ? formatBriefBundleV1AsDossierBlock(briefParsed.data)
    : fullDossierBlock

  if (briefParsed.success) {
    console.log(`${LOG} 🧾 Teasers usando BriefBundleV1 (contexto reduzido)`)
  } else {
    console.log(`${LOG} 🧾 Teasers usando dossiê completo (sem briefBundleV1)`)
  }

  // Creative direction block (se houver)
  let creativeDirectionBlock = ''
  if (request.creativeDirection) {
    const cd = request.creativeDirection
    creativeDirectionBlock = `\n## 🎨 DIREÇÃO CRIATIVA PRÉ-APROVADA\n\n` +
      `**Full Videos (EP1–EP3):** roteiro=\`${cd.fullVideo.scriptStyle.id}\`, visual=\`${cd.fullVideo.visualStyle.id}\`, editorial=\`${cd.fullVideo.editorialObjective.id}\`\n` +
      `**Teasers:**\n${cd.teaserRecommendations.map((t, i) => `${i + 1}. Ângulo "${t.suggestedAngle}": roteiro=\`${t.scriptStyle.id}\`, editorial=\`${t.editorialObjective.id}\``).join('\n')}\n`
  }

  // Configuração orientada por CENAS (tempo é técnico/interno)
  const configBlock = `\n## ⚙️ CONFIGURAÇÃO (CENAS FIXAS)\n- Full Video: ${sceneConfig.fullVideo} cenas\n- Gateway: ${sceneConfig.gateway} cenas\n- Deep-Dive: ${sceneConfig.deepDive} cenas\n- Hook-Only: ${sceneConfig.hookOnly} cenas\n- Quantidade de teasers: ${teaserCount}\n`

  // =====================================================================
  // ETAPA 1: BLUEPRINT ESTRATÉGICO
  // =====================================================================
  console.log(`${LOG} ── ETAPA 1/6: Blueprint Estratégico ──`)

  const blueprintSkill = loadSkill('monetization/blueprint')
  const brandSafetySkill = loadSkill('brand-safety')
  const catalogBlock = serializeConstantsCatalog()
  const roleDistBlock = serializeRoleDistribution(teaserCount)

  let blueprint: any
  let violations: string[] = []
  const MAX_BLUEPRINT_RETRIES = 10
  // Histórico acumulativo de violações — evita repetição de erros entre retries
  const violationHistory: string[] = []

  for (let attempt = 0; attempt <= MAX_BLUEPRINT_RETRIES; attempt++) {
    const blueprintSystemPrompt = `${blueprintSkill}\n\n${brandSafetySkill}${creativeDirectionBlock}${configBlock}\n\n${catalogBlock}\n\n${roleDistBlock}`
    const blueprintUserPrompt = attempt === 0
      ? `Crie o blueprint estratégico para o dossiê acima. Gere ${teaserCount} slots de teasers com ângulos, roles e formatos.`
      : violationHistory.length > 1
        ? `📋 HISTÓRICO DE CORREÇÕES (${violationHistory.length} tentativas reprovadas):\n${'─'.repeat(50)}\n${violationHistory.map((v, i) => `[Tentativa ${i + 1}]\n${v}`).join('\n\n')}\n${'─'.repeat(50)}\n\n🚨 NÃO repita NENHUM erro listado acima. Regere o blueprint corrigindo todas as violações.`
        : `CORREÇÃO OBRIGATÓRIA:\n${violations.join('\n')}\n\nRegere o blueprint corrigindo as violações acima.`

    const BlueprintSchema = createBlueprintSchema(teaserCount)
    const result = await invokeStage('blueprint', BlueprintSchema, blueprintSystemPrompt, blueprintUserPrompt, teaserDossierBlock, assignment)
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
    violationHistory.push(violations.join('\n'))
    console.warn(`${LOG} ❌ Blueprint REPROVADO (tentativa ${attempt + 1}/${MAX_BLUEPRINT_RETRIES + 1}): ${violations.join('; ')}`)

    if (attempt >= MAX_BLUEPRINT_RETRIES) {
      throw new Error(`Blueprint reprovado após ${MAX_BLUEPRINT_RETRIES + 1} tentativas: ${violations.join('; ')}`)
    }
  }

  // ── Guard pós-loop: NUNCA prosseguir com blueprint reprovado ──
  const finalValidation = validateBlueprint(blueprint, teaserCount)
  if (!finalValidation.valid) {
    console.error(`${LOG} 🚨 Blueprint REPROVADO no guard pós-loop. Violações: ${finalValidation.violations.join('; ')}`)
    throw new Error(`Blueprint reprovado (guard pós-loop): ${finalValidation.violations.join('; ')}`)
  }

  const slots = blueprint.teaserSlots
  const gatewaySlots = slots.filter((s: any) => s.narrativeRole === 'gateway')
  const deepDiveSlots = slots.filter((s: any) => s.narrativeRole === 'deep-dive')
  const hookOnlySlots = slots.filter((s: any) => s.narrativeRole === 'hook-only')

  console.log(`${LOG} 📊 Blueprint: G=${gatewaySlots.length} DD=${deepDiveSlots.length} HO=${hookOnlySlots.length} | ${new Set(slots.map((s: any) => s.angleCategory)).size} ângulos únicos`)

  // =====================================================================
  // ETAPA 2: FULL VIDEO
  // =====================================================================
  console.log(`${LOG} ── ETAPA 2/6: Full Videos (EP1–EP3) ──`)

  const fullVideoSkill = loadSkill('monetization/full-video')
  const teaserAnglesBlock = `\n## ÂNGULOS DOS TEASERS (para NÃO sobrepor)\n${slots.map((s: any, i: number) => `${i + 1}. ${s.angleCategory}: ${s.angleName}`).join('\n')}\n`

  const fullVideosBase: Array<z.infer<typeof FullVideoSchema>> = []
  let fullVideosElapsedTotal = 0

  for (let i = 0; i < 3; i++) {
    const epNumber = (i + 1) as 1 | 2 | 3
    const angleCategory = (`episode-${epNumber}`) as 'episode-1' | 'episode-2' | 'episode-3'
    const slot = blueprint.fullVideos?.[i]
    if (!slot) throw new Error(`Blueprint inválido: fullVideos[${i}] ausente`)

    const previousEpisodesBlock = fullVideosBase.length > 0
      ? `\n## EPISÓDIOS JÁ DEFINIDOS (NÃO REPETIR)\n${fullVideosBase.map((v, idx) => {
        const n = idx + 1
        const safeTitle = (v as any)?.title || '(sem título)'
        const safeHook = (v as any)?.hook || '(sem hook)'
        const safeAngle = (v as any)?.angle || '(sem ângulo)'
        return `${n}. title="${safeTitle}" | angle="${safeAngle}" | hook="${safeHook}"`
      }).join('\n')}\n`
      : ''

    const coveredTerritoriesBlock = fullVideosBase.length > 0
      ? (() => {
        const items: string[] = []
        for (const v of fullVideosBase as any[]) {
          if (v?.angle) items.push(`angle: ${v.angle}`)
          if (Array.isArray(v?.keyPoints)) {
            for (const kp of v.keyPoints) {
              if (kp) items.push(`keyPoint: ${kp}`)
            }
          }
          if (v?.hook) items.push(`hook: ${v.hook}`)
        }
        const unique = Array.from(new Set(items)).slice(0, 24)
        return unique.length > 0
          ? `\n## TERRITÓRIOS JÁ COBERTOS (PROIBIDO REPETIR, MESMO COM SINÔNIMOS)\n- ${unique.join('\n- ')}\n`
          : ''
      })()
      : ''

    const r = await invokeStage(
      `full-video-ep${epNumber}`,
      FullVideoSchema,
      `${fullVideoSkill}\n\n${brandSafetySkill}${creativeDirectionBlock}${configBlock}${teaserAnglesBlock}${previousEpisodesBlock}${coveredTerritoriesBlock}\n\nEstilo visual do plano: ${blueprint.visualStyleId} (${blueprint.visualStyleName})`,
      `Gere a sugestão completa do Full Video (EP${epNumber}).\n\n` +
      `## FUNÇÃO NARRATIVA DESTE EPISÓDIO (EP${epNumber}):\n` +
      (epNumber === 1
        ? `- CONTEXTUALIZAÇÃO + ASCENSÃO: Mostre a origem, método e formação do conflito.\n` +
        `- Termine com TENSÃO CRESCENTE — o conflito se forma, mas NÃO se resolve.\n` +
        `- ⛔ PROIBIDO: revelar desfechos (mortes, prisões, libertações), traições, ou transformações pós-história.\n`
        : epNumber === 2
          ? `- GRANDE VIRADA: Entregue a traição, o ponto de inflexão, as consequências imediatas.\n` +
          `- Termine com o IMPACTO da virada — a situação mudou irreversivelmente.\n` +
          `- ⛔ PROIBIDO: revelar o legado final, o que aconteceu décadas depois, ou transformações do local.\n`
          : `- DESFECHO + LEGADO: Resolva todos os arcos, revele o destino final, conecte com o presente.\n` +
          `- EP3 pode referenciar eventos de EP1/EP2 para fechar a narrativa.\n`) +
      `\nRegras adicionais:\n` +
      `- Este episódio deve ser consistente com a série e NÃO repetir hooks/keyPoints já usados.\n` +
      `- O episódio deve ter começo-meio-fim (macro-loop fechado), mas manter ponte orgânica para o próximo episódio.\n` +
      `- TESTE DE SPOILER: Se o espectador assistir apenas este EP, ele saberia o desfecho final? Se SIM → remova o spoiler.\n\n` +
      `Slot definido no blueprint:\n` +
      `- angleCategory: "${angleCategory}"\n` +
      `- angle: "${slot.angle}"\n` +
      `- scriptStyleId: "${slot.scriptStyleId}"\n` +
      `- editorialObjectiveId: "${slot.editorialObjectiveId}"`,
      fullDossierBlock,
      assignment
    )

    fullVideosElapsedTotal += r.elapsed
    totalUsage.inputTokens += r.usage.inputTokens
    totalUsage.outputTokens += r.usage.outputTokens
    totalUsage.totalTokens += r.usage.totalTokens

    fullVideosBase.push(r.parsed)
  }

  stageTimings['full-video'] = fullVideosElapsedTotal

  const fullVideos = fullVideosBase.map((v, idx) => {
    const epNumber = (idx + 1) as 1 | 2 | 3
    const angleCategory = (`episode-${epNumber}`) as 'episode-1' | 'episode-2' | 'episode-3'
    return {
      ...v,
      episodeNumber: epNumber,
      angleCategory,
      sceneCount: sceneConfig.fullVideo
    }
  })

  // Bloco de contexto dos 3 episódios para targeting de teasers
  const episodeContextBlock = `\n## 🎬 EPISÓDIOS DO DOSSIÊ (para targetEpisode)\nCada teaser DEVE ter targetEpisode (1, 2 ou 3) indicando para qual episódio ele funila.\n${fullVideos.map(v => `- EP${v.episodeNumber}: "${v.title}" — ângulo: ${v.angle}`).join('\n')}\n\nRegras de distribuição:\n- Gateway: targetEpisode=1 (SEMPRE — é a porta de entrada do dossiê)\n- Deep-dive: distribua equilibradamente entre EP1, EP2, EP3 (~2 por EP), alinhando pelo ângulo mais próximo\n- Hook-only: distribua priorizando EP2 e EP3 (que têm menos exposição orgânica)\n`

  // =====================================================================
  // ETAPA 3: GATEWAY (1 teaser)
  // =====================================================================
  console.log(`${LOG} ── ETAPA 3/6: Gateway ──`)

  const gatewaySkill = loadSkill('monetization/gateway')
  const gwSlot = gatewaySlots[0]

  const gatewayResult = await invokeStage(
    'gateway',
    z.object({ teasers: z.array(TeaserSchema).length(1) }),
    `${gatewaySkill}\n\n${brandSafetySkill}${configBlock}${episodeContextBlock}\n\nEstilo visual do plano: ${blueprint.visualStyleId} (${blueprint.visualStyleName})\n\nHooks dos Full Videos (NÃO repetir):\n${fullVideos.map((v, i) => `${i + 1}. "${v.hook}"`).join('\n')}`,
    `Gere o teaser GATEWAY para o dossiê.\nGateway DEVE ter targetEpisode=1.\n\nSlot definido no blueprint:\n- angleCategory: "${gwSlot.angleCategory}"\n- angleName: "${gwSlot.angleName}"\n- shortFormatType: "${gwSlot.shortFormatType}"\n- platform: "${gwSlot.platform}"\n- scriptStyleId: "${gwSlot.scriptStyleId}"\n- editorialObjectiveId: "${gwSlot.editorialObjectiveId}"\n\nRetorne um JSON com campo "teasers" contendo exatamente 1 teaser.`,
    teaserDossierBlock, assignment
  )
  stageTimings['gateway'] = gatewayResult.elapsed
  totalUsage.inputTokens += gatewayResult.usage.inputTokens
  totalUsage.outputTokens += gatewayResult.usage.outputTokens
  totalUsage.totalTokens += gatewayResult.usage.totalTokens

  const gatewayTeaser = hydrateTeaserDefaults(unwrapSingleTeaser(gatewayResult.parsed, 'gateway'), gwSlot, 'gateway')
  const allTeasers = [gatewayTeaser]
  const usedHooks = [...fullVideos.map(v => v.hook), gatewayTeaser.hook]

  // =====================================================================
  // ETAPA 4: DEEP-DIVES (N teasers)
  // =====================================================================
  console.log(`${LOG} ── ETAPA 4/6: Deep-Dives (${deepDiveSlots.length}) ──`)

  if (deepDiveSlots.length > 0) {
    const deepDiveSkill = loadSkill('monetization/deep-dive')
    const isGroqProvider = assignment.provider.toLowerCase().includes('groq')

    // Groq + batches grandes tendem a estourar JSON strict (json_validate_failed).
    // Estratégia: quando Groq, gerar 1 por vez (mais confiável).
    if (isGroqProvider) {
      let elapsedTotal = 0
      for (let i = 0; i < deepDiveSlots.length; i++) {
        const s = deepDiveSlots[i]
        const alreadyGeneratedDeepDives = allTeasers
          .filter((t: any) => t?.narrativeRole === 'deep-dive')
          .map((t: any, idx: number) => `${idx + 1}. ${t.angleCategory}: "${t.hook}"`)
          .join('\n')

        const singleSystemPrompt =
          `${deepDiveSkill}\n\n${brandSafetySkill}${configBlock}${episodeContextBlock}\n\n` +
          `Estilo visual: ${blueprint.visualStyleId} (${blueprint.visualStyleName})\n\n` +
          `## HOOKS JÁ USADOS (NÃO REPETIR)\n${usedHooks.map((h, hi) => `${hi + 1}. "${h}"`).join('\n')}\n\n` +
          `## GATEWAY JÁ GERADO (NÃO repetir informações)\n` +
          `Hook: "${gatewayTeaser.hook}"\nÂngulo: ${gatewayTeaser.angleCategory}\nOutline: ${gatewayTeaser.scriptOutline}\n\n` +
          (alreadyGeneratedDeepDives
            ? `## DEEP-DIVES JÁ GERADOS (NÃO sobrepor territórios)\n${alreadyGeneratedDeepDives}\n`
            : '')

        const singleUserPrompt =
          `Gere 1 teaser DEEP-DIVE para o dossiê.\n\n` +
          `Slot definido no blueprint:\n` +
          `- angleCategory: "${s.angleCategory}"\n` +
          `- angleName: "${s.angleName}"\n` +
          `- shortFormatType: "${s.shortFormatType}"\n` +
          `- platform: "${s.platform}"\n` +
          `- scriptStyleId: "${s.scriptStyleId}"\n` +
          `- editorialObjectiveId: "${s.editorialObjectiveId}"\n\n` +
          `OBRIGATÓRIO: Atribua targetEpisode (1, 2 ou 3) alinhado ao episódio cujo ângulo mais se aproxima do angleCategory deste teaser. Distribua equilibradamente entre EP1, EP2 e EP3.\n\n` +
          `Retorne um JSON com campo "teasers" contendo exatamente 1 teaser.\n` +
          `CRÍTICO: A API rejeita a resposta se "teasers" tiver mais de um item. Retorne exatamente um objeto em "teasers".\n` +
          `CRÍTICO: Todos os campos (scriptOutline, visualSuggestion, cta, platform, format, estimatedViews, scriptStyleId, scriptStyleName, editorialObjectiveId, editorialObjectiveName, avoidPatterns, visualPrompt, sceneCount, targetEpisode) devem estar DENTRO do único objeto em "teasers", não na raiz do JSON.`

        const r = await invokeStage(
          `deep-dive-${i + 1}`,
          z.object({ teasers: z.array(TeaserSchema).length(1) }),
          singleSystemPrompt,
          singleUserPrompt,
          teaserDossierBlock,
          assignment
        )

        elapsedTotal += r.elapsed
        totalUsage.inputTokens += r.usage.inputTokens
        totalUsage.outputTokens += r.usage.outputTokens
        totalUsage.totalTokens += r.usage.totalTokens

        try {
          const teaser = hydrateTeaserDefaults(unwrapSingleTeaser(r.parsed, `deep-dive-${i + 1}`), s, `deep-dive-${i + 1}`)
          allTeasers.push(teaser)
          usedHooks.push(teaser.hook)
        } catch (e: any) {
          console.warn(`${LOG} ⚠️ deep-dive-${i + 1}: ${e.message} — pulando teaser`)
        }
      }

      stageTimings['deep-dives'] = elapsedTotal
    } else {
      const slotsBlock = deepDiveSlots.map((s: any, i: number) =>
        `${i + 1}. angleCategory="${s.angleCategory}", angleName="${s.angleName}", shortFormatType="${s.shortFormatType}", platform="${s.platform}", scriptStyleId="${s.scriptStyleId}", editorialObjectiveId="${s.editorialObjectiveId}"`
      ).join('\n')

      const deepDiveResult = await invokeStage(
        'deep-dives',
        z.object({ teasers: z.array(TeaserSchema).min(deepDiveSlots.length).max(deepDiveSlots.length + 1) }),
        `${deepDiveSkill}\n\n${brandSafetySkill}${configBlock}${episodeContextBlock}\n\nEstilo visual: ${blueprint.visualStyleId} (${blueprint.visualStyleName})\n\n## HOOKS JÁ USADOS (NÃO REPETIR)\n${usedHooks.map((h, i) => `${i + 1}. "${h}"`).join('\n')}\n\n## GATEWAY JÁ GERADO (NÃO repetir informações)\nHook: "${gatewayTeaser.hook}"\nÂngulo: ${gatewayTeaser.angleCategory}\nOutline: ${gatewayTeaser.scriptOutline}`,
        `Gere ${deepDiveSlots.length} teasers DEEP-DIVE para o dossiê.\n\nSlots definidos no blueprint:\n${slotsBlock}\n\nOBRIGATÓRIO: Cada teaser deve ter targetEpisode (1, 2 ou 3) alinhado ao episódio cujo ângulo mais se aproxima. Distribua equilibradamente (~2 por EP).\n\nRetorne um JSON com campo "teasers" contendo exatamente ${deepDiveSlots.length} teasers.`,
        teaserDossierBlock, assignment
      )
      stageTimings['deep-dives'] = deepDiveResult.elapsed
      totalUsage.inputTokens += deepDiveResult.usage.inputTokens
      totalUsage.outputTokens += deepDiveResult.usage.outputTokens
      totalUsage.totalTokens += deepDiveResult.usage.totalTokens

      const ddTeasers = unwrapTeaserArray(deepDiveResult.parsed, 'deep-dives')
        .map((t: any, idx: number) => hydrateTeaserDefaults(t, deepDiveSlots[idx], `deep-dives-batch-${idx + 1}`))
      allTeasers.push(...ddTeasers)
      usedHooks.push(...ddTeasers.map((t: any) => t.hook))
    }
  }

  // =====================================================================
  // ETAPA 5: HOOK-ONLY (N teasers)
  // =====================================================================
  console.log(`${LOG} ── ETAPA 5/6: Hook-Only (${hookOnlySlots.length}) ──`)

  if (hookOnlySlots.length > 0) {
    const hookOnlySkill = loadSkill('monetization/hook-only')
    const isGroqProvider = assignment.provider.toLowerCase().includes('groq')

    if (isGroqProvider) {
      let elapsedTotal = 0
      for (let i = 0; i < hookOnlySlots.length; i++) {
        const s = hookOnlySlots[i]

        const singleSystemPrompt =
          `${hookOnlySkill}\n\n${brandSafetySkill}${configBlock}${episodeContextBlock}\n\n` +
          `Estilo visual: ${blueprint.visualStyleId} (${blueprint.visualStyleName})\n\n` +
          `## HOOKS JÁ USADOS (NÃO REPETIR)\n${usedHooks.map((h, hi) => `${hi + 1}. "${h}"`).join('\n')}\n\n` +
          `## TEASERS JÁ GERADOS (NÃO repetir territórios)\n${allTeasers.map((t: any, ti: number) => `${ti + 1}. [${t.narrativeRole}] ${t.angleCategory} → EP${(t as any).targetEpisode || '?'}: "${t.hook}"`).join('\n')}`

        const singleUserPrompt =
          `Gere 1 teaser HOOK-ONLY para o dossiê.\n\n` +
          `Slot definido no blueprint:\n` +
          `- angleCategory: "${s.angleCategory}"\n` +
          `- angleName: "${s.angleName}"\n` +
          `- shortFormatType: "${s.shortFormatType}"\n` +
          `- platform: "${s.platform}"\n` +
          `- scriptStyleId: "${s.scriptStyleId}"\n` +
          `- editorialObjectiveId: "${s.editorialObjectiveId}"\n\n` +
          `OBRIGATÓRIO: Atribua targetEpisode (1, 2 ou 3). Hook-only deve priorizar EP2 e EP3 (menos exposição orgânica). Alinhe ao ângulo do episódio mais próximo.\n\n` +
          `Retorne um JSON com campo "teasers" contendo exatamente 1 teaser.\n` +
          `CRÍTICO: A API rejeita a resposta se "teasers" tiver mais de um item. Retorne exatamente um objeto em "teasers".\n` +
          `CRÍTICO: Todos os campos (scriptOutline, visualSuggestion, cta, platform, format, estimatedViews, scriptStyleId, scriptStyleName, editorialObjectiveId, editorialObjectiveName, avoidPatterns, visualPrompt, sceneCount, targetEpisode) devem estar DENTRO do único objeto em "teasers", não na raiz do JSON.`

        const r = await invokeStage(
          `hook-only-${i + 1}`,
          z.object({ teasers: z.array(TeaserSchema).length(1) }),
          singleSystemPrompt,
          singleUserPrompt,
          teaserDossierBlock,
          assignment
        )

        elapsedTotal += r.elapsed
        totalUsage.inputTokens += r.usage.inputTokens
        totalUsage.outputTokens += r.usage.outputTokens
        totalUsage.totalTokens += r.usage.totalTokens

        try {
          const teaser = hydrateTeaserDefaults(unwrapSingleTeaser(r.parsed, `hook-only-${i + 1}`), s, `hook-only-${i + 1}`)
          allTeasers.push(teaser)
          usedHooks.push(teaser.hook)
        } catch (e: any) {
          console.warn(`${LOG} ⚠️ hook-only-${i + 1}: ${e.message} — pulando teaser`)
        }
      }

      stageTimings['hook-only'] = elapsedTotal
    } else {
      const slotsBlock = hookOnlySlots.map((s: any, i: number) =>
        `${i + 1}. angleCategory="${s.angleCategory}", angleName="${s.angleName}", shortFormatType="${s.shortFormatType}", platform="${s.platform}", scriptStyleId="${s.scriptStyleId}", editorialObjectiveId="${s.editorialObjectiveId}"`
      ).join('\n')

      const hookOnlyResult = await invokeStage(
        'hook-only',
        z.object({ teasers: z.array(TeaserSchema).min(hookOnlySlots.length).max(hookOnlySlots.length + 1) }),
        `${hookOnlySkill}\n\n${brandSafetySkill}${configBlock}${episodeContextBlock}\n\nEstilo visual: ${blueprint.visualStyleId} (${blueprint.visualStyleName})\n\n## HOOKS JÁ USADOS (NÃO REPETIR)\n${usedHooks.map((h, i) => `${i + 1}. "${h}"`).join('\n')}\n\n## TEASERS JÁ GERADOS (NÃO repetir territórios)\n${allTeasers.map((t, i) => `${i + 1}. [${t.narrativeRole}] ${t.angleCategory} → EP${(t as any).targetEpisode || '?'}: "${t.hook}"`).join('\n')}`,
        `Gere ${hookOnlySlots.length} teasers HOOK-ONLY para o dossiê.\n\nSlots definidos no blueprint:\n${slotsBlock}\n\nOBRIGATÓRIO: Cada teaser deve ter targetEpisode (1, 2 ou 3). Hook-only prioriza EP2 e EP3. Distribua equilibradamente.\n\nRetorne um JSON com campo "teasers" contendo exatamente ${hookOnlySlots.length} teasers.`,
        teaserDossierBlock, assignment
      )
      stageTimings['hook-only'] = hookOnlyResult.elapsed
      totalUsage.inputTokens += hookOnlyResult.usage.inputTokens
      totalUsage.outputTokens += hookOnlyResult.usage.outputTokens
      totalUsage.totalTokens += hookOnlyResult.usage.totalTokens

      const hoTeasers = unwrapTeaserArray(hookOnlyResult.parsed, 'hook-only')
        .map((t: any, idx: number) => hydrateTeaserDefaults(t, hookOnlySlots[idx], `hook-only-batch-${idx + 1}`))
      allTeasers.push(...hoTeasers)
    }
  }

  // =====================================================================
  // ETAPA 6: PUBLICATION SCHEDULE
  // =====================================================================
  console.log(`${LOG} ── ETAPA 6/6: Publication Schedule ──`)

  const scheduleSkill = loadSkill('monetization/schedule')
  const itemsSummary = [
    ...fullVideos.map(v => `Full Video EP${v.episodeNumber}: "${v.title}" (YouTube)`),
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

  const teasersWithSceneCount = allTeasers.map((t: any) => {
    const role = t?.narrativeRole
    const sceneCount = role === 'gateway'
      ? sceneConfig.gateway
      : role === 'hook-only'
        ? sceneConfig.hookOnly
        : sceneConfig.deepDive
    return {
      ...t,
      // Hook-only não tem CTA/branding: normalize para null
      cta: role === 'hook-only' ? null : (t?.cta ?? null),
      sceneCount
    }
  })

  return {
    plan: {
      planTitle: blueprint.planTitle,
      visualStyleId: blueprint.visualStyleId,
      visualStyleName: blueprint.visualStyleName,
      fullVideos,
      teasers: teasersWithSceneCount,
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
