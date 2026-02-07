/**
 * Intelligent Prompt Merger Service
 * 
 * Usa Claude (Anthropic) para fazer merge inteligente de prompts visuais,
 * removendo redundâncias e criando prompts mais naturais.
 * 
 * Fallback: Se Claude falhar, usa concatenação manual.
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const MERGE_MODEL = process.env.ANTHROPIC_MERGE_MODEL || 'claude-3-5-haiku-20241022'

export interface PromptMergeRequest {
  sceneDescription: string
  visualStyle: {
    baseStyle?: string
    lightingTags?: string
    atmosphereTags?: string
    compositionTags?: string
    tags?: string
  }
}

export class PromptMergerService {
  /**
   * Faz merge inteligente do prompt da cena com as tags do estilo visual
   */
  async mergePrompt(request: PromptMergeRequest): Promise<string> {
    try {
      return await this.claudeMerge(request)
    } catch (error) {
      console.warn('[PromptMerger] Claude merge failed, using manual fallback:', error)
      return this.manualMerge(request)
    }
  }

  /**
   * Merge usando Claude Haiku (inteligente, remove redundâncias)
   */
  private async claudeMerge(request: PromptMergeRequest): Promise<string> {
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

    const response = await anthropic.messages.create({
      model: MERGE_MODEL,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Baixa variação para consistência
      max_tokens: 200
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const mergedPrompt = textBlock?.text?.trim()

    if (!mergedPrompt) {
      throw new Error('Claude returned empty response')
    }

    console.log(`[PromptMerger] ✅ Claude merge successful (${MERGE_MODEL})`)
    return mergedPrompt
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
