/**
 * Monetization Planner Service
 * 
 * Usa LangChain + Structured Output para analisar o conteúdo do dossiê
 * e gerar um plano de monetização Document-First:
 * 1 Full Video (YouTube) + 4-6 Teasers (TikTok/Shorts/Reels)
 */

import { z } from 'zod'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { loadSkill } from '../utils/skill-loader'
import { serializeConstantsCatalog, serializeRoleDistribution } from '../utils/constants-catalog'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import type { CreativeDirection } from './creative-direction-advisor.service'
import { buildDossierBlock } from '../utils/dossier-prompt-block'
import { buildCacheableMessages, logCacheMetrics } from './llm/anthropic-cache-helper'

const LOG = '[MonetizationPlanner]'

// ── Helper: Gemini-safe structured output ────────────────────────
// Gemini API pode rejeitar schemas Zod v4 complexos mesmo com 'jsonSchema'.
// Estratégia: para Gemini, usar método 'jsonSchema' que força responseMimeType=application/json.
// Se falhar, fallback para parsing manual do raw response.
function createStructuredOutput(model: any, schema: any, provider: string) {
  const isGemini = provider.toLowerCase().includes('gemini') || provider.toLowerCase().includes('google')
  const method = isGemini ? 'jsonSchema' : undefined
  console.log(`${LOG} 🔧 Structured output method: ${method || 'default (functionCalling)'} (provider: ${provider})`)
  return (model as any).withStructuredOutput(schema, {
    includeRaw: true,
    ...(method ? { method } : {})
  })
}

// Fallback parser: extrai JSON da resposta raw quando parsed é null (Zod v4 compat)
function fallbackParseFromRaw(rawMessage: any, logPrefix: string): any | null {
  // Tentativa 1: Extrair de tool_calls (Anthropic function calling)
  const toolCalls = rawMessage?.tool_calls || rawMessage?.lc_kwargs?.tool_calls
  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    const firstTool = toolCalls[0]
    if (firstTool?.args) {
      console.log(`${logPrefix} ✅ Fallback parse bem sucedido (tool_calls[0].args)`)
      return firstTool.args
    }
    // Anthropic usa 'input' em vez de 'args'
    if (firstTool?.input) {
      console.log(`${logPrefix} ✅ Fallback parse bem sucedido (tool_calls[0].input)`)
      return firstTool.input
    }
  }

  // Tentativa 2: Extrair de content (text response)
  const candidates = rawMessage?.lc_kwargs?.content || rawMessage?.content
  try {
    // Tentar extrair do content text
    if (typeof candidates === 'string') {
      // Limpar markdown code blocks se houver
      const cleaned = candidates.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      console.log(`${logPrefix} ✅ Fallback parse bem sucedido (content string)`)
      return parsed
    }
    // Array content (AIMessageChunk com parts)
    if (Array.isArray(candidates)) {
      for (const part of candidates) {
        if (part?.type === 'text' && part?.text) {
          const cleaned = part.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const parsed = JSON.parse(cleaned)
          console.log(`${logPrefix} ✅ Fallback parse bem sucedido (array content)`)
          return parsed
        }
      }
    }
  } catch (e: any) {
    console.warn(`${logPrefix} ⚠️ Fallback parse falhou: ${e.message}`)
    console.warn(`${logPrefix} 🔍 Raw content (500 chars):`, typeof candidates === 'string' ? candidates.substring(0, 500) : JSON.stringify(candidates)?.substring(0, 500))
  }
  return null
}

/**
 * Normaliza a resposta do modelo quando o formato difere do schema esperado.
 * 
 * O schema espera:
 *   { fullVideo: {...}, teasers: [...], publicationSchedule: [...], ... }
 * 
 * Mas o Gemini pode retornar variantes como:
 *   { plan: { items: [{ type: "full-video", ... }, { type: "teaser", ... }] } }
 *   { plan: { fullVideo: {...}, teasers: [...] } }
 *   { monetizationPlan: { ... } }
 */
/**
 * Normaliza o cronograma de publicação — o Gemini pode retornar como
 * 'cadence', 'schedule', ou 'publicationSchedule' com formatos variados.
 */
