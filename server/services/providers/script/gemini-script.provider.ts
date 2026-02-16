import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import {
  SystemMessage,
  HumanMessage,
  BaseMessage
} from '@langchain/core/messages'
import type {
  IScriptGenerator,
  ScriptGenerationRequest,
  ScriptGenerationResponse
} from '../../../types/ai-providers'
import {
  ScriptResponseSchema,
  type ScriptResponse,
  buildSystemPrompt,
  buildUserPrompt,
  parseScriptResponse,
  processImagesForLangChain,
  fallbackParseRawResponse,
  extractTokenUsage
} from './shared-script-prompts'

export class GeminiScriptProvider implements IScriptGenerator {
  private model: ChatGoogleGenerativeAI
  private modelName: string

  constructor(config: { apiKey: string; model?: string; temperature?: number }) {
    this.modelName = config.model ?? 'gemini-1.5-flash'
    this.model = new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      model: this.modelName,
      temperature: config.temperature ?? 0.5, // Do LlmAssignment (script task)
      maxRetries: 2,
      maxOutputTokens: 65536 // YouTube Cinematic pode gerar 100+ cenas; 8192 é insuficiente
    })
  }

  getName(): string {
    return 'GEMINI'
  }

  async generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    const LOG = '[Gemini Script]'
    console.log(`${LOG} 🎬 Iniciando geração de roteiro via LangChain (${this.modelName})...`)

    // Gemini tem limitações em response_schema (const, default). jsonMode evita enviar
    // schema à API; parseamos com Zod no client.
    const structuredLlm = this.model.withStructuredOutput(ScriptResponseSchema, {
      includeRaw: true,
      method: 'jsonMode'
    })

    const systemPrompt = buildSystemPrompt(request)
    const userPrompt = buildUserPrompt(request, 'gemini')

    // Log para depuração
    console.log('--- [DEBUG] LANGCHAIN GEMINI CONFIGURATION ---')
    console.log('Model:', this.modelName)
    console.log('Target Duration:', request.targetDuration, 'seconds')
    console.log('Target WPM:', request.targetWPM)
    console.log('Ideal Scene Count:', Math.ceil(request.targetDuration / 5))
    console.log('--- [DEBUG] LANGCHAIN SYSTEM PROMPT ---')
    console.log(systemPrompt)

    // Preparar mensagens (Suporte Multimodal)
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]

    const humanContent: any[] = [{ type: 'text', text: userPrompt }]

    // Injetar imagens se disponíveis (Vision Capability)
    humanContent.push(...processImagesForLangChain(request.images, LOG))

    messages.push(new HumanMessage({ content: humanContent }))

    try {
      const startTime = Date.now()
      console.log(`${LOG} 📤 Enviando request multimodal para LangChain...`)
      console.log(`${LOG} 🔍 Schema esperado: title, summary, scenes, backgroundMusic, backgroundMusicTracks`)

      const { invokeWithLogging } = await import('../../../utils/llm-invoke-wrapper')
      const result = await invokeWithLogging(structuredLlm, messages, { taskId: 'script-gemini', provider: 'gemini', model: 'unknown' })
      let content = result.parsed as ScriptResponse | null
      const rawMessage = result.raw as any

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`${LOG} 📥 Resposta recebida em ${elapsed}s`)

      const tokenUsage = extractTokenUsage(rawMessage)
      console.log(`${LOG} 📊 Token Usage REAL: ${tokenUsage.inputTokens} input + ${tokenUsage.outputTokens} output = ${tokenUsage.totalTokens} total`)

      // FALLBACK: Incompatibilidade Zod v4 + LangChain @langchain/google-genai
      if (!content) {
        console.warn(`${LOG} ⚠️ result.parsed é null — tentando fallback manual de parsing (Zod v4 compat)...`)
        content = fallbackParseRawResponse(rawMessage, LOG)
        if (!content) {
          throw new Error('Falha no parsing do roteiro. Nem structured output nem fallback manual funcionaram.')
        }
      }

      // Validação rápida de integridade
      console.log(`${LOG} ✅ Roteiro gerado com sucesso!`)
      console.log(`${LOG} Título:`, content.title)
      console.log(`${LOG} Número de cenas:`, content.scenes.length)
      console.log(`${LOG} Background Music:`, content.backgroundMusic ? 'Sim (video todo)' : 'Não')
      console.log(`${LOG} Background Music Tracks:`, content.backgroundMusicTracks?.length || 0, 'tracks')

      return parseScriptResponse(content, request, this.getName(), this.modelName, tokenUsage)
    } catch (error) {
      console.error(`${LOG} ❌ Erro na geração estruturada:`, error)
      console.error(`${LOG} 🔍 Error details:`, JSON.stringify(error, null, 2))
      throw error
    }
  }
}
