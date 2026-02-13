/**
 * AI Logger — Interceptor de stdout/stderr para streaming no frontend
 *
 * Intercepta TODAS as saídas do console (stdout + stderr) e emite como
 * eventos para o SSE. O frontend recebe o mesmo output que aparece no terminal.
 *
 * Zero modificações necessárias nos serviços existentes — qualquer console.log
 * automaticamente aparece no lightbox da UI.
 */

import { EventEmitter } from 'node:events'

// =============================================================================
// TIPOS
// =============================================================================

export type AiLogLevel = 'stdout' | 'stderr'

export interface AiLogEntry {
  id: string
  timestamp: string
  level: AiLogLevel
  message: string
}

// =============================================================================
// INTERCEPTOR SINGLETON
// =============================================================================

class ConsoleInterceptor extends EventEmitter {
  private counter = 0
  private installed = false

  // Referências originais
  private originalStdoutWrite!: typeof process.stdout.write
  private originalStderrWrite!: typeof process.stderr.write

  constructor() {
    super()
    this.setMaxListeners(50) // Cada conexão SSE = 1 listener
  }

  /**
   * Instala os hooks de interceptação.
   * Chamado automaticamente na primeira conexão SSE.
   */
  install() {
    if (this.installed) return
    this.installed = true

    // Salvar referências originais
    this.originalStdoutWrite = process.stdout.write.bind(process.stdout)
    this.originalStderrWrite = process.stderr.write.bind(process.stderr)

    // Interceptar stdout
    process.stdout.write = ((chunk: any, ...args: any[]) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString()
      this.emitLines(text, 'stdout')
      return this.originalStdoutWrite(chunk, ...args)
    }) as any

    // Interceptar stderr
    process.stderr.write = ((chunk: any, ...args: any[]) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString()
      this.emitLines(text, 'stderr')
      return this.originalStderrWrite(chunk, ...args)
    }) as any
  }

  private emitLines(text: string, level: AiLogLevel) {
    // Quebrar por linhas e emitir cada uma
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    for (const line of lines) {
      // Pular linhas de heartbeat ou noise do framework
      if (this.isNoise(line)) continue

      const entry: AiLogEntry = {
        id: `${Date.now()}-${++this.counter}`,
        timestamp: new Date().toISOString(),
        level,
        message: line.trimEnd()
      }
      this.emit('log', entry)
    }
  }

  /** Filtra ruído do framework (hot reload, Vite, etc.) */
  private isNoise(line: string): boolean {
    // Manter linhas relevantes, filtrar ruído de dev server
    const noisePatterns = [
      'hmr update',
      'hmr invalidate',
      'page reload',
      'vite:',
      '[vite]',
      '[nitro]',
      'nuxt:tailwindcss',
      '✔ Types',
      '✔ Builder',
      '✔ Nitro',
      'Listening on',
      'ℹ Vite',
      'ℹ Nuxt',
    ]
    const lower = line.toLowerCase()
    return noisePatterns.some(p => lower.includes(p.toLowerCase()))
  }
}

export const consoleInterceptor = new ConsoleInterceptor()