function normalizeSchedule(raw: any): Array<{ dayOfWeek: string; content: string; platform: string; notes?: string }> {
  if (!raw) return []

  // Se já é array de objetos com dayOfWeek, retornar normalizado
  if (Array.isArray(raw)) {
    // Array de strings (ex: ["Day 1: Full Video (YouTube)", ...])
    if (raw.length > 0 && typeof raw[0] === 'string') {
      return parseScheduleStrings(raw)
    }
    // Array de objetos
    return raw.map((item: any) => ({
      dayOfWeek: item.dayOfWeek || item.day_of_week || item.day || item.weekday || '',
      content: item.content || item.title || item.description || item.what || '',
      platform: item.platform || item.channel || '',
      notes: item.notes || item.note || item.timing || undefined,
    }))
  }

  // Objeto com sequence[] (formato Gemini: { strategy, frequency, sequence: string[] })
  if (typeof raw === 'object') {
    if (raw.sequence && Array.isArray(raw.sequence)) {
      console.log(`${LOG} 📅 Schedule formato Gemini (sequence): strategy="${raw.strategy}", ${raw.sequence.length} etapas`)
      const schedule = parseScheduleStrings(raw.sequence)
      if (schedule.length > 0 && raw.strategy && schedule[0]) {
        schedule[0].notes = `Estratégia: ${raw.strategy} (${raw.frequency || 'custom'})`
      }
      return schedule
    }
    if (raw.items && Array.isArray(raw.items)) {
      return normalizeSchedule(raw.items)
    }
    // Formato por semanas: { week1: "texto", week2: "texto", ... }
    const weekKeys = Object.keys(raw).filter(k => /^week\d+$/i.test(k))
    if (weekKeys.length > 0) {
      console.log(`${LOG} 📅 Schedule formato Gemini (weeks): ${weekKeys.length} semanas`)
      return weekKeys.sort().map(k => ({
        dayOfWeek: k.replace(/^week/i, 'Semana '),
        content: String(raw[k]),
        platform: '',
        notes: undefined,
      }))
    }
    // Formato genérico: { strategy: "...", notes: "..." } — extrair como string descritiva
    const values = Object.values(raw).filter(v => typeof v === 'string') as string[]
    if (values.length > 0) {
      console.log(`${LOG} 📅 Schedule formato Gemini (object genérico): ${Object.keys(raw).join(', ')}`)
      return values.map((v, i) => ({
        dayOfWeek: `Etapa ${i + 1}`,
        content: v,
        platform: '',
      }))
    }
  }

  // String simples
  if (typeof raw === 'string') {
    console.warn(`${LOG} ⚠️ Cronograma veio como string: "${raw}" — ignorando`)
    return []
  }

  return []
}

/**
 * Parseia um array de strings do cronograma no formato:
 * "Day 1: Full Video (YouTube)"
 * "Day 2: Teaser 1 (Gateway) - TikTok/Reels/Shorts"
 */
function parseScheduleStrings(lines: string[]): Array<{ dayOfWeek: string; content: string; platform: string; notes?: string }> {
  return lines.map(line => {
    // Tentar extrair "Day X: Conteúdo - Plataforma" ou "Day X: Conteúdo (Plataforma)"
    const dayMatch = line.match(/^(Day\s*\d+|Dia\s*\d+|[A-Za-zÀ-ú]+[-\s]feira|Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo)\s*[:\-]\s*/i)
    const dayOfWeek = dayMatch?.[1]?.trim() ?? ''
    const rest = dayMatch ? line.substring(dayMatch[0].length).trim() : line.trim()

    // Extrair plataforma: "(YouTube)" ou "- TikTok/Reels"
    const platformMatch = rest.match(/[\(\-]\s*(YouTube|TikTok|Instagram\s*Reels|Reels|Shorts|YouTube\s*Shorts)[\/\w\s]*[\)]?\s*$/i)
    const platform = platformMatch?.[1]?.trim() ?? ''
    const content = platformMatch?.index != null ? rest.substring(0, platformMatch.index).replace(/\s*[-]\s*$/, '').trim() : rest

    return { dayOfWeek, content, platform }
  })
}

/**
 * Converte estimatedViews de string para número.
 * Gemini retorna coisas como "250k - 500k", "100k+", "1.5M"
 */
function parseEstimatedViews(value: any): number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return 0
  // Pegar o primeiro número com possível sufixo k/m
  const match = value.match(/([\d.,]+)\s*([kmKM])?/)
  if (!match) return 0
  let num = parseFloat(match[1]!.replace(',', '.'))
  if (match[2]?.toLowerCase() === 'k') num *= 1000
  if (match[2]?.toLowerCase() === 'm') num *= 1000000
  return Math.round(num)
}

