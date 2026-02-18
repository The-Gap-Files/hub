/**
 * Groq Error Handler — Tratamento centralizado de json_validate_failed
 * 
 * Quando o Groq jsonSchema strict rejeita JSON válido (campos nullable não preenchidos
 * ou modelo retorna schema ao invés de dados), extrai failed_generation e usa como fallback.
 */
import { logLlmError } from './llm-debug-logger'

export interface GroqFailedGenerationResult<T> {
  success: true
  data: T
  isPartial: boolean
}

export interface GroqErrorResult {
  success: false
  shouldRethrow: true
}

export type GroqErrorHandlerResult<T> = GroqFailedGenerationResult<T> | GroqErrorResult

function stripCodeFences(input: string): string {
  return input
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

/**
 * Se o JSON foi truncado no meio de uma string, tenta "fechar" a string
 * removendo escapes pendentes e adicionando uma aspas final.
 *
 * Observação: isso é um fallback heurístico — só usar quando JSON.parse falhar.
 */
function closeTruncatedStringIfNeeded(out: string[], inString: boolean, escaped: boolean): void {
  if (!inString) return

  // Se terminou com um escape pendente, remover a barra para não invalidar JSON.
  if (escaped && out.length > 0 && out[out.length - 1] === '\\') {
    out.pop()
  }

  // Se terminou no meio de um unicode escape \uXXXX, remover o escape incompleto.
  // Ex.: "... \u12" → remove "\u12"
  const tail = out.slice(Math.max(0, out.length - 6)).join('')
  const m = tail.match(/\\u[0-9a-fA-F]{0,3}$/)
  if (m && m[0]) {
    for (let i = 0; i < m[0].length; i++) out.pop()
  }

  out.push('"')
}

/**
 * Tenta reparar JSON "quase válido" (ex: chaves/colchetes sobrando entre itens),
 * e extrai o primeiro JSON balanceado possível.
 *
 * Estratégia:
 * - ignora closers "sobrando" que não batem com a stack
 * - interrompe ao fechar o primeiro root (stack volta a 0)
 * - fecha o que faltou ao final (quando há truncamento)
 *
 * Importante: só usar como fallback quando JSON.parse falhar.
 */
function repairAndExtractBalancedJson(input: string): string {
  const cleaned = stripCodeFences(input)
  const startIdx = cleaned.search(/[\{\[]/)
  if (startIdx < 0) return cleaned.trim()

  const out: string[] = []
  const stack: Array<'{' | '['> = []
  let inString = false
  let escaped = false

  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i]!

    if (inString) {
      out.push(ch)
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    // fora de string
    if (ch === '"') {
      inString = true
      out.push(ch)
      continue
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch)
      out.push(ch)
      continue
    }

    if (ch === '}' || ch === ']') {
      const top = stack[stack.length - 1]
      const matches = (ch === '}' && top === '{') || (ch === ']' && top === '[')
      if (matches) {
        stack.pop()
        out.push(ch)

        // Root fechado — ignorar qualquer trailing junk
        if (stack.length === 0) {
          break
        }
      } else {
        // closer sobrando (ex: "}},{") — ignorar
      }
      continue
    }

    out.push(ch)
  }

  // Se truncou no meio de uma string, fechar aspas (heurística)
  closeTruncatedStringIfNeeded(out, inString, escaped)

  // Se truncou (faltaram closers), fechar o que ficou pendente
  for (let i = stack.length - 1; i >= 0; i--) {
    out.push(stack[i] === '{' ? '}' : ']')
  }

  return out.join('').trim()
}

/**
 * Extrai TODOS os roots JSON balanceados de uma string.
 * Útil quando o modelo retorna objetos concatenados (ex: JSON Schema + dados).
 */
function extractBalancedJsonRoots(input: string): string[] {
  const cleaned = stripCodeFences(input)
  const roots: string[] = []

  let idx = 0
  while (idx < cleaned.length) {
    const startIdx = cleaned.slice(idx).search(/[\{\[]/)
    if (startIdx < 0) break

    const absoluteStart = idx + startIdx
    const out: string[] = []
    const stack: Array<'{' | '['> = []
    let inString = false
    let escaped = false
    let endAt = -1

    for (let i = absoluteStart; i < cleaned.length; i++) {
      const ch = cleaned[i]!

      if (inString) {
        out.push(ch)
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') inString = false
        continue
      }

      if (ch === '"') {
        inString = true
        out.push(ch)
        continue
      }

      if (ch === '{' || ch === '[') {
        stack.push(ch)
        out.push(ch)
        continue
      }

      if (ch === '}' || ch === ']') {
        const top = stack[stack.length - 1]
        const matches = (ch === '}' && top === '{') || (ch === ']' && top === '[')
        if (matches) {
          stack.pop()
          out.push(ch)
          if (stack.length === 0) {
            endAt = i
            break
          }
        }
        continue
      }

      out.push(ch)
    }

    if (out.length > 0 && endAt >= absoluteStart) {
      roots.push(out.join('').trim())
      idx = endAt + 1
    } else {
      // Evitar loop infinito em entrada malformada
      idx = absoluteStart + 1
    }
  }

  return roots
}

/**
 * Extrai objetos JSON balanceados que aparecem dentro de um array de um campo específico,
 * mesmo quando o root JSON está truncado.
 *
 * Ex.: {"teasers":[{...},{...}, ...TRUNCADO
 * → retorna itens completos já fechados dentro do array.
 */
function extractBalancedObjectsFromNamedArray(input: string, arrayFieldName: string): string[] {
  const cleaned = stripCodeFences(input)
  const fieldIdx = cleaned.indexOf(`"${arrayFieldName}"`)
  if (fieldIdx < 0) return []

  const arrayStart = cleaned.indexOf('[', fieldIdx)
  if (arrayStart < 0) return []

  const items: string[] = []
  let idx = arrayStart + 1

  while (idx < cleaned.length) {
    const nextObj = cleaned.indexOf('{', idx)
    if (nextObj < 0) break

    const out: string[] = []
    const stack: Array<'{' | '['> = []
    let inString = false
    let escaped = false
    let endAt = -1

    for (let i = nextObj; i < cleaned.length; i++) {
      const ch = cleaned[i]!
      if (inString) {
        out.push(ch)
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') inString = false
        continue
      }

      if (ch === '"') {
        inString = true
        out.push(ch)
        continue
      }

      if (ch === '{' || ch === '[') {
        stack.push(ch)
        out.push(ch)
        continue
      }

      if (ch === '}' || ch === ']') {
        const top = stack[stack.length - 1]
        const matches = (ch === '}' && top === '{') || (ch === ']' && top === '[')
        if (matches) {
          stack.pop()
          out.push(ch)
          if (stack.length === 0) {
            endAt = i
            break
          }
        }
        continue
      }

      out.push(ch)
    }

    // Item completo
    if (out.length > 0 && endAt >= nextObj) {
      items.push(out.join('').trim())
      idx = endAt + 1
      continue
    }

    // Se não fechou (truncou), não dá pra extrair mais itens seguintes com segurança.
    break
  }

  return items
}

/**
 * Trata erros json_validate_failed do Groq extraindo failed_generation.
 * 
 * @param error - O erro capturado do catch
 * @param logPrefix - Prefixo para logs (ex: '[StoryArchitect]')
 * @param taskId - ID da task (opcional, para logging em arquivo)
 * @param validateData - Função opcional para validar se failed_generation contém dados válidos
 * @returns Resultado com dados parciais ou indicação para re-throw
 */
export function handleGroqJsonValidateError<T>(
  error: any,
  logPrefix: string,
  taskIdOrValidator?: string | ((data: any) => boolean),
  validateData?: (data: any) => boolean,
  requestMessages?: any[]
): GroqErrorHandlerResult<T> {
  // Suporte a assinatura antiga: (error, logPrefix, validateData?)
  let taskId = 'unknown'
  let validator = validateData
  if (typeof taskIdOrValidator === 'function') {
    validator = taskIdOrValidator
    taskId = logPrefix.replace(/[\[\]]/g, '').trim().toLowerCase().replace(/\s+/g, '-')
  } else if (typeof taskIdOrValidator === 'string') {
    taskId = taskIdOrValidator
  } else {
    taskId = logPrefix.replace(/[\[\]]/g, '').trim().toLowerCase().replace(/\s+/g, '-')
  }

  // Estrutura do erro Groq SDK:
  // APIError → this.error = errJSON (o body inteiro parseado)
  // Body da API: { "error": { "message": "...", "code": "...", "failed_generation": "..." } }
  // Portanto: error.error = { error: { ... } }  →  error.error.error = { code, failed_generation }
  const errorBody = error?.error?.error || error?.error || error?.response?.body?.error || {}
  const errorMessage = typeof error?.message === 'string' ? error.message : ''

  // Verificar se é json_validate_failed
  if (errorBody?.code !== 'json_validate_failed' && !errorMessage.includes('json_validate_failed')) {
    return { success: false, shouldRethrow: true }
  }

  // Extrair failed_generation de múltiplos caminhos possíveis
  const failedGen = errorBody?.failed_generation
    || error?.response?.body?.failed_generation
    || error?.failed_generation

  if (!failedGen) {
    console.warn(`${logPrefix} ⚠️ json_validate_failed mas sem failed_generation`)
    // Logar erro completo em arquivo para debug
    logLlmError(taskId, { provider: 'groq', model: 'unknown', error, requestMessages }).catch(() => { })
    return { success: false, shouldRethrow: true }
  }

  try {
    let partial: any
    if (typeof failedGen === 'string') {
      const cleaned = stripCodeFences(failedGen)
      try {
        partial = JSON.parse(cleaned)
      } catch {
        // 1) Tenta extrair roots concatenados (schema + dados, por exemplo)
        const roots = extractBalancedJsonRoots(cleaned)
        const parsedRoots: any[] = []
        for (const root of roots) {
          try {
            parsedRoots.push(JSON.parse(root))
          } catch {
            // ignora roots inválidos e segue
          }
        }

        // Prioriza um objeto de DADOS (não schema), idealmente com campo "approved"
        const preferred = parsedRoots.find(
          (r) => !(r?.$schema || (r?.properties && r?.type === 'object')) && typeof r?.approved === 'boolean'
        ) || parsedRoots.find(
          (r) => !(r?.$schema || (r?.properties && r?.type === 'object'))
        )

        if (preferred) {
          partial = preferred
        } else {
          // 2) Fallback para reparo do primeiro root balanceado
          const repaired = repairAndExtractBalancedJson(cleaned)
          try {
            partial = JSON.parse(repaired)
          } catch {
            // 3) Último recurso: extrair itens completos do array "teasers"
            const teaserItems = extractBalancedObjectsFromNamedArray(cleaned, 'teasers')
            if (teaserItems.length > 0) {
              const teasersParsed: any[] = []
              for (const item of teaserItems) {
                try {
                  teasersParsed.push(JSON.parse(item))
                } catch {
                  // ignora
                }
              }
              if (teasersParsed.length > 0) {
                partial = { teasers: teasersParsed }
              } else {
                throw new Error('failed_generation: não foi possível parsear itens de teasers')
              }
            } else {
              throw new Error('failed_generation: reparo falhou e não há itens completos em teasers')
            }
          }
        }
      }
    } else {
      partial = failedGen
    }

    // Verificar se é o schema JSON Schema ao invés de dados
    if (partial?.$schema || (partial?.properties && partial?.type === 'object')) {
      console.error(`${logPrefix} ❌ Modelo retornou JSON Schema ao invés de dados. Schema muito complexo para este modelo.`)
      logLlmError(taskId, {
        provider: 'groq', model: 'unknown', error,
        failedGeneration: partial,
        requestMessages
      }).catch(() => { })
      return { success: false, shouldRethrow: true }
    }

    // Se veio via fallback "teasers", mas trouxe itens schema, filtrar.
    if (Array.isArray(partial?.teasers)) {
      partial.teasers = partial.teasers.filter(
        (t: any) => !(t?.$schema || (t?.properties && t?.type === 'object'))
      )
    }

    // Quando o erro foi "maximum 1 items required, but found N", normalizar para 1 item (deep-dive/hook-only single slot).
    const validationMsg = (errorBody?.message || errorMessage || '') as string
    if (
      Array.isArray(partial?.teasers) &&
      partial.teasers.length > 1 &&
      /maximum\s+1\s+items?\s+required|maxItems.*1.*found\s+\d+/i.test(validationMsg)
    ) {
      partial.teasers = [partial.teasers[0]]
    }

    // Quando o erro foi "missing properties" e o modelo colocou campos na raiz em vez de dentro de teasers[0], mesclar raiz → teasers[0].
    const TEASER_ROOT_FIELDS = [
      'scriptOutline', 'visualSuggestion', 'cta', 'platform', 'format', 'estimatedViews',
      'scriptStyleId', 'scriptStyleName', 'editorialObjectiveId', 'editorialObjectiveName',
      'avoidPatterns', 'visualPrompt', 'sceneCount', 'targetEpisode', 'loopSentence'
    ]
    if (
      /missing\s+properties/i.test(validationMsg) &&
      Array.isArray(partial?.teasers) &&
      partial.teasers.length > 0
    ) {
      const root = partial as Record<string, unknown>
      const first = partial.teasers[0] as Record<string, unknown>
      let merged = false
      for (const key of TEASER_ROOT_FIELDS) {
        if (root[key] !== undefined && first[key] === undefined) {
          first[key] = root[key]
          delete root[key]
          merged = true
        }
      }
      if (merged) {
        partial.teasers[0] = first
      }
    }

    // Validação customizada (se fornecida)
    if (validator && !validator(partial)) {
      console.warn(`${logPrefix} ⚠️ failed_generation não passou na validação customizada`)
      logLlmError(taskId, {
        provider: 'groq', model: 'unknown', error,
        failedGeneration: partial,
        requestMessages
      }).catch(() => { })
      return { success: false, shouldRethrow: true }
    }

    console.warn(`${logPrefix} ⚠️ Groq json_validate_failed — usando failed_generation como resposta parcial`)

    // Logar como partial em arquivo para inspeção
    logLlmError(taskId, {
      provider: 'groq', model: 'unknown', error,
      failedGeneration: partial,
      requestMessages
    }).catch(() => { })

    return {
      success: true,
      data: partial as T,
      isPartial: true
    }
  } catch (parseErr) {
    console.error(`${logPrefix} ❌ Falha ao parsear failed_generation:`, parseErr)
    logLlmError(taskId, {
      provider: 'groq',
      model: 'unknown',
      error,
      failedGeneration: failedGen,
      requestMessages
    }).catch(() => { })
    return { success: false, shouldRethrow: true }
  }
}
