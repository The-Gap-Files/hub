/**
 * Logger padronizado para o pipeline de outputs.
 * Formato: [Stage] [outputId?] mensagem
 * Facilita rastrear todas as etapas por outputId e filtrar por stage em produção.
 */

export type PipelineStage =
  | 'Pipeline'
  | 'Script'
  | 'Outline'
  | 'Images'
  | 'Audio'
  | 'Motion'
  | 'BGM'
  | 'Render'
  | 'Captions'
  | 'AddCaptions'
  | 'API'

function prefix(stage: PipelineStage, outputId?: string | null): string {
  const id = outputId ? ` [${outputId.slice(0, 8)}]` : ''
  return `[${stage}]${id}`
}

function format(stage: PipelineStage, outputId: string | null | undefined, message: string): string {
  return `${prefix(stage, outputId)} ${message}`
}

export interface PipelineLoggerOptions {
  stage: PipelineStage
  outputId?: string | null
}

export function createPipelineLogger(options: PipelineLoggerOptions) {
  const { stage, outputId } = options

  return {
    /** Log informativo (etapa iniciada, concluída, métricas). */
    info(message: string, data?: Record<string, unknown>): void {
      const msg = data ? `${message} ${JSON.stringify(data)}` : message
      console.log(format(stage, outputId, msg))
    },

    /** Aviso (fallback, skip, configuração ausente). */
    warn(message: string, data?: Record<string, unknown>): void {
      const msg = data ? `${message} ${JSON.stringify(data)}` : message
      console.warn(format(stage, outputId, msg))
    },

    /** Erro (falha na etapa). */
    error(message: string, err?: unknown): void {
      const detail = err instanceof Error ? err.message : err != null ? String(err) : ''
      const msg = detail ? `${message}: ${detail}` : message
      console.error(format(stage, outputId, msg))
    },

    /** Sub-etapa (ex.: "Cena 3/10", "Track BGM 2"). */
    step(stepName: string, detail?: string): void {
      const msg = detail ? `${stepName} — ${detail}` : stepName
      console.log(format(stage, outputId, msg))
    }
  }
}

/** Logger rápido sem outputId (ex.: API genérica). */
export function pipelineLog(stage: PipelineStage, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const msg = format(stage, null, message)
  if (level === 'error') console.error(msg)
  else if (level === 'warn') console.warn(msg)
  else console.log(msg)
}
