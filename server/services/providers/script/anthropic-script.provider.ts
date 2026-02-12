import { ChatAnthropic } from '@langchain/anthropic'
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

export class AnthropicScriptProvider implements IScriptGenerator {
  private model: ChatAnthropic
  private modelName: string

  constructor(config: { apiKey: string; model?: string }) {
    this.modelName = config.model ?? 'claude-opus-4-6'
    this.model = new ChatAnthropic({
      anthropicApiKey: config.apiKey,
      modelName: this.modelName,
      temperature: 0.7,
      maxTokens: 64000, // Anthropic exige maxTokens explícito (64K — limite máximo do Sonnet 4; Opus aceita mais mas usamos o menor denominador)
      clientOptions: {
        timeout: 300000, // 5 minutos -- Opus com roteiros longos (YouTube Cinematic) pode demorar
        maxRetries: 3
      }
    })
  }

  getName(): string {
    return 'ANTHROPIC'
  }

  async generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    const LOG = '[Anthropic Script]'
    console.log(`${LOG} 🎬 Iniciando geração de roteiro via LangChain + Claude...`)

    const structuredLlm = this.model.withStructuredOutput(ScriptResponseSchema, { includeRaw: true })

    const systemPrompt = buildSystemPrompt(request)
    const userPrompt = buildUserPrompt(request, 'anthropic')

    // Log para depuração
    console.log('--- [DEBUG] LANGCHAIN ANTHROPIC CONFIGURATION ---')
    console.log('Model:', this.modelName)
    console.log('Target Duration:', request.targetDuration, 'seconds')
    console.log('Target WPM:', request.targetWPM)
    console.log('Ideal Scene Count:', Math.ceil(request.targetDuration / 5))
    console.log('--- [DEBUG] LANGCHAIN SYSTEM PROMPT ---')
    console.log(systemPrompt)

    // Preparar mensagens (Suporte Multimodal)
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]

    const humanContent: any[] = [{ type: 'text', text: userPrompt }]

    // Injetar imagens se disponíveis (Claude Vision)
    humanContent.push(...processImagesForLangChain(request.images, LOG))

    messages.push(new HumanMessage({ content: humanContent }))

    try {
      const startTime = Date.now()
      console.log(`${LOG} 📤 Enviando request multimodal para LangChain + Claude...`)
      console.log(`${LOG} 🔍 Schema esperado: title, summary, scenes, backgroundMusic, backgroundMusicTracks`)

      const result = await structuredLlm.invoke(messages)
      let content = result.parsed as ScriptResponse | null
      const rawMessage = result.raw as any

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`${LOG} 📥 Resposta recebida em ${elapsed}s`)

      const tokenUsage = extractTokenUsage(rawMessage)
      console.log(`${LOG} 📊 Token Usage REAL: ${tokenUsage.inputTokens} input + ${tokenUsage.outputTokens} output = ${tokenUsage.totalTokens} total`)

      // FALLBACK: Se withStructuredOutput não conseguiu parsear (Zod v4 compat ou output truncado)
      if (!content) {
        const maxTokensHit = tokenUsage.outputTokens >= 64000
        console.warn(`${LOG} ⚠️ result.parsed é null — tentando fallback manual de parsing...${maxTokensHit ? ' (possível truncamento por maxTokens)' : ''}`)
        content = fallbackParseRawResponse(rawMessage, LOG)
        if (!content) {
          throw new Error(`Roteiro não pôde ser parseado. ${maxTokensHit ? 'Output excedeu o limite de tokens — tente reduzir a duração do vídeo.' : 'O modelo retornou dados que não correspondem ao schema esperado.'}`)
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
