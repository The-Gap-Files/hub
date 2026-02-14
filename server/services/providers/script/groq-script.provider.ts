import { ChatGroq } from '@langchain/groq'
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

export class GroqScriptProvider implements IScriptGenerator {
  private model: ChatGroq
  private modelName: string

  constructor(config: { apiKey: string; model?: string }) {
    // Padrão: GPT-OSS 120B (melhor para structured output)
    this.modelName = config.model ?? 'openai/gpt-oss-120b'
    this.model = new ChatGroq({
      apiKey: config.apiKey,
      model: this.modelName, // ChatGroq usa 'model', não 'modelName'
      temperature: 0.8, // Script generation precisa de criatividade
      maxTokens: 65536, // Máximo suportado pelo GPT-OSS 120B — necessário para vídeos longos (170+ cenas)
      timeout: 120000, // 2 minutos
      maxRetries: 2
    })
  }

  getName(): string {
    return 'GROQ'
  }

  async generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    const LOG = '[Groq Script]'
    console.log(`${LOG} 🎬 Iniciando geração de roteiro via LangChain (${this.modelName})...`)

    const m = this.model as any

    // Groq Llama 4: forçar jsonMode (SDK não suporta jsonSchema para Llama)
    // Groq GPT-OSS: SDK autodetecta jsonSchema pelo prefixo 'openai/gpt-oss' → sem override
    const isGroqLlama4 = this.modelName.includes('llama-4') && !this.modelName.startsWith('openai/')

    const structuredLlm = m.withStructuredOutput(
      ScriptResponseSchema,
      {
        includeRaw: true,
        ...(isGroqLlama4 ? { method: 'jsonMode' } : { method: 'jsonSchema' })
      }
    )

    const systemPrompt = buildSystemPrompt(request)
    const userPrompt = buildUserPrompt(request, 'groq')

    // Log para depuração
    console.log('--- [DEBUG] GROQ LANGCHAIN CONFIGURATION ---')
    console.log('Model:', this.modelName)
    console.log('Target Duration:', request.targetDuration, 'seconds')
    console.log('Target WPM:', request.targetWPM)
    console.log('Ideal Scene Count:', Math.ceil(request.targetDuration / 5))
    console.log('Structured Output Method:', isGroqLlama4 ? 'jsonMode' : 'jsonSchema')
    console.log('--- [DEBUG] GROQ SYSTEM PROMPT ---')
    console.log(systemPrompt)

    // Preparar mensagens (Groq não suporta multimodal ainda)
    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]

    // Avisar se imagens foram fornecidas (Groq não suporta)
    if (request.images && request.images.length > 0) {
      console.warn(`${LOG} ⚠️ Groq não suporta multimodal. ${request.images.length} imagens serão ignoradas.`)
    }

    try {
      const startTime = Date.now()
      console.log(`${LOG} 📤 Enviando request para Groq LangChain...`)
      console.log(`${LOG} 🔍 Schema esperado: title, summary, scenes, backgroundMusic, backgroundMusicTracks`)

      const { invokeWithLogging } = await import('../../../utils/llm-invoke-wrapper')
      const result = await invokeWithLogging(structuredLlm, messages, {
        taskId: 'script-groq',
        provider: 'groq',
        model: this.modelName
      })

      let content = result.parsed as ScriptResponse | null
      const rawMessage = result.raw as any

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`${LOG} 📥 Resposta recebida em ${elapsed}s`)

      const tokenUsage = extractTokenUsage(rawMessage)
      console.log(`${LOG} 📊 Token Usage: ${tokenUsage.inputTokens} input + ${tokenUsage.outputTokens} output = ${tokenUsage.totalTokens} total`)

      // FALLBACK: Se withStructuredOutput não conseguiu parsear
      if (!content) {
        console.warn(`${LOG} ⚠️ result.parsed é null — tentando fallback manual de parsing...`)
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
    } catch (error: any) {
      console.error(`${LOG} ❌ Erro na geração estruturada:`, error)

      // Fallback: Groq json_validate_failed — o JSON gerado é válido mas falta campo opcional
      // Ex: estimatedDuration ausente. Extrair failed_generation e parsear com defaults do Zod.
      const errorBody = error?.error?.error || error?.error || {}
      const errorMessage = typeof error?.message === 'string' ? error.message : ''

      if (errorBody?.code === 'json_validate_failed' || errorMessage.includes('json_validate_failed')) {
        const failedGen = errorBody?.failed_generation || error?.error?.failed_generation
        if (failedGen) {
          console.warn(`${LOG} ⚠️ Groq json_validate_failed — tentando recuperar com defaults do schema...`)
          try {
            const partial = typeof failedGen === 'string' ? JSON.parse(failedGen) : failedGen

            // Verificar se não é JSON Schema ao invés de dados
            if (partial?.$schema || (partial?.properties && partial?.type === 'object')) {
              console.error(`${LOG} ❌ Modelo retornou JSON Schema ao invés de dados.`)
              throw error
            }

            // Parsear com Zod — defaults serão preenchidos (ex: estimatedDuration = 5)
            const validated = ScriptResponseSchema.parse(partial)
            console.warn(`${LOG} ✅ Recuperação bem-sucedida! ${validated.scenes.length} cenas extraídas do failed_generation.`)

            const rawMessage = error?.response?.body || {}
            const tokenUsage = extractTokenUsage(rawMessage)

            return parseScriptResponse(validated, request, this.getName(), this.modelName, tokenUsage)
          } catch (parseErr: any) {
            console.error(`${LOG} ❌ Falha ao recuperar failed_generation:`, parseErr?.message || parseErr)
          }
        }
      }

      console.error(`${LOG} 🔍 Error details:`, JSON.stringify(error, null, 2))
      throw error
    }
  }
}
