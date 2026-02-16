/**
 * LLM Debug Logger — Salva respostas e erros de LLM em arquivo para inspeção.
 *
 * Grava em .llm-logs/ na raiz do projeto, com rotação automática (mantém últimos 50 logs).
 * Formato: {taskId}_{timestamp}_{status}.json
 */
import { writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const LOG_DIR = join(process.cwd(), '.llm-logs')
const MAX_LOG_FILES = 50

async function ensureLogDir(): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true })
}

async function rotateLogFiles(): Promise<void> {
  try {
    const files = await readdir(LOG_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort()
    if (jsonFiles.length > MAX_LOG_FILES) {
      const toDelete = jsonFiles.slice(0, jsonFiles.length - MAX_LOG_FILES)
      await Promise.all(toDelete.map(f => unlink(join(LOG_DIR, f)).catch(() => { })))
    }
  } catch {
    // Ignora se não conseguir rotacionar
  }
}

function buildFilename(taskId: string, status: 'ok' | 'error' | 'partial'): string {
  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${ts}_${taskId}_${status}.json`
}

/**
 * Loga uma resposta de LLM bem-sucedida em arquivo.
 */
export async function logLlmResponse(taskId: string, data: {
  provider: string
  model: string
  requestMessages?: any[]
  parsed?: any
  raw?: any
  usage?: any
}): Promise<void> {
  try {
    await ensureLogDir()
    const payload = {
      timestamp: new Date().toISOString(),
      taskId,
      status: 'ok',
      provider: data.provider,
      model: data.model,
      usage: data.usage,
      request: data.requestMessages ? { messages: sanitizeMessagesForLog(data.requestMessages) } : undefined,
      parsed: sanitizeBinaryData(data.parsed),
      rawContent: extractContent(data.raw)
    }
    const filename = buildFilename(taskId, 'ok')
    await writeFile(join(LOG_DIR, filename), JSON.stringify(payload, null, 2), 'utf-8')
    await rotateLogFiles()
  } catch {
    // Logger nunca deve quebrar o fluxo principal
  }
}

/**
 * Loga um erro de LLM em arquivo — inclui toda a estrutura do erro para debug.
 */
export async function logLlmError(taskId: string, data: {
  provider: string
  model: string
  error: any
  failedGeneration?: any
  requestMessages?: any[]
}): Promise<void> {
  try {
    await ensureLogDir()
    const err = data.error
    const errorBody = err?.error?.error || err?.error || {}
    const payload = {
      timestamp: new Date().toISOString(),
      taskId,
      status: data.failedGeneration ? 'partial' : 'error',
      provider: data.provider,
      model: data.model,
      request: data.requestMessages ? { messages: sanitizeMessagesForLog(data.requestMessages) } : undefined,
      errorMessage: err?.message?.substring(0, 500),
      errorCode: errorBody?.code,
      errorType: errorBody?.type,
      validationError: errorBody?.message,
      failedGeneration: sanitizeBinaryData(data.failedGeneration || errorBody?.failed_generation),
      errorStructure: {
        hasError: !!err?.error,
        hasErrorError: !!err?.error?.error,
        hasResponseBody: !!err?.response?.body,
        errorKeys: err?.error ? Object.keys(err.error) : [],
        errorErrorKeys: err?.error?.error ? Object.keys(err.error.error) : []
      }
    }
    const status = data.failedGeneration ? 'partial' : 'error'
    const filename = buildFilename(taskId, status)
    await writeFile(join(LOG_DIR, filename), JSON.stringify(payload, null, 2), 'utf-8')
    await rotateLogFiles()
  } catch {
    // Logger nunca deve quebrar o fluxo principal
  }
}

/**
 * Extrai conteúdo de texto/structured de um raw message da LangChain.
 */
function extractContent(raw: any): string | undefined {
  if (!raw) return undefined
  try {
    const content = raw?.lc_kwargs?.content || raw?.content
    if (typeof content === 'string') return content.substring(0, 5000)
    if (Array.isArray(content)) {
      return content
        .filter((p: any) => p?.type === 'text')
        .map((p: any) => p?.text)
        .join('\n')
        .substring(0, 5000)
    }
    return typeof content === 'object' ? JSON.stringify(content).substring(0, 5000) : undefined
  } catch {
    return undefined
  }
}

function sanitizeMessagesForLog(messages: any[], maxMessages = 16): any[] {
  const sliced = Array.isArray(messages) ? messages.slice(0, maxMessages) : []
  return sliced.map((m: any, idx: number) => sanitizeSingleMessageForLog(m, idx))
}

function sanitizeSingleMessageForLog(message: any, idx: number): any {
  try {
    const type = typeof message?._getType === 'function'
      ? message._getType()
      : (message?.constructor?.name || message?.type || 'message')

    const content = message?.lc_kwargs?.content ?? message?.content ?? message?.text
    return {
      index: idx,
      type,
      content: sanitizeMessageContentForLog(content)
    }
  } catch (e: any) {
    return { index: idx, type: 'message', content: `[unserializable message: ${e?.message || e}]` }
  }
}

function sanitizeMessageContentForLog(content: any): any {
  // Conteúdo texto simples
  if (typeof content === 'string') {
    const maxLen = 8000
    return content.length > maxLen
      ? content.substring(0, maxLen) + `... [truncated ${content.length - maxLen} chars]`
      : content
  }

  // Conteúdo multimodal (ex: Gemini / LangChain parts)
  if (Array.isArray(content)) {
    return content.map((part: any) => {
      if (!part || typeof part !== 'object') return part
      if (part.type === 'text') {
        return {
          type: 'text',
          text: sanitizeMessageContentForLog(part.text ?? '')
        }
      }
      if (part.type === 'image_url') {
        const url = part?.image_url?.url
        const isDataUrl = typeof url === 'string' && url.startsWith('data:')
        return {
          type: 'image_url',
          image_url: {
            url: isDataUrl ? '[data_url omitted]' : '[url omitted]',
            detail: part?.image_url?.detail
          }
        }
      }
      return { type: part.type || 'unknown' }
    })
  }

  // Objetos arbitrários — sanitizar para evitar base64/buffers
  return sanitizeBinaryData(content, 800)
}

/**
 * Sanitiza dados binários (base64, Buffers) para evitar poluição do terminal.
 * Trunca strings longas e substitui dados binários por placeholders.
 */
function sanitizeBinaryData(obj: any, maxStringLength = 500): any {
  if (obj === null || obj === undefined) return obj

  // Detectar e truncar Buffers
  if (Buffer.isBuffer(obj)) {
    return `[Buffer ${obj.length} bytes]`
  }

  // Detectar objetos que parecem Buffers serializados
  if (typeof obj === 'object' && obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return `[Buffer ${obj.data.length} bytes]`
  }

  // Truncar strings muito longas (possível base64)
  if (typeof obj === 'string') {
    if (obj.length > maxStringLength) {
      // Detectar base64
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(obj.slice(0, 100))
      if (isBase64) {
        return `[Base64 data ${obj.length} chars - truncated]`
      }
      return obj.substring(0, maxStringLength) + `... [truncated ${obj.length - maxStringLength} chars]`
    }
    return obj
  }

  // Recursivamente sanitizar arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeBinaryData(item, maxStringLength))
  }

  // Recursivamente sanitizar objetos
  if (typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      // Pular campos conhecidos que podem conter dados binários
      if (key === 'data' && Buffer.isBuffer(value)) {
        sanitized[key] = `[Buffer ${(value as Buffer).length} bytes]`
        continue
      }
      sanitized[key] = sanitizeBinaryData(value, maxStringLength)
    }
    return sanitized
  }

  return obj
}