function normalizeMonetizationResponse(raw: any): any {
  // Passo 1: Unwrap — extrair do wrapper se existir
  let data = raw
  const topKeys = Object.keys(data)

  // Se tem uma única key que é um objeto, provavelmente é wrapper
  if (topKeys.length <= 3) {
    for (const key of topKeys) {
      const inner = data[key]
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        // Se o inner já tem fullVideo/teasers, usar direto
        if (inner.fullVideo && inner.teasers) {
          console.log(`${LOG} 📦 Unwrap '${key}' → formato correto (continua para normalização)`)
          data = inner
          break
        }
        // Se o inner tem items array, precisa transformar
        if (inner.items && Array.isArray(inner.items)) {
          data = inner
          console.log(`${LOG} 📦 Unwrap '${key}' → formato items[]`)
          break
        }
      }
    }
  }

  // Passo 2: Se já tem fullVideo e teasers, normalizar aliases e retornar
  if (data.fullVideo && data.teasers) {
    // Extrair visualStyle se veio como objeto { id, name } em vez de campos separados
    const vs = data.visualStyle || {}
    const visualStyleId = data.visualStyleId || data.visual_style_id || vs.id || 'noir-cinematic'
    const visualStyleName = data.visualStyleName || data.visual_style_name || vs.name || 'Noir Cinematic'

    // Normalizar estimatedViews de string para número em todos os items
    if (data.fullVideo.estimatedViews) {
      data.fullVideo.estimatedViews = parseEstimatedViews(data.fullVideo.estimatedViews)
    }
    if (Array.isArray(data.teasers)) {
      data.teasers = data.teasers.map((t: any) => ({
        ...t,
        estimatedViews: parseEstimatedViews(t.estimatedViews || t.estimated_views || 0),
        angleCategory: t.angleCategory || t.angle_category || 'cronologico',
        narrativeRole: t.narrativeRole || t.narrative_role || undefined,
        scriptOutline: t.scriptOutline || t.script_outline || '',
        visualSuggestion: t.visualSuggestion || t.visual_suggestion || '',
        cta: t.cta || t.callToAction || t.call_to_action || '',
      }))
    }

    // Resolver aliases de schedule: publishingSchedule, publication_schedule, schedule, cadence
    const rawSchedule = data.publicationSchedule || data.publication_schedule
      || data.publishingSchedule || data.publishing_schedule
      || data.schedule || data.cadence

    const result = {
      ...data,
      visualStyleId,
      visualStyleName,
      visualStyle: undefined, // remover objeto wrapper
      publicationSchedule: normalizeSchedule(rawSchedule),
      publishingSchedule: undefined, // remover alias
      estimatedTotalRevenue: data.estimatedTotalRevenue || data.estimated_total_revenue
        || data.estimatedRevenue || data.revenue || '$50-100',
      strategicNotes: data.strategicNotes || data.strategic_notes
        || data.notes || data.strategy || data.summary || '',
    }

    console.log(`${LOG} ✅ Normalizado (formato direto): 1 Full Video + ${result.teasers?.length ?? 0} Teasers, Schedule: ${result.publicationSchedule?.length ?? 0} items`)
    return result
  }

  // Passo 3: Converter items[] para fullVideo + teasers
  if (data.items && Array.isArray(data.items)) {
    // Log detalhado para diagnóstico de campos
    const dataKeys = Object.keys(data)
    console.log(`${LOG} 🔄 Convertendo items[] (${data.items.length} items) para formato canônico...`)
    console.log(`${LOG} 🔍 Campos no nível data: [${dataKeys.join(', ')}]`)
    // Listar subcampos de cada item para diagnóstico
    data.items.forEach((item: any, i: number) => {
      console.log(`${LOG}   item[${i}] type=${item.type} keys=[${Object.keys(item).join(', ')}]`)
    })

    const fullVideoItem = data.items.find((item: any) =>
      item.type === 'full-video' || item.type === 'full_video' ||
      item.format === 'full-youtube' || item.platform === 'YouTube'
    )

    const teaserItems = data.items.filter((item: any) =>
      item.type === 'teaser' || item.type === 'short' ||
      item.format?.startsWith('teaser-') ||
      ['TikTok', 'YouTube Shorts', 'Instagram Reels'].includes(item.platform)
    )

    // Se não achou explicitamente, o primeiro é full e o resto teasers
    const resolvedFullVideo = fullVideoItem || data.items[0]
    const resolvedTeasers = teaserItems.length > 0
      ? teaserItems
      : data.items.slice(1)

    // Spread-first: preserva TODOS os campos originais do modelo.
    // Só sobrescreve campos que sabemos ter nomes alternativos (snake_case → camelCase).
    const normalizeItem = (item: any) => ({
      ...item, // ← preserva tudo que o modelo retornou (duration, id, notes, etc.)
      // Aliases — resolve nomes alternativos, mas NÃO sobrescreve se o campo canônico já existe
      angle: item.angle || item.narrativeAngle || item.narrative_angle || '',
      angleCategory: item.angleCategory || item.angle_category || 'cronologico',
      narrativeRole: item.narrativeRole || item.narrative_role || undefined,
      scriptOutline: item.scriptOutline || item.script_outline || item.structure || '',
      visualSuggestion: item.visualSuggestion || item.visual_suggestion || '',
      cta: item.cta || item.callToAction || item.call_to_action || '',
      estimatedViews: parseEstimatedViews(item.estimatedViews || item.estimated_views || 0),
      scriptStyleId: item.scriptStyleId || item.script_style_id || 'documentary',
      scriptStyleName: item.scriptStyleName || item.script_style_name || 'Documentary',
      editorialObjectiveId: item.editorialObjectiveId || item.editorial_objective_id || 'hidden-truth',
      editorialObjectiveName: item.editorialObjectiveName || item.editorial_objective_name || 'Hidden Truth',
      visualPrompt: item.visualPrompt || item.visual_prompt || item.imagePrompt || '',
    })

    const result: any = {
      // Preservar campos extras do nível plan (id, title, notes, etc.)
      ...data,
      // Remover items[] já que foi desestruturado
      items: undefined,
      // Mapear campos com aliases
      visualStyleId: data.visualStyleId || data.visual_style_id || resolvedFullVideo?.visualStyleId || 'noir-cinematic',
      visualStyleName: data.visualStyleName || data.visual_style_name || resolvedFullVideo?.visualStyleName || 'Noir Cinematic',
      fullVideo: {
        ...normalizeItem(resolvedFullVideo),
        // Garantir campos obrigatórios do Full Video
        structure: resolvedFullVideo.structure || resolvedFullVideo.scriptOutline || resolvedFullVideo.script_outline || '',
        keyPoints: resolvedFullVideo.keyPoints || resolvedFullVideo.key_points || [],
        emotionalArc: resolvedFullVideo.emotionalArc || resolvedFullVideo.emotional_arc || '',
        platform: 'YouTube',
        format: 'full-youtube',
      },
      teasers: resolvedTeasers.map((t: any) => normalizeItem(t)),
      // Cronograma: Gemini pode usar 'cadence', 'schedule', 'publicationSchedule', etc.
      publicationSchedule: normalizeSchedule(
        data.publicationSchedule || data.publication_schedule || data.schedule || data.cadence
      ),
      estimatedTotalRevenue: data.estimatedTotalRevenue || data.estimated_total_revenue
        || data.estimatedRevenue || data.revenue || '$50-100',
      strategicNotes: data.strategicNotes || data.strategic_notes
        || data.notes || data.strategy || data.summary || '',
    }
    // Limpar campo items e cadence (já mapeados)
    delete result.items
    delete result.cadence

    console.log(`${LOG} ✅ Normalizado: 1 Full Video + ${result.teasers.length} Teasers, Schedule: ${result.publicationSchedule?.length ?? 0} items`)
    return result
  }

  // Não conseguiu normalizar — retornar original e deixar a validação posterior pegar
  console.warn(`${LOG} ⚠️ Não foi possível normalizar resposta. Keys: [${Object.keys(data).join(', ')}]`)
  return data
}

