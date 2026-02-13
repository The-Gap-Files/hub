/**
 * GET /api/ai-logs/stream
 *
 * Endpoint SSE (Server-Sent Events) para streaming do terminal em real-time.
 * Intercepta stdout/stderr do processo Node e transmite para o frontend.
 * O lightbox mostra EXATAMENTE o que aparece no terminal.
 */

import { consoleInterceptor, type AiLogEntry } from '../../utils/ai-logger'

export default defineEventHandler(async (event) => {
  // Instalar interceptor na primeira conexão
  consoleInterceptor.install()

  // SSE Headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Handler para cada log
      const onLog = (entry: AiLogEntry) => {
        try {
          const data = JSON.stringify(entry)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // Stream fechada
        }
      }

      // Heartbeat a cada 30s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)

      // Registrar listener
      consoleInterceptor.on('log', onLog)

      // Mensagem de boas-vindas
      const welcome: AiLogEntry = {
        id: 'welcome',
        timestamp: new Date().toISOString(),
        level: 'stdout',
        message: '🔌 Terminal Stream conectado — monitorando todas as operações de IA...'
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(welcome)}\n\n`))

      // Cleanup quando cliente desconecta
      event.node.req.on('close', () => {
        consoleInterceptor.off('log', onLog)
        clearInterval(heartbeat)
        try { controller.close() } catch { /* already closed */ }
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
})
