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
          partial = JSON.parse(repaired)
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