/**
 * Invoca o LLM com structured output. Para Gemini, se withStructuredOutput falhar com 400,
 * faz fallback para chamada raw + parsing manual do JSON.
 */
async function invokeWithFallback(
  model: any,
  schema: any,
  provider: string,
  messages: any[]
): Promise<{ parsed: any; raw: any }> {
  const isGemini = provider.toLowerCase().includes('gemini') || provider.toLowerCase().includes('google')

  // Tentativa 1: withStructuredOutput (funciona para OpenAI/Anthropic/Groq, pode funcionar para Gemini)
  try {
    const structuredLlm = createStructuredOutput(model, schema, provider)
    const result = await structuredLlm.invoke(messages)

    if (result.parsed) {
      return { parsed: result.parsed, raw: result.raw }
    }

    // parsed é null — tentativa de fallback do raw
    console.log(`${LOG} ⚠️ Structured output retornou parsed=null. Tentando fallback...`)
    console.log(`${LOG} 🔍 Raw message type:`, typeof result.raw)
    console.log(`${LOG} 🔍 Raw message keys:`, Object.keys(result.raw || {}))

    const fallback = fallbackParseFromRaw(result.raw, LOG)
    if (fallback) {
      // Para Gemini, normalizar aliases mesmo no fallback parse
      const normalized = isGemini ? normalizeMonetizationResponse(fallback) : fallback
      return { parsed: normalized, raw: result.raw }
    }

    // Fallback falhou — logar conteúdo raw para debug
    const rawContent = result.raw?.lc_kwargs?.content || result.raw?.content || result.raw
    const contentPreview = typeof rawContent === 'string'
      ? rawContent.substring(0, 2000)
      : JSON.stringify(rawContent, null, 2).substring(0, 2000)

    console.error(`${LOG} ❌ Fallback parse falhou. Raw content (primeiros 2000 chars):`)
    console.error(contentPreview)

    throw new Error('Structured output retornou parsed=null e fallback falhou')
  } catch (error: any) {
    // Se não é Gemini, propagar o erro normalmente
    if (!isGemini) throw error

    // Para Gemini: tentar chamada RAW (sem schema) e parsear manualmente
    console.warn(`${LOG} ⚠️ Gemini structured output falhou. Tentando chamada raw...`)
    console.warn(`${LOG} 🔍 Erro original completo: ${error.message}`)

    try {
      const rawResult = await model.invoke(messages)
      const rawContent = rawResult?.lc_kwargs?.content || rawResult?.content
      let jsonText = typeof rawContent === 'string' ? rawContent : ''

      // Se for array (parts), extrair texto
      if (Array.isArray(rawContent)) {
        for (const part of rawContent) {
          if (part?.type === 'text' && part?.text) {
            jsonText = part.text
            break
          }
          if (typeof part === 'string') {
            jsonText = part
            break
          }
        }
      }

      // Limpar e parsear
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      console.log(`${LOG} 🔍 Raw JSON text (primeiros 1000 chars): ${jsonText.substring(0, 1000)}`)
      let parsed: any
      try {
        parsed = JSON.parse(jsonText)
      } catch (firstParseErr: any) {
        console.warn(`${LOG} ⚠️ JSON.parse direto falhou: ${firstParseErr.message}`)
        console.warn(`${LOG} 🔧 Tentando sanitizar JSON...`)

        // Sanitização: corrigir problemas comuns do Gemini
        let sanitized = jsonText
          // Remover trailing commas antes de } ou ]
          .replace(/,\s*([}\]])/g, '$1')
          // Fix aspas curly/smart quotes → aspas retas
          .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
          .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
          // Remover caracteres de controle (exceto \n \r \t)
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
          // Remover BOM
          .replace(/^\uFEFF/, '')

        try {
          parsed = JSON.parse(sanitized)
          console.log(`${LOG} ✅ JSON sanitizado parseado com sucesso`)
        } catch (secondParseErr: any) {
          console.warn(`${LOG} ⚠️ Sanitização básica falhou: ${secondParseErr.message}`)

          // Tentativa avançada: escapar aspas internas (ex: "texto "interno" texto")
          try {
            const escaped = sanitized.replace(/(\w)"(\w)/g, '$1\\"$2')
            parsed = JSON.parse(escaped)
            console.log(`${LOG} ✅ JSON com aspas escapadas parseado com sucesso`)
          } catch (escapeErr) {
            // Última tentativa: extrair o primeiro bloco {} completo
            const jsonMatch = sanitized.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              try {
                parsed = JSON.parse(jsonMatch[0])
                console.log(`${LOG} ✅ Bloco JSON extraído e parseado com sucesso`)
              } catch (thirdParseErr: any) {
                console.error(`${LOG} ❌ Todas as tentativas de parse falharam`)
                console.error(`${LOG} 🔍 Texto recebido completo (${jsonText.length} chars):`)
                console.error(jsonText)
                throw firstParseErr // Lançar o erro original (mais preciso)
              }
            } else {
              console.error(`${LOG} ❌ Nenhum bloco JSON encontrado no texto`)
              console.error(`${LOG} 🔍 Texto recebido completo (${jsonText.length} chars):`)
              console.error(jsonText)
              throw firstParseErr
            }
          }
        }
      }

      // Diagnóstico: logar estrutura do JSON
      const topKeys = Object.keys(parsed)
      console.log(`${LOG} 🔍 Raw JSON keys: [${topKeys.join(', ')}]`)

      // SEMPRE normalizar — mesmo quando já tem fullVideo/teasers,
      // precisa resolver aliases (publishingSchedule, visualStyle, estimatedViews string, etc.)
      parsed = normalizeMonetizationResponse(parsed)

      console.log(`${LOG} ✅ Gemini raw fallback bem sucedido (keys: [${Object.keys(parsed).join(', ')}])`)
      return { parsed, raw: rawResult }
    } catch (rawError: any) {
      console.error(`${LOG} ❌ Gemini raw fallback também falhou:`)
      console.error(`${LOG} 🔍 Erro completo: ${rawError.message}`)
      if (rawError.stack) console.error(`${LOG} 📎 Stack: ${rawError.stack}`)
      // Lançar o erro ORIGINAL (mais informativo)
      throw error
    }
  }
}

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
  platform: z.enum(['YouTube']).describe('Plataforma obrigatória: YouTube'),
  format: z.enum(['full-youtube']).describe('Formato obrigatório: full-youtube'),
  // ── Creative Direction (ATENÇÃO: roteiro ≠ visual) ─────────────
  scriptStyleId: z.string().describe(
    'ID do ESTILO DE ROTEIRO (como o narrador conta a história). ' +
    'IDs válidos: "documentary", "mystery", "narrative", "educational". ' +
    'NÃO confundir com estilo visual (noir-cinematic, photorealistic, etc).'
  ),
  scriptStyleName: z.string().describe('Nome legível do estilo de roteiro (ex: "Documentário Profissional", "Mistério Real")'),
  editorialObjectiveId: z.string().describe(
    'ID do objetivo editorial. IDs válidos: "full-reveal", "hidden-truth", "cliffhanger", ' +
    '"mystery-layers", "deep-analysis", "explainer", "emotional-impact", "viral-hook", "controversy".'
  ),
  editorialObjectiveName: z.string().describe('Nome legível do objetivo editorial (ex: "Verdade Oculta", "Gancho Viral")'),
  // ── Visual Preview ──────────────────────────────────────────────
  visualPrompt: z.string().describe('Prompt de imagem (inglês, 1 parágrafo) descrevendo uma cena representativa no estilo visual ÚNICO do plano. Deve incluir atmosfera, iluminação, composição e estilo artístico.'),
})

