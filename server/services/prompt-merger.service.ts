/**
 * Intelligent Prompt Merger Service
 * 
 * Usa a LLM Factory (Núcleo de IA) para fazer merge inteligente de prompts visuais,
 * removendo redundâncias e criando prompts mais naturais.
 * 
 * O provider/modelo são controlados pela task "merge" na UI (Settings → Núcleo de IA).
 * 
 * Fallback: Se a LLM falhar, usa concatenação manual.
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import type { LlmTaskId } from '../constants/providers/llm-registry'

const TASK_ID: LlmTaskId = 'merge'

// Semáforo para limitar chamadas concorrentes (evita 429 rate limit)
const MAX_CONCURRENT = 5
let activeCalls = 0
const waitQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeCalls < MAX_CONCURRENT) {
    activeCalls++
    return Promise.resolve()
  }
  return new Promise<void>(resolve => waitQueue.push(resolve))
}

function releaseSlot(): void {
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!
    next()
  } else {
    activeCalls--
  }
}

export interface PromptMergeRequest {
  sceneDescription: string
  visualStyle: {
    baseStyle?: string
    lightingTags?: string
    atmosphereTags?: string
    compositionTags?: string
    colorPalette?: string
    qualityTags?: string
    tags?: string
  }
}

export interface PromptMergeResult {
  mergedPrompt: string
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  model?: string
}

export class PromptMergerService {
  /**
   * Faz merge inteligente do prompt da cena com as tags do estilo visual.
   * Retorna mergedPrompt + usage/model quando a LLM é usada (para CostLog).
   */
  async mergePrompt(request: PromptMergeRequest): Promise<PromptMergeResult> {
    await acquireSlot()
    try {
      return await this.llmMerge(request)
    } catch (error) {
      console.warn('[PromptMerger] LLM merge failed, using manual fallback:', error)
      return { mergedPrompt: this.manualMerge(request) }
    } finally {
      releaseSlot()
    }
  }

  /**
   * Merge usando LLM via Factory (inteligente, remove redundâncias)
   */
  private async llmMerge(request: PromptMergeRequest): Promise<PromptMergeResult> {
    const { sceneDescription, visualStyle } = request


    // Coletar elementos do estilo
    const styleElements = [
      visualStyle.baseStyle,
      visualStyle.lightingTags,
      visualStyle.atmosphereTags,
      visualStyle.compositionTags,
      visualStyle.tags
    ].filter(Boolean).join(', ')

    const systemPrompt = `You are an expert at creating optimized image generation prompts.

Your task is to merge a scene description with visual style elements into a single, concise prompt.

RULES:
1. Remove redundancies (if scene has "rainy", don't add "rain" again)
2. Keep it under 150 words
3. Use natural, flowing language (not comma-separated tags)
4. Prioritize the scene description, then add unique style elements
5. Preserve all unique visual elements from both inputs

Return ONLY the merged prompt, nothing else. No explanations, no quotes.`

    const userPrompt = `SCENE: ${sceneDescription}

STYLE ELEMENTS: ${styleElements}

Merge these into a single optimized prompt:`

    const llm = await createLlmForTask(TASK_ID, { temperature: 0.3, maxTokens: 200 })

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ])

    const mergedPrompt = typeof response.content === 'string'
      ? response.content.trim()
      : String(response.content ?? '').trim()

    if (!mergedPrompt) {
      throw new Error('LLM returned empty response')
    }

    // Extrair usage (compatível com qualquer provider LangChain)
    const usageMeta = response.usage_metadata
    const usage = usageMeta
      ? {
        inputTokens: usageMeta.input_tokens ?? 0,
        outputTokens: usageMeta.output_tokens ?? 0,
        totalTokens: (usageMeta.input_tokens ?? 0) + (usageMeta.output_tokens ?? 0)
      }
      : undefined

    const assignment = await getAssignment(TASK_ID)
    const modelUsed = `${assignment.provider}/${assignment.model}`

    console.log(`[PromptMerger] ✅ Merge successful (${modelUsed})`)
    return { mergedPrompt, usage, model: assignment.model }
  }

  /**
   * Merge manual (fallback, concatenação simples)
   */
  private manualMerge(request: PromptMergeRequest): string {
    const { sceneDescription, visualStyle } = request

    const tags = [
      visualStyle.lightingTags,
      visualStyle.atmosphereTags,
      visualStyle.compositionTags,
      visualStyle.colorPalette,
      visualStyle.qualityTags,
      visualStyle.tags
    ].filter(t => t && t.trim().length > 0).join(', ')

    const parts = []
    if (visualStyle.baseStyle) parts.push(visualStyle.baseStyle)
    parts.push(sceneDescription)
    if (tags) parts.push(tags)

    console.log('[PromptMerger] ⚠️ Using manual fallback')
    return parts.join(', ')
  }
}

export const promptMergerService = new PromptMergerService()
