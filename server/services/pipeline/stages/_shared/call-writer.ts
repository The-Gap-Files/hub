/**
 * Call Writer — Etapa 1 do pipeline "Escritor → Roteirista"
 * ─────────────────────────────────────────────────────────────────────
 * Chama o LLM em modo texto livre (sem structured output) para gerar
 * prosa narrativa que será consumida pelo Roteirista na etapa 2.
 *
 * Usa o mesmo LLM assignment de 'script' (mesma configuração da UI).
 * Futuramente, pode ter assignment próprio ('writer') para otimizar custo.
 */

import { SystemMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages'
import { createLlmForTask, getAssignment } from '../../../llm/llm-factory'
import { costLogService } from '../../../cost-log.service'
import { calculateLLMCost } from '../../../../constants/pricing'
import { logLlmResponse, logLlmError } from '../../../../utils/llm-debug-logger'
import { buildWriterSystemPrompt, buildWriterUserPrompt } from '../../../providers/script/writer-prompts'
import { processImagesForLangChain } from '../../../providers/script/shared-script-prompts'
import type { ScriptGenerationRequest } from '../../../../types/ai-providers'

const LOG = '[Writer]'

export interface WriterResult {
  prose: string
  provider: string
  model: string
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
}

/**
 * Executa a etapa Writer: gera prosa narrativa a partir do dossiê/outline.
 *
 * @param promptContext - O mesmo ScriptGenerationRequest que iria para o Roteirista
 * @param outputId - ID do output (para cost logging)
 * @returns Prosa narrativa em blocos Markdown
 */
export async function callWriter(
  promptContext: ScriptGenerationRequest,
  outputId: string
): Promise<WriterResult> {
  const assignment = await getAssignment('script')

  console.log(`${LOG} 📝 Iniciando Writer (${assignment.provider}/${assignment.model})...`)

  // Create LLM (text mode — no structured output)
  const model = await createLlmForTask('script', {
    maxTokens: 64000, // Max safe across all providers (Anthropic cap = 64K; Gemini/Groq = 65536)
    temperature: assignment.temperature ?? 0.5
  })

  // Build prompts
  const systemPrompt = buildWriterSystemPrompt(promptContext)
  const userPrompt = buildWriterUserPrompt(promptContext)

  // Prepare messages (with optional multimodal images)
  const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]

  const humanContent: any[] = [{ type: 'text', text: userPrompt }]

  // Inject images if available (Writer receives dossier images for narrative context)
  const imageParts = processImagesForLangChain(promptContext.images, LOG)
  if (imageParts.length > 0) {
    humanContent.push(...imageParts)
    console.log(`${LOG} 👁️ ${imageParts.length} imagem(ns) injetada(s) no contexto do Writer`)
  }

  messages.push(new HumanMessage({ content: humanContent }))

  const startTime = Date.now()

  try {
    const response = await model.invoke(messages)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    // Extract text content
    const prose = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join('')
        : String(response.content)

    // Extract token usage from response metadata
    const usage = extractUsage(response)

    console.log(`${LOG} ✅ Writer concluído em ${elapsed}s`)
    console.log(`${LOG} 📊 Prosa: ${prose.length} chars, ~${prose.split(/\s+/).length} palavras`)
    console.log(`${LOG} 📊 Tokens: ${usage.inputTokens} input + ${usage.outputTokens} output = ${usage.totalTokens} total`)

    // Count blocks (## headers)
    const blockCount = (prose.match(/^##\s/gm) || []).length
    console.log(`${LOG} 📊 Blocos narrativos: ${blockCount}`)

    // Log response for debugging
    logLlmResponse('writer', {
      provider: assignment.provider,
      model: assignment.model,
      requestMessages: messages,
      parsed: { prose },
      raw: response
    }).catch(() => { })

    // Log cost
    const cost = calculateLLMCost(assignment.model, usage.inputTokens, usage.outputTokens)
    costLogService.log({
      outputId,
      resource: 'script',
      action: 'create',
      provider: assignment.provider.toUpperCase(),
      model: assignment.model,
      cost,
      metadata: {
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens,
        stage: 'writer',
        prose_chars: prose.length,
        block_count: blockCount
      },
      detail: `Writer prose — ${prose.length} chars, ${blockCount} blocks`
    }).catch(() => { })

    return {
      prose,
      provider: assignment.provider,
      model: assignment.model,
      usage
    }
  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`${LOG} ❌ Erro no Writer após ${elapsed}s:`, error?.message || error)

    // Log error for debugging
    logLlmError('writer', {
      provider: assignment.provider,
      model: assignment.model,
      requestMessages: messages,
      error
    }).catch(() => { })

    throw error
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function extractUsage(response: any): { inputTokens: number; outputTokens: number; totalTokens: number } {
  // LangChain stores usage in different places depending on provider
  const meta = response?.response_metadata || {}
  const usageMeta = response?.usage_metadata || {}

  // Gemini format
  if (meta.promptTokenCount || meta.candidatesTokenCount) {
    return {
      inputTokens: meta.promptTokenCount || 0,
      outputTokens: meta.candidatesTokenCount || 0,
      totalTokens: meta.totalTokenCount || 0
    }
  }

  // OpenAI/Anthropic format
  if (meta.usage || usageMeta) {
    const u = meta.usage || usageMeta
    return {
      inputTokens: u.input_tokens || u.prompt_tokens || 0,
      outputTokens: u.output_tokens || u.completion_tokens || 0,
      totalTokens: u.total_tokens || (u.input_tokens || 0) + (u.output_tokens || 0)
    }
  }

  // LangChain usage_metadata (newer versions)
  if (usageMeta.input_tokens || usageMeta.output_tokens) {
    return {
      inputTokens: usageMeta.input_tokens || 0,
      outputTokens: usageMeta.output_tokens || 0,
      totalTokens: usageMeta.total_tokens || 0
    }
  }

  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
}