const TeaserSuggestionSchema = z.object({
  title: z.string().describe('Título curto e impactante'),
  hook: z.string().describe('Frase de abertura (até 15 palavras), DIFERENTE de todos os outros teasers'),
  angle: z.string().describe('Ângulo narrativo ÚNICO deste teaser'),
  angleCategory: z.enum([
    'cronologico', 'economico', 'ideologico', 'politico', 'humano',
    'conspirativo', 'cientifico', 'geopolitico', 'cultural', 'paradoxal',
    'conexao-temporal', 'psicologico', 'evidencial', 'revisionista',
    'propagandistico', 'tecnologico', 'etico'
  ]).describe('Categoria do ângulo — escolha do catálogo de Ângulos Narrativos'),
  // ── Papel Narrativo ────────────────────────────────────────────
  narrativeRole: z.enum(['gateway', 'deep-dive', 'hook-only'])
    .describe('Papel narrativo: gateway (contexto completo), deep-dive (contexto mínimo), hook-only (zero contexto)'),
  scriptOutline: z.string().describe('Estrutura resumida do script (Hook → Setup → Revelação → CTA)'),
  visualSuggestion: z.string().describe('Descrição curta do visual sugerido'),
  cta: z.string().describe('Call-to-action para o Full Video'),
  platform: z.enum(['TikTok', 'YouTube Shorts', 'Instagram Reels']).describe('Plataforma alvo'),
  format: z.enum(['teaser-tiktok', 'teaser-reels']).describe('ID do formato de vídeo'),
  estimatedViews: z.number().describe('Estimativa de views na plataforma'),
  // ── Creative Direction (ATENÇÃO: roteiro ≠ visual) ─────────────
  scriptStyleId: z.string().describe(
    'ID do ESTILO DE ROTEIRO (como o narrador conta). ' +
    'IDs válidos: "documentary", "mystery", "narrative", "educational". ' +
    'NÃO é estilo visual — noir-cinematic, photorealistic são visuais, NÃO roteiro.'
  ),
  scriptStyleName: z.string().describe('Nome legível do estilo de roteiro (ex: "Documentário Profissional", "Mistério Real")'),
  editorialObjectiveId: z.string().describe(
    'ID do objetivo editorial. IDs válidos: "full-reveal", "hidden-truth", "cliffhanger", ' +
    '"mystery-layers", "deep-analysis", "explainer", "emotional-impact", "viral-hook", "controversy".'
  ),
  editorialObjectiveName: z.string().describe('Nome legível do objetivo editorial'),
  // ── Anti-Padrões (O QUE NÃO FAZER) ────────────────────────────
  avoidPatterns: z.array(z.string()).min(1).max(4).describe(
    'Lista de 1-4 instruções de "O QUE NÃO FAZER" específicas para este teaser. ' +
    'Cada item deve ser uma instrução CONCRETA baseada no conteúdo do dossiê, não genérica. ' +
    'Ex: "NÃO comece com \'Trento, 1475. Um menino...\' — isso é contextualização introdutória", ' +
    '"NÃO explique quem foi Simão de Trento — assuma que o espectador já sabe", ' +
    '"NÃO use tom de documentário neutro — este teaser exige urgência". ' +
    'Para gateway, os avoidPatterns focam em evitar excesso (não contar TUDO). ' +
    'Para deep-dive, focam em eliminar contextualização. ' +
    'Para hook-only, focam em eliminar qualquer setup.'
  ),
  // ── Visual Preview ──────────────────────────────────────────────
  visualPrompt: z.string().describe('Prompt de imagem (inglês, 1 parágrafo) para este teaser, usando o estilo visual ÚNICO do plano. Deve refletir o ângulo narrativo específico do teaser.'),
})

