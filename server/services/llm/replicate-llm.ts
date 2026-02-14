/**
 * Replicate LLM Wrapper para LangChain
 * 
 * Wrapper customizado que usa o SDK nativo `replicate` (já instalado para mídia)
 * em vez do @langchain/community que exige version hash.
 * 
 * Suporta model IDs sem versão: "meta/llama-4-maverick-instruct"
 */

import { LLM } from '@langchain/core/language_models/llms'
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import Replicate from 'replicate'

export interface ReplicateLLMInput {
  model: string
  apiKey: string
  temperature?: number
  maxTokens?: number
  topK?: number
  topP?: number
  systemPrompt?: string
}

export class ReplicateChatLLM extends LLM {
  private client: Replicate
  private modelId: string
  private temperature: number
  private maxTokens: number
  private topK: number
  private topP: number
  private systemPrompt: string

  constructor(config: ReplicateLLMInput) {
    super({})
    this.client = new Replicate({ auth: config.apiKey })
    this.modelId = config.model
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? 16384
    this.topK = config.topK ?? 50
    this.topP = config.topP ?? 0.9
    this.systemPrompt = config.systemPrompt ?? 'You are a helpful assistant.'
  }

  _llmType(): string {
    return 'replicate'
  }

  async _call(
    prompt: string,
    _options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const input: Record<string, any> = {
      prompt,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      top_k: this.topK,
      top_p: this.topP
    }

    // Extrair system prompt se veio nos messages do LangChain
    if (prompt.startsWith('System:') || prompt.startsWith('system:')) {
      const splitIdx = prompt.indexOf('\nHuman:')
      if (splitIdx > 0) {
        input.system_prompt = prompt.substring(prompt.indexOf(':') + 1, splitIdx).trim()
        input.prompt = prompt.substring(splitIdx + '\nHuman:'.length).trim()
      }
    } else {
      input.system_prompt = this.systemPrompt
    }

    const modelRef = this.modelId as `${string}/${string}`

    console.log('[ReplicateChatLLM] 📤 Input:', JSON.stringify({ model: modelRef, prompt: input.prompt?.slice(0, 80), max_tokens: input.max_tokens, temperature: input.temperature }))

    // 1. Tentar stream()
    try {
      let text = ''
      let eventCount = 0
      for await (const ev of this.client.stream(modelRef, { input })) {
        eventCount++
        if (ev.event === 'output' && ev.data != null) {
          const chunk = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '')
          text += chunk
          if (eventCount <= 3) console.log('[ReplicateChatLLM] 📥 stream event:', ev.event, 'data:', JSON.stringify(String(ev.data).slice(0, 100)))
        } else if (ev.event === 'error' || ev.event === 'done') {
          console.log('[ReplicateChatLLM] 📥 stream event:', ev.event, ev.data != null ? JSON.stringify(ev.data).slice(0, 200) : '')
        }
      }
      console.log('[ReplicateChatLLM] ✅ stream() concluído. Eventos:', eventCount, '| texto length:', text.length, '| preview:', JSON.stringify(text.slice(0, 150)))

      // Detectar JSON truncado: stream pode encerrar sem erro mas entregar dado parcial
      const trimmed = text.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          JSON.parse(trimmed)
        } catch (parseCheck: any) {
          if (parseCheck?.message?.includes('Unterminated') || parseCheck?.message?.includes('Unexpected end')) {
            console.warn(`[ReplicateChatLLM] ⚠️ Stream entregou JSON truncado (${text.length} chars). Tentando run()...`)
            // Não retorna — cai pro fallback run() abaixo
            throw new Error('Stream truncated JSON — falling back to run()')
          }
        }
      }

      return text
    } catch (streamErr: any) {
      const msg = streamErr?.message || String(streamErr)
      console.log('[ReplicateChatLLM] ⚠️ stream() falhou:', msg)
      if (!msg.includes('does not support streaming') && !msg.includes('stream') && !msg.includes('truncated')) {
        console.warn('[ReplicateChatLLM] stream() falhou, usando run():', msg)
      }
    }

    // 2. Fallback: run()
    console.log('[ReplicateChatLLM] 🔄 Usando run()...')
    const outputRaw: unknown = await this.client.run(modelRef, { input })

    console.log('[ReplicateChatLLM] 📥 run() output type:', typeof outputRaw, '| isArray:', Array.isArray(outputRaw))

    if (outputRaw != null && typeof (outputRaw as any)[Symbol.asyncIterator] === 'function') {
      let text = ''
      for await (const chunk of outputRaw as AsyncIterable<string>) {
        text += typeof chunk === 'string' ? chunk : String(chunk ?? '')
      }
      return text
    }

    if (Array.isArray(outputRaw)) {
      return outputRaw.map((c: any) => typeof c === 'string' ? c : String(c ?? '')).join('')
    }

    if (typeof outputRaw === 'string') {
      return outputRaw
    }

    return outputRaw != null ? String(outputRaw) : ''
  }

  /**
   * Structured output via invoke + parse JSON.
   * Inclui normalização robusta para lidar com variações do Llama.
   */
  withStructuredOutputReplicate(schema: any, _options?: any) {
    const self = this

    // =====================================================================
    // Helper: extrair string de qualquer coisa
    // =====================================================================
    function asString(v: any, ...fallbackKeys: string[]): string {
      if (typeof v === 'string') return v
      if (v && typeof v === 'object') {
        for (const k of fallbackKeys) {
          if (typeof v[k] === 'string') return v[k]
        }
        // Tentar valores do objeto
        const vals = Object.values(v)
        const strVal = vals.find(x => typeof x === 'string')
        if (strVal) return strVal as string
        return JSON.stringify(v)
      }
      return v != null ? String(v) : ''
    }

    // =====================================================================
    // Helper: garantir array
    // =====================================================================
    function asArray(v: any): any[] {
      if (Array.isArray(v)) return v
      if (v != null) return [v]
      return []
    }

    // =====================================================================
    // COERÇÃO GENÉRICA (Zod v4): Percorre o schema e força tipos corretos
    // Resolve TODA classe de erros "expected X, received Y"
    // Zod v4: _def.type = 'string'|'number'|'object'|'array'|'enum'|etc
    // =====================================================================
    function coerceToSchema(obj: any, zodSchema: any): any {
      if (obj === null || obj === undefined || !zodSchema) return obj
      const def = zodSchema._def
      if (!def) return obj
      const t = def.type // Zod v4 usa _def.type como 'string', 'object', etc.

      // object → percorrer cada campo usando shape (preencher faltantes com defaults)
      if (t === 'object' && typeof obj === 'object' && !Array.isArray(obj)) {
        const shape = def.shape || zodSchema.shape
        if (!shape || typeof shape !== 'object') return obj
        const result: any = { ...obj }
        for (const [key, fieldSchema] of Object.entries(shape)) {
          const fs = fieldSchema as any
          const fsDef = fs?._def
          const fsType = fsDef?.type
          if (result[key] !== undefined && fs && typeof fs === 'object') {
            // Campo existe → coerce ao tipo esperado
            result[key] = coerceToSchema(result[key], fs)
          } else if (result[key] === undefined && fsType && fsType !== 'optional' && fsType !== 'nullable') {
            // Campo faltante + required → preencher com default baseado no tipo
            if (fsType === 'string') result[key] = ''
            else if (fsType === 'number') result[key] = 0
            else if (fsType === 'boolean') result[key] = false
            else if (fsType === 'array') result[key] = []
            else if (fsType === 'enum') {
              const entries = fsDef.entries || {}
              const vals = Object.values(entries)
              result[key] = vals[0] ?? ''
            }
          }
        }
        return result
      }

      // string → forçar para string
      if (t === 'string') {
        if (typeof obj === 'string') return obj
        return asString(obj)
      }

      // number → forçar para number (com suporte a sufixos k/M/B e ranges)
      if (t === 'number') {
        if (typeof obj === 'number') return obj
        if (typeof obj === 'string') {
          // Extrair primeiro número com possível sufixo (ex: "500k-1M" → 500000)
          const match = obj.match(/([\d.,]+)\s*([kKmMbB])?/)
          if (match) {
            let num = parseFloat(match[1]!.replace(',', '.'))
            const suffix = match[2]?.toLowerCase()
            if (suffix === 'k') num *= 1000
            else if (suffix === 'm') num *= 1000000
            else if (suffix === 'b') num *= 1000000000
            return isNaN(num) ? 0 : Math.round(num)
          }
        }
        const n = Number(obj)
        return isNaN(n) ? 0 : n
      }

      // boolean → forçar para boolean
      if (t === 'boolean') {
        if (typeof obj === 'boolean') return obj
        return Boolean(obj)
      }

      // array → forçar para array e coerce cada item (Zod v4: _def.element)
      if (t === 'array') {
        const arr = asArray(obj)
        const itemSchema = def.element
        if (itemSchema) return arr.map((item: any) => coerceToSchema(item, itemSchema))
        return arr
      }

      // enum → forçar para valor válido (Zod v4: _def.entries = {a:'a',b:'b'})
      if (t === 'enum') {
        const entries = def.entries || {}
        const values = Object.values(entries) as string[]
        if (values.includes(obj)) return obj
        if (typeof obj === 'string') {
          // Normalizar: lowercase + remover acentos + remover espaços/barras → match fuzzy
          const normalize = (s: string) => s.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remover acentos
            .replace(/\s*[\/|]\s*/g, '-')  // "Ético / Moral" → "etico-moral"
            .replace(/\s+/g, '-')          // espaços → hifens
            .trim()
          const objNorm = normalize(obj)
          // Match exato normalizado
          const match = values.find((v: string) => normalize(v) === objNorm)
          if (match) return match
          // Match parcial: "Conexão Temporal" → "conexao-temporal" contém "conexao-temporal"
          const partialMatch = values.find((v: string) => objNorm.includes(normalize(v)) || normalize(v).includes(objNorm))
          if (partialMatch) return partialMatch
        }
        console.warn(`[ReplicateChatLLM] ⚠️ Enum coercion: "${obj}" → fallback "${values[0]}" (válidos: ${values.slice(0, 5).join(', ')}...)`)
        return values[0]
      }

      // nullable / optional → desempacotar e coerce inner type
      if (t === 'nullable' || t === 'optional') {
        if (obj === null || obj === undefined) return obj
        const innerType = def.innerType
        if (innerType) return coerceToSchema(obj, innerType)
        return obj
      }

      return obj
    }

    /**
     * Normaliza o JSON do Llama para o schema esperado.
     * Estratégia: extrair → renomear → desagrupar → defaults obrigatórios
     */
    function normalizeForSchema(obj: any): any {
      if (!obj || typeof obj !== 'object') return obj

      // ── Guard: só normalizar se o SCHEMA for StoryOutline ──
      // Esta função é específica para StoryOutlineSchema (hookStrategy, risingBeats, etc.)
      // Para outros schemas (MonetizationPlan, ValidationResult, etc.), retornar sem modificar
      const schemaDef = schema?._def
      const schemaShape = schemaDef?.shape || schema?.shape
      if (schemaShape && typeof schemaShape === 'object') {
        const schemaFieldNames = Object.keys(schemaShape)
        const isStoryOutline = schemaFieldNames.includes('hookStrategy') || schemaFieldNames.includes('risingBeats')
        if (!isStoryOutline) {
          console.log('[ReplicateChatLLM] ⏭️ normalizeForSchema: schema NÃO é StoryOutline — pulando normalização')
          return obj
        }
      }

      const out: any = { ...obj }

      // ── 0. Spread sub-objetos "wrapper" que contêm campos do schema ──
      // Llama coloca campos dentro de: narrativeStrategy, narrative, strategy, etc.
      for (const wrapperKey of ['narrativeStrategy', 'narrative', 'strategy', 'storyOutline', 'outline', 'narrativePlan']) {
        if (out[wrapperKey] && typeof out[wrapperKey] === 'object' && !Array.isArray(out[wrapperKey])) {
          for (const [k, v] of Object.entries(out[wrapperKey])) {
            if (out[k] === undefined) out[k] = v
          }
          delete out[wrapperKey]
        }
      }

      // ── 1. Renomear campos com nomes diferentes ──
      // setupPromise → promiseSetup
      if (out.setupPromise !== undefined && out.promiseSetup === undefined) {
        out.promiseSetup = asString(out.setupPromise, 'promise', 'setup', 'description', 'text')
        delete out.setupPromise
      }
      // Garantir promiseSetup é string
      if (out.promiseSetup && typeof out.promiseSetup !== 'string') {
        out.promiseSetup = asString(out.promiseSetup, 'promise', 'setup', 'description', 'text')
      }

      // ctaStrategy / cta → ctaApproach
      if (!out.ctaApproach) {
        const ctaSrc = out.ctaStrategy || out.cta
        if (ctaSrc) out.ctaApproach = asString(ctaSrc, 'approach', 'strategy', 'text', 'message')
      }
      delete out.ctaStrategy
      delete out.cta

      // beats / risingAction → risingBeats
      if (!out.risingBeats) {
        const beatsSource = out.risingAction || out.beats || out.risingBeats
        if (beatsSource) {
          out.risingBeats = asArray(beatsSource).map((b: any, i: number) => ({
            order: b?.order ?? i + 1,
            revelation: asString(b, 'revelation', 'content', 'description', 'beat', 'text'),
            questionAnswered: asString(b, 'questionAnswered', 'question_answered', 'answered', 'questionResolved') || '',
            newQuestion: asString(b, 'newQuestion', 'new_question', 'openQuestion', 'curiosityGap') || '',
            sourceReference: asString(b, 'sourceReference', 'source_reference', 'source', 'evidence') || ''
          }))
        }
      }
      delete out.risingAction
      delete out.beats

      // ── 2. Desagrupar sub-objetos (climax, resolution, editorialDecisions) ──
      // climax → climaxMoment + climaxFormula (pode ser string, object ou qualquer coisa)
      if (out.climax !== undefined && !out.climaxMoment) {
        if (typeof out.climax === 'object' && out.climax !== null) {
          out.climaxMoment = asString(out.climax, 'moment', 'climaxMoment', 'description', 'revelation', 'text')
          out.climaxFormula = asString(out.climax, 'formula', 'climaxFormula', 'type', 'technique', 'pattern') || 'Pattern Recognition'
        } else {
          out.climaxMoment = asString(out.climax)
          out.climaxFormula = 'Pattern Recognition'
        }
        delete out.climax
      }

      // resolution → resolutionPoints + resolutionAngle (pode ser string, object, array)
      if (out.resolution !== undefined && !out.resolutionPoints) {
        if (typeof out.resolution === 'object' && out.resolution !== null && !Array.isArray(out.resolution)) {
          out.resolutionPoints = asArray(out.resolution.points || out.resolution.resolutionPoints || out.resolution.keyPoints || [])
          out.resolutionAngle = asString(out.resolution, 'angle', 'resolutionAngle', 'implication', 'takeaway', 'impact')
        } else if (Array.isArray(out.resolution)) {
          out.resolutionPoints = out.resolution
          out.resolutionAngle = ''
        } else {
          out.resolutionPoints = [asString(out.resolution)]
          out.resolutionAngle = ''
        }
        delete out.resolution
      }

      // editorialDecisions → whatToReveal, whatToHold, whatToIgnore
      if (out.editorialDecisions && typeof out.editorialDecisions === 'object') {
        const ed = out.editorialDecisions
        if (!out.whatToReveal) out.whatToReveal = asArray(ed.whatToReveal || ed.reveal || ed.include || ed.mustReveal || [])
        if (!out.whatToHold) out.whatToHold = asArray(ed.whatToHold || ed.hold || ed.withhold || ed.mustHold || [])
        if (!out.whatToIgnore) out.whatToIgnore = asArray(ed.whatToIgnore || ed.ignore || ed.exclude || ed.mustIgnore || [])
        delete out.editorialDecisions
      }

      // ── 3. hookStrategy — garantir que é string ──
      // Llama às vezes retorna hookStrategy como objeto { technique, element, rationale }
      if (out.hookStrategy && typeof out.hookStrategy !== 'string') {
        out.hookStrategy = asString(out.hookStrategy, 'technique', 'strategy', 'approach', 'description', 'rationale', 'text')
      }
      if (!out.hookStrategy) {
        // Tentar extrair de hookVariants, title, ou fornecer default
        if (Array.isArray(out.hookVariants) && out.hookVariants.length > 0) {
          out.hookStrategy = out.hookVariants[0]?.rationale || 'Abordagem direta'
        } else if (out.hook) {
          out.hookStrategy = 'Abordagem direta'
        } else {
          out.hookStrategy = out.shortFormatType || out.angle || 'Abordagem narrativa'
        }
      }

      // hookVariants: mapear aliases antes de sintetizar
      if (!out.hookVariants) {
        // Llama pode retornar como "variants", "hookLevels", etc.
        const aliasSource = out.variants || out.hookLevels || out.hooks
        if (aliasSource) {
          out.hookVariants = asArray(aliasSource)
          delete out.variants
          delete out.hookLevels
          delete out.hooks
        }
      }
      // hookVariants: sintetizar se ainda ausente
      if (!out.hookVariants) {
        const hookText = out.hook || out.hookStrategy || ''
        const rat = out.rationale || out.hookRationale || ''
        out.hookVariants = [
          { level: 'green', hook: hookText, rationale: rat || 'Tom informativo' },
          { level: 'moderate', hook: hookText, rationale: rat || 'Tom provocativo' },
          { level: 'aggressive', hook: hookText, rationale: rat || 'Tom agressivo' },
          { level: 'lawless', hook: hookText, rationale: rat || 'Tom extremo' }
        ]
      }
      // Garantir exatamente 4 hookVariants
      if (Array.isArray(out.hookVariants)) {
        const levels = ['green', 'moderate', 'aggressive', 'lawless']
        // Garantir que cada variant tem os campos certos
        out.hookVariants = out.hookVariants.map((v: any) => ({
          level: v?.level || 'green',
          hook: asString(v, 'hook', 'text', 'content') || out.hookStrategy || '',
          rationale: asString(v, 'rationale', 'reason', 'why') || ''
        }))
        while (out.hookVariants.length < 4) {
          const existing = out.hookVariants[0]
          const missingLevel = levels.find((l: string) => !out.hookVariants.some((v: any) => v.level === l)) || levels[out.hookVariants.length]
          out.hookVariants.push({ level: missingLevel, hook: existing?.hook || '', rationale: existing?.rationale || '' })
        }
      }

      // ── 4. segmentDistribution — garantir que é object ──
      if (out.segmentDistribution) {
        if (Array.isArray(out.segmentDistribution)) {
          // Converter array para objeto com distribuição padrão
          out.segmentDistribution = { hook: 1, context: 1, rising: 2, climax: 1, resolution: 1, cta: 1 }
        } else if (typeof out.segmentDistribution !== 'object') {
          out.segmentDistribution = { hook: 1, context: 1, rising: 2, climax: 1, resolution: 1, cta: 1 }
        } else {
          // Garantir que todas as keys numéricas existem
          const sd = out.segmentDistribution
          out.segmentDistribution = {
            hook: sd.hook ?? sd.Hook ?? 1,
            context: sd.context ?? sd.Context ?? sd.setup ?? sd.Setup ?? 1,
            rising: sd.rising ?? sd.Rising ?? sd.risingAction ?? 2,
            climax: sd.climax ?? sd.Climax ?? 1,
            resolution: sd.resolution ?? sd.Resolution ?? 1,
            cta: sd.cta ?? sd.CTA ?? sd.Cta ?? 1
          }
        }
      }

      // ── 5. Defaults obrigatórios para TODO campo que o schema requer ──
      if (!out.hookStrategy) out.hookStrategy = 'Abordagem narrativa'
      if (!out.promiseSetup || typeof out.promiseSetup !== 'string') out.promiseSetup = out.title || out.angle || 'Setup contextual'
      if (!Array.isArray(out.risingBeats) || out.risingBeats.length === 0) {
        out.risingBeats = [
          { order: 1, revelation: 'Revelação inicial', questionAnswered: '', newQuestion: '', sourceReference: '' },
          { order: 2, revelation: 'Desenvolvimento', questionAnswered: '', newQuestion: '', sourceReference: '' }
        ]
      }
      if (!out.climaxMoment) out.climaxMoment = out.title || 'Revelação central'
      if (!out.climaxFormula) out.climaxFormula = 'Pattern Recognition'
      if (!out.emotionalArc) out.emotionalArc = 'Curiosidade → Tensão → Revelação'
      if (!out.toneProgression) out.toneProgression = 'Factual → Tenso → Revelador'
      if (!out.ctaApproach) out.ctaApproach = 'Convite para seguir o canal The Gap Files'

      // resolutionPoints: garantir array com min 2
      out.resolutionPoints = asArray(out.resolutionPoints)
      if (out.resolutionPoints.length === 0) out.resolutionPoints = ['Ponto de resolução 1', 'Ponto de resolução 2']
      while (out.resolutionPoints.length < 2) out.resolutionPoints.push(out.resolutionAngle || 'Ponto adicional')

      if (!out.resolutionAngle) out.resolutionAngle = 'Implicação para reflexão'

      // whatToReveal, whatToHold, whatToIgnore
      out.whatToReveal = asArray(out.whatToReveal)
      if (out.whatToReveal.length === 0) out.whatToReveal = ['Fato principal do dossiê']
      out.whatToHold = asArray(out.whatToHold)
      out.whatToIgnore = asArray(out.whatToIgnore)

      // segmentDistribution
      if (!out.segmentDistribution || typeof out.segmentDistribution !== 'object' || Array.isArray(out.segmentDistribution)) {
        out.segmentDistribution = { hook: 1, context: 1, rising: 2, climax: 1, resolution: 1, cta: 1 }
      }

      // tensionCurve
      if (!Array.isArray(out.tensionCurve) || out.tensionCurve.length === 0) {
        const len = Math.max(Array.isArray(out.risingBeats) ? out.risingBeats.length : 3, 3)
        const curve: string[] = []
        for (let i = 0; i < len; i++) {
          if (i < len * 0.3) curve.push('low')
          else if (i < len * 0.6) curve.push('medium')
          else if (i < len * 0.8) curve.push('high')
          else curve.push('peak')
        }
        const peakIdx = curve.lastIndexOf('peak')
        if (peakIdx > 0 && curve[peakIdx - 1] !== 'pause') curve.splice(peakIdx, 0, 'pause')
        out.tensionCurve = curve
      }

      // openLoops — normalizar itens (podem vir como strings ou objetos incompletos)
      if (Array.isArray(out.openLoops) && out.openLoops.length > 0) {
        out.openLoops = out.openLoops.map((item: any, i: number) => {
          if (typeof item === 'string') {
            return { question: item, openedAtBeat: i + 1, closedAtBeat: null }
          }
          if (item && typeof item === 'object') {
            return {
              question: item.question || item.loop || item.text || item.q || asString(item),
              openedAtBeat: typeof item.openedAtBeat === 'number' ? item.openedAtBeat : (item.opened ?? item.beat ?? i + 1),
              closedAtBeat: item.closedAtBeat !== undefined ? item.closedAtBeat : (item.closed ?? null)
            }
          }
          return { question: String(item), openedAtBeat: i + 1, closedAtBeat: null }
        })
      } else {
        out.openLoops = [{ question: 'Loop narrativo principal', openedAtBeat: 1, closedAtBeat: null }]
      }

      // resolutionLevel
      if (!['none', 'partial', 'full'].includes(out.resolutionLevel)) {
        out.resolutionLevel = 'partial'
      }

      // ── 6. Remover extras que o schema não espera ──
      const schemaKeys = new Set([
        'hookStrategy', 'hookVariants', 'promiseSetup', 'risingBeats',
        'climaxMoment', 'climaxFormula', 'resolutionPoints', 'resolutionAngle',
        'ctaApproach', 'emotionalArc', 'toneProgression',
        'whatToReveal', 'whatToHold', 'whatToIgnore',
        'segmentDistribution', 'tensionCurve', 'openLoops', 'resolutionLevel'
      ])
      for (const key of Object.keys(out)) {
        if (!schemaKeys.has(key)) delete out[key]
      }

      console.log('[ReplicateChatLLM] 🔧 Normalized keys:', Object.keys(out).join(', '))
      return out
    }

    /**
     * Desembrulha wrappers de nível único recursivamente.
     */
    function recursiveUnwrap(obj: any): { unwrapped: any; depth: number } {
      let unwrapped = obj
      let depth = 0
      while (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)) {
        const keys = Object.keys(unwrapped)
        const firstKey = keys[0]
        if (keys.length === 1 && firstKey && typeof unwrapped[firstKey] === 'object' && !Array.isArray(unwrapped[firstKey])) {
          console.log(`[ReplicateChatLLM] 🔓 Unwrapping level ${depth + 1}: key="${firstKey}"`)
          unwrapped = unwrapped[firstKey]
          depth++
          if (depth > 5) break
        } else {
          break
        }
      }
      return { unwrapped, depth }
    }

    function tryParse(jsonStr: string) {
      const raw = JSON.parse(jsonStr)
      console.log('[ReplicateChatLLM] 🔍 tryParse — raw keys:', raw && typeof raw === 'object' ? Object.keys(raw).join(', ') : 'N/A')

      // 1. Tentar direto
      try { return schema.parse(raw) } catch { /* continue */ }

      // 2. Tentar com unwrap
      const { unwrapped, depth } = recursiveUnwrap(raw)
      if (depth > 0) {
        try { return schema.parse(unwrapped) } catch { /* continue */ }
      }

      // 3. Normalizar campos e tentar
      const target = depth > 0 ? unwrapped : raw
      const normalized = normalizeForSchema(target)
      try {
        const result = schema.parse(normalized)
        console.log('[ReplicateChatLLM] ✅ Parse bem-sucedido após normalização')
        return result
      } catch { /* continue to coercion */ }

      // 4. COERÇÃO GENÉRICA: forçar cada campo ao tipo esperado pelo schema
      const coerced = coerceToSchema(normalized, schema)
      try {
        const result = schema.parse(coerced)
        console.log('[ReplicateChatLLM] ✅ Parse bem-sucedido após coerção de tipos')
        return result
      } catch (eFinal: any) {
        const errCount = eFinal?.issues?.length || eFinal?.errors?.length || 'unknown'
        const errSample = (eFinal?.issues || eFinal?.errors || []).slice(0, 5)
        console.log('[ReplicateChatLLM] ❌ Coerced parse FAILED. Errors:', errCount, JSON.stringify(errSample))
        // Log do objeto para debug
        console.log('[ReplicateChatLLM] 🔍 Coerced object sample:', JSON.stringify(coerced).slice(0, 500))
        throw eFinal
      }
    }

    return {
      async invoke(messages: any[]) {
        const raw = await self.invoke(messages)

        const text = typeof raw === 'string' ? raw : String((raw as any)?.content ?? raw ?? '')
        console.log('[ReplicateChatLLM] 🔍 invoke — text length:', text.length, '| preview:', text.slice(0, 200))
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        let parsed: any
        try {
          parsed = tryParse(cleaned)
        } catch (e1: any) {
          const sanitized = cleaned
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
            .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
          try {
            parsed = tryParse(sanitized)
          } catch {
            const m = sanitized.match(/\{[\s\S]*\}/)
            if (m) parsed = tryParse(m[0])
            else throw e1
          }
        }
        return { parsed, raw }
      }
    }
  }
}
