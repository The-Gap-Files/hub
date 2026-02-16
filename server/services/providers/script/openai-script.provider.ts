import { ChatOpenAI } from '@langchain/openai'
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

export class OpenAIScriptProvider implements IScriptGenerator {
  private model: ChatOpenAI
  private modelName: string

  constructor(config: { apiKey: string; model?: string; baseUrl?: string; temperature?: number }) {
    this.modelName = config.model ?? 'gpt-4o'
    this.model = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: this.modelName,
      configuration: {
        baseURL: config.baseUrl ?? 'https://api.openai.com/v1'
      },
      temperature: config.temperature ?? 0.5, // Do LlmAssignment (script task)
      timeout: 120000, // 2 minutos de timeout para chamadas multimodais complexas
      maxRetries: 2
    })
  }

  getName(): string {
    return 'OPENAI'
  }

  async generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    const LOG = '[OpenAI Script]'
    console.log(`${LOG} 🎬 Iniciando geração de roteiro via LangChain (${this.modelName})...`)

    const m = this.model as any
    // Groq Llama 4: forçar jsonMode (SDK não suporta jsonSchema para Llama).
    // Groq GPT-OSS: SDK autodetecta jsonSchema pelo prefixo 'openai/gpt-oss' → sem override.
    const isGroqLlama4 = (m.constructor?.name === 'ChatGroq' || this.modelName.includes('llama-4')) && !this.modelName.startsWith('openai/')
    const structuredLlm = typeof m.withStructuredOutputReplicate === 'function'
      ? m.withStructuredOutputReplicate(ScriptResponseSchema, { includeRaw: true })
      : m.withStructuredOutput(ScriptResponseSchema, { includeRaw: true, ...(isGroqLlama4 ? { method: 'jsonMode' } : {}) })

    const systemPrompt = buildSystemPrompt(request)
    const userPrompt = buildUserPrompt(request, 'openai')

    // Log para depuração
    console.log('--- [DEBUG] LANGCHAIN CONFIGURATION ---')
    console.log('Target Duration:', request.targetDuration, 'seconds')
    console.log('Target WPM:', request.targetWPM)
    console.log('Ideal Scene Count:', Math.ceil(request.targetDuration / 5))
    console.log('--- [DEBUG] LANGCHAIN SYSTEM PROMPT ---')
    console.log(systemPrompt)

    // Preparar mensagens (Suporte Multimodal)
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]

    const humanContent: any[] = [{ type: 'text', text: userPrompt }]

    // Injetar imagens se disponíveis (Vision Capability)
    const imageParts = processImagesForLangChain(request.images, LOG)
    // OpenAI suporta detail: 'high'
    imageParts.forEach(p => { p.image_url.detail = 'high' })
    humanContent.push(...imageParts)

    messages.push(new HumanMessage({ content: humanContent }))

    try {
      const startTime = Date.now()
      console.log(`${LOG} 📤 Enviando request multimodal para LangChain...`)
      console.log(`${LOG} 🔍 Schema esperado: title, summary, scenes, backgroundMusic, backgroundMusicTracks`)

      const { invokeWithLogging } = await import('../../../utils/llm-invoke-wrapper')
      const result = await invokeWithLogging(structuredLlm, messages, { taskId: 'script-openai', provider: 'openai', model: 'unknown' })
      let content = result.parsed as ScriptResponse | null
      const rawMessage = result.raw as any

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`${LOG} 📥 Resposta recebida em ${elapsed}s`)

      const tokenUsage = extractTokenUsage(rawMessage)
      console.log(`${LOG} 📊 Token Usage REAL: ${tokenUsage.inputTokens} input + ${tokenUsage.outputTokens} output = ${tokenUsage.totalTokens} total`)

      // FALLBACK: Se withStructuredOutput não conseguiu parsear (Zod v4 compat)
      if (!content) {
        console.warn(`${LOG} ⚠️ result.parsed é null — tentando fallback manual de parsing (Zod v4 compat)...`)
        content = fallbackParseRawResponse(rawMessage, LOG)
        if (!content) {
          throw new Error('Roteiro não pôde ser parseado. O modelo retornou dados que não correspondem ao schema esperado.')
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