const PublicationScheduleSchema = z.object({
  dayOfWeek: z.string().describe('Dia da semana (ex: "Segunda")'),
  content: z.string().describe('O que publicar (ex: "Full Video no YouTube")'),
  platform: z.string().describe('Plataforma alvo'),
  notes: z.string().optional().describe('Notas adicionais sobre timing')
})

// Schema factory: gera com min/max dinâmico baseado no teaserCount solicitado
function createMonetizationPlanSchema(teaserCount: number = 6) {
  const min = Math.max(4, teaserCount - 1) // tolerância de -1
  const max = Math.min(15, teaserCount + 1) // tolerância de +1

  return z.object({
    // ── Estilo Visual Único do Plano ───────────────────────────────
    visualStyleId: z.string().describe('ID do estilo visual ÚNICO para TODO o plano (ex: "ghibli-dark", "cyberpunk"). Todos os itens compartilham este estilo.'),
    visualStyleName: z.string().describe('Nome legível do estilo visual escolhido para o plano'),
    // ── Conteúdo ──────────────────────────────────────────────────
    fullVideo: FullVideoSuggestionSchema.describe('Sugestão do vídeo completo para YouTube'),
    teasers: z.array(TeaserSuggestionSchema).min(min).max(max).describe(`Lista de ${teaserCount} teasers com ângulos e papéis narrativos diferentes`),
    publicationSchedule: z.array(PublicationScheduleSchema).min(4).max(20).describe('Cronograma de publicação semanal'),
    estimatedTotalRevenue: z.string().describe('Estimativa de receita total do pacote (ex: "$80-120")'),
    strategicNotes: z.string().describe('Notas estratégicas sobre o plano (o que funciona melhor para este tema)')
  })
}

type MonetizationPlan = z.infer<ReturnType<typeof createMonetizationPlanSchema>>

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
    sources?: Array<{ title: string; content: string; sourceType: string; weight?: number }>
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
  sources?: Array<{ title: string; content: string; sourceType: string; weight?: number }>
  notes?: Array<{ content: string; noteType: string }>
  images?: Array<{ description: string }>
  persons?: Array<{ name: string; role?: string | null; description?: string | null; relevance: string }>
  researchData?: any
  teaserDuration: 60 | 120 | 180
  fullVideoDuration: 300 | 600 | 900
  /** Quantidade de teasers desejada (4-15, padrão: 6) */
  teaserCount?: number
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
  request: MonetizationPlannerRequest
): Promise<MonetizationPlannerResult> {
  const teaserCount = Math.min(15, Math.max(4, request.teaserCount ?? 6))

  console.log(`${LOG} 💰 Iniciando geração de plano de monetização...`)
  console.log(`${LOG} ⏱️ Teasers: ${teaserCount}x ${request.teaserDuration}s | Full: ${request.fullVideoDuration / 60}min`)

  // Criar modelo via LLM Factory (com maxTokens aumentado para 15 teasers + fullVideo)
  const assignment = await getAssignment('monetization')
  const model = await createLlmForTask('monetization', { maxTokens: 32768 })
  const MonetizationPlanSchema = createMonetizationPlanSchema(teaserCount)

  // Carregar skill de monetização
  const skillContent = loadSkill('monetization-planner')

  // Montar prompts
  const systemPrompt = buildSystemPrompt(skillContent, request)
  const userPrompt = buildUserPrompt(request)

  // ── Prompt Caching: montar dossiê canônico ──────────────────────
  const dossierBlock = buildDossierBlock({
    theme: request.theme,
    title: request.title,
    sources: request.sources?.map(s => ({
      title: s.title, content: s.content, type: s.sourceType,
      weight: s.weight ?? 1.0
    })),
    userNotes: request.notes?.map(n => n.content),
    persons: request.persons?.map(p => ({
      name: p.name,
      role: p.role,
      description: p.description,
      relevance: p.relevance
    }))
  })

  const isAnthropicProvider = assignment.provider.toLowerCase().includes('anthropic') || assignment.provider.toLowerCase().includes('claude')
  const cacheResult = buildCacheableMessages({
    dossierBlock,
    systemPrompt,
    taskPrompt: userPrompt,
    providerName: isAnthropicProvider ? 'ANTHROPIC' : assignment.provider
  })

  console.log(`${LOG} 📤 Enviando para ${assignment.provider} (${assignment.model})...`)
  if (cacheResult.cacheEnabled) {
    console.log(`${LOG} 🗄️ Cache ativado — dossiê: ~${cacheResult.estimatedCacheTokens} tokens`)
  }

  const messages = [...cacheResult.messages]

  try {
    const startTime = Date.now()
    const { parsed: content, raw: rawMessage } = await invokeWithFallback(
      model, MonetizationPlanSchema, assignment.provider, messages
    )
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    // Extrair token usage
    const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
    const inputTokens = usage?.input_tokens ?? 0
    const outputTokens = usage?.output_tokens ?? 0
    const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

    console.log(`${LOG} ✅ Plano gerado em ${elapsed}s`)
    console.log(`${LOG} 🔍 Parsed keys:`, Object.keys(content || {}))
    console.log(`${LOG} 📊 1 Full Video + ${content?.teasers?.length ?? '?'} Teasers`)
    console.log(`${LOG} 📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)
    console.log(`${LOG} 💵 Receita estimada: ${content?.estimatedTotalRevenue ?? 'N/A'}`)

    // ── Log de métricas de cache ──────────────────────────────────
    if (cacheResult.cacheEnabled) {
      logCacheMetrics('Monetization', rawMessage)
    }

    // Validar que o JSON tem a estrutura mínima esperada
    if (!content?.teasers || !content?.fullVideo) {
      console.error(`${LOG} ❌ JSON parseado não tem estrutura esperada. Keys:`, Object.keys(content || {}))
      console.error(`${LOG} 🔍 Conteúdo (primeiros 500 chars):`, JSON.stringify(content).substring(0, 500))
      throw new Error(`Plano de monetização inválido: faltam campos obrigatórios (teasers: ${!!content?.teasers}, fullVideo: ${!!content?.fullVideo})`)
    }

    return {
      plan: content,
      usage: { inputTokens, outputTokens, totalTokens },
      provider: assignment.provider.toUpperCase(),
      model: assignment.model
    }
  } catch (error) {
    console.error(`${LOG} ❌ Erro na geração:`, error)
    throw error
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildSystemPrompt(skillContent: string, request: MonetizationPlannerRequest): string {
  const teaserCount = Math.min(15, Math.max(4, request.teaserCount ?? 6))
  const teaserLabel = request.teaserDuration === 60 ? 'curtos (60s)' : request.teaserDuration === 120 ? 'médios (120s)' : 'longos (180s)'
  const fullLabel = `${request.fullVideoDuration / 60} minutos`

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
${creativeDirectionBlock}

## ⚙️ CONFIGURAÇÃO DESTA SESSÃO

- **Duração dos Teasers:** ${teaserLabel} (${request.teaserDuration} segundos cada)
- **Duração do Full Video:** ${fullLabel} (${request.fullVideoDuration} segundos)
- **Quantidade de Teasers:** Gere EXATAMENTE ${teaserCount} teasers

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
  request: RegenerateItemRequest
): Promise<RegenerateItemResult> {
  const isTeaser = request.type === 'teaser'
  const schema = isTeaser ? SingleTeaserSchema : SingleFullVideoSchema
  const label = isTeaser ? `Teaser #${(request.index ?? 0) + 1}` : 'Full Video'

  console.log(`[MonetizationPlanner] 🔄 Regenerando ${label}...`)

  const assignment = await getAssignment('monetization')
  const regenModel = await createLlmForTask('monetization')

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
  const { parsed: content, raw: rawMessage } = await invokeWithFallback(
    regenModel, schema, assignment.provider, messages
  )
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

  const resolvedModel = assignment.model

  console.log(`${LOG} ✅ ${label} regenerado em ${elapsed}s (${totalTokens} tokens)`)

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
    console.log(`${LOG} 📅 Regenerando cronograma...`)

    const scheduleModel = await createLlmForTask('monetization')

    const fullVideoTitle = updatedPlan.fullVideo.title
    const teaserList = updatedPlan.teasers
      .map((t: any, i: number) => `${i + 1}. "${t.title}" (${t.platform}, ${t.angleCategory})`)
      .join('\n')

    const scheduleMessages = [
      new SystemMessage(`Você é um estrategista de publicação de conteúdo. Crie um cronograma de publicação semanal otimizado para os vídeos listados. Use os títulos e plataformas EXATOS fornecidos. Distribua os conteúdos ao longo da semana para maximizar engajamento. Retorne em JSON estruturado.`),
      new HumanMessage(`Crie o cronograma de publicação para este pacote de conteúdo:\n\n## Full Video (YouTube):\n"${fullVideoTitle}"\n\n## Teasers:\n${teaserList}\n\nDistribua ao longo da semana (Segunda a Domingo). O Full Video geralmente vai no meio da semana. Teasers vão antes e depois para gerar expectativa e reforço.`)
    ]

    const { parsed: scheduleData, raw: scheduleRaw } = await invokeWithFallback(
      scheduleModel, RegeneratedScheduleSchema, assignment.provider, scheduleMessages
    )
    updatedSchedule = scheduleData?.publicationSchedule
    const scheduleUsage = scheduleRaw?.usage_metadata || scheduleRaw?.response_metadata?.usage
    scheduleTokens.input = scheduleUsage?.input_tokens ?? 0
    scheduleTokens.output = scheduleUsage?.output_tokens ?? 0

    console.log(`${LOG} 📅 Cronograma atualizado (${scheduleTokens.input + scheduleTokens.output} tokens)`)
  } catch (scheduleError) {
    console.warn(`${LOG} ⚠️ Falha ao regenerar cronograma (mantendo anterior):`, scheduleError)
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
    provider: assignment.provider.toUpperCase(),
    model: resolvedModel
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildUserPrompt(request: MonetizationPlannerRequest): string {
  // O dossiê (theme, sources, notes, persons) agora vem via buildDossierBlock (cacheado)
  // Este prompt contém APENAS as instruções específicas de monetização

  let prompt = `Crie um plano de monetização Document-First para o dossiê acima:\n\n`

  // ── Parâmetros de duração ──────────────────────────────────────────
  prompt += `⏱️ DURAÇÕES OBRIGATÓRIAS:\n`
  prompt += `- Teasers: ${request.teaserDuration}s cada\n`
  prompt += `- Full Video: ${request.fullVideoDuration / 60} minutos\n\n`

  // ── Creative Direction (se fornecida) ──────────────────────────────
  if (request.creativeDirection) {
    const cd = request.creativeDirection
    prompt += `🎨 DIREÇÃO CRIATIVA (OBRIGATÓRIA):\n`
    prompt += `Visual Style: ${cd.fullVideo.visualStyle.name} (ID: ${cd.fullVideo.visualStyle.id})\n`
    prompt += `Script Style: ${cd.fullVideo.scriptStyle.name} (ID: ${cd.fullVideo.scriptStyle.id})\n`
    prompt += `Editorial Objective: ${cd.fullVideo.editorialObjective.name} (ID: ${cd.fullVideo.editorialObjective.id})\n`
    prompt += `\n⚠️ TODOS os itens do plano (Full Video + Teasers) DEVEM usar esses IDs. Não invente IDs novos.\n\n`
  }

  // ── Catálogo de constantes ────────────────────────────────────────
  prompt += serializeConstantsCatalog()
  prompt += `\n\n`

  // ── Role Distribution Strategy ─────────────────────────────────────
  const teaserCount = Math.min(15, Math.max(4, request.teaserCount ?? 6))
  prompt += serializeRoleDistribution(teaserCount)
  prompt += `\n\n`

  // ── Instruções finais ──────────────────────────────────────────────
  prompt += `\n🎯 INSTRUÇÕES FINAIS:\n`
  prompt += `1. Gere 1 Full Video + ${Math.min(15, Math.max(4, request.teaserCount ?? 6))} Teasers\n`
  prompt += `2. Cada item deve ter hook ÚNICO e ângulo DIFERENTE\n`
  prompt += `3. Use os IDs do catálogo de constantes (não invente novos)\n`
  prompt += `4. Inclua avoidPatterns específicos para cada teaser (baseados no dossiê)\n`
  prompt += `5. Gere visualPrompt em inglês para cada item (1 parágrafo, atmosfera + composição)\n`
  prompt += `6. Retorne o plano completo em JSON estruturado\n`

  return prompt
}
