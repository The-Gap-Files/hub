/**
 * Hook-Only Script Provider — Provider Dedicado (SOLID)
 * 
 * Este provider existe porque hook-only tem regras DIAMETRALMENTE OPOSTAS
 * ao roteirista genérico. O prompt genérico (shared-script-prompts.ts) tem
 * ~270 linhas de regras para full-video que DILUEM e CONTRADIZEM hook-only.
 * 
 * Este provider:
 * - Usa prompts dedicados (hook-only-script-prompts.ts) sem ruído
 * - Implementa IScriptGenerator (mesmo contrato dos outros providers)
 * - Reutiliza infrastructure do shared (schema, parse, fallback, tokens)
 * - É resolvido automaticamente pelo ProviderManager quando narrativeRole === 'hook-only'
 * 
 * O LLM subjacente é resolvido pelo LLM Factory (mesmo provider/model do 'script' task).
 */

import { ChatGroq } from '@langchain/groq'
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
  parseScriptResponse,
  processImagesForLangChain,
  fallbackParseRawResponse,
  extractTokenUsage
} from './shared-script-prompts'
import {
  buildHookOnlySystemPrompt,
  buildHookOnlyUserPrompt
} from './hook-only-script-prompts'

type SupportedProvider = 'groq' | 'gemini' | 'openai'

export class HookOnlyScriptProvider implements IScriptGenerator {
  private model: any
  private modelName: string
  private providerType: SupportedProvider

  constructor(config: { apiKey: string; model?: string; temperature?: number; provider?: string }) {
    this.providerType = (config.provider?.toLowerCase() || 'groq') as SupportedProvider
    this.modelName = config.model ?? 'openai/gpt-oss-120b'

    // Instanciar o modelo LangChain adequado baseado no provider
    switch (this.providerType) {
      case 'gemini':
        this.model = new ChatGoogleGenerativeAI({
          apiKey: config.apiKey,
          model: this.modelName,
          temperature: config.temperature ?? 0.6,
          maxRetries: 2,
          maxOutputTokens: 8192 // Hook-only = 4-7 cenas, nunca precisa de mais
        })
        break

      case 'groq':
      default:
        this.model = new ChatGroq({
          apiKey: config.apiKey,
          model: this.modelName,
          temperature: config.temperature ?? 0.6,
          maxTokens: 8192,
          timeout: 60000, // 1 minuto (hook-only é rápido)
          maxRetries: 2
        })
        break
    }
  }

  getName(): string {
    // Retorna o nome do provider subjacente (GROQ, GEMINI, etc.)
    // para compatibilidade com o enum AIProvider do Prisma.
    return this.providerType.toUpperCase()
  }

  async generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    const LOG = `[HookOnly Script (${this.providerType})]`
    console.log(`${LOG} 💥 Gerando roteiro HOOK-ONLY dedicado via ${this.modelName}...`)

    // Structured output — method depende do provider
    const isGemini = this.providerType === 'gemini'
    const isGroqLlama4 = this.providerType === 'groq' && this.modelName.includes('llama-4')

    const method = isGemini ? 'jsonSchema' : isGroqLlama4 ? 'jsonMode' : 'jsonSchema'

    const structuredLlm = this.model.withStructuredOutput(ScriptResponseSchema, {
      includeRaw: true,
      method
    })

    // Prompts cirúrgicos dedicados para hook-only
    const systemPrompt = buildHookOnlySystemPrompt(request)
    const userPrompt = buildHookOnlyUserPrompt(request)

    console.log(`${LOG} 📐 System prompt: ${systemPrompt.length} chars (vs ~8000+ do genérico)`)
    console.log(`${LOG} 📐 User prompt: ${userPrompt.length} chars`)

    // Montar mensagens
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]

    const humanContent: any[] = [{ type: 'text', text: userPrompt }]

    // Multimodal (se suportado pelo provider)
    if (isGemini) {
      humanContent.push(...processImagesForLangChain(request.images, LOG))
    } else if (request.images && request.images.length > 0) {
      console.warn(`${LOG} ⚠️ ${this.providerType} não suporta multimodal. ${request.images.length} imagens ignoradas.`)
    }

    messages.push(new HumanMessage({ content: humanContent }))

    try {
      const startTime = Date.now()
      console.log(`${LOG} 📤 Enviando request para ${this.providerType}...`)

      const { invokeWithLogging } = await import('../../../utils/llm-invoke-wrapper')
      const result = await invokeWithLogging(structuredLlm, messages, {
        taskId: 'script-hook-only',
        provider: this.providerType,
        model: this.modelName
      })

      let content = result.parsed as ScriptResponse | null
      const rawMessage = result.raw as any

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`${LOG} 📥 Resposta em ${elapsed}s`)

      const tokenUsage = extractTokenUsage(rawMessage)
      console.log(`${LOG} 📊 Tokens: ${tokenUsage.inputTokens} in + ${tokenUsage.outputTokens} out = ${tokenUsage.totalTokens} total`)

      // Fallback se parsed é null
      if (!content) {
        console.warn(`${LOG} ⚠️ result.parsed é null — tentando fallback...`)
        content = fallbackParseRawResponse(rawMessage, LOG)
        if (!content) {
          throw new Error('Hook-only script não pôde ser parseado.')
        }
      }

      // Validação de integridade mínima
      console.log(`${LOG} ✅ Hook-only gerado!`)
      console.log(`${LOG} Título: ${content.title}`)
      console.log(`${LOG} Cenas: ${content.scenes.length}`)

      // Loop Infinito: A última cena (4) deve conectar com a primeira (1)
      const lastScene = content.scenes[content.scenes.length - 1]
      const firstScene = content.scenes[0]
      if (lastScene && firstScene) {
        console.log(`${LOG} 🔄 Loop Check: "${lastScene.narration.slice(-20)}..." -> "${firstScene.narration.slice(0, 20)}..."`)
      }

      // Validar quantidade de cenas (expectativa estrita: 4)
      if (content.scenes.length !== 4) {
        console.warn(`${LOG} ⚠️ Hook-only gerou ${content.scenes.length} cenas (esperado estritamente 4 para Loop Infinito).`)
      }

      return parseScriptResponse(content, request, this.getName(), this.modelName, tokenUsage)
    } catch (error: any) {
      console.error(`${LOG} ❌ Erro:`, error)

      // Fallback Groq json_validate_failed
      const errorBody = error?.error?.error || error?.error || {}
      const errorMessage = typeof error?.message === 'string' ? error.message : ''

      if (errorBody?.code === 'json_validate_failed' || errorMessage.includes('json_validate_failed')) {
        const failedGen = errorBody?.failed_generation || error?.error?.failed_generation
        if (failedGen) {
          console.warn(`${LOG} ⚠️ Groq json_validate_failed — recuperando...`)
          try {
            const partial = typeof failedGen === 'string' ? JSON.parse(failedGen) : failedGen

            if (partial?.$schema || (partial?.properties && partial?.type === 'object')) {
              console.error(`${LOG} ❌ Modelo retornou JSON Schema ao invés de dados.`)
              throw error
            }

            const validated = ScriptResponseSchema.parse(partial)
            console.warn(`${LOG} ✅ Recuperado! ${validated.scenes.length} cenas.`)

            const rawMessage = error?.response?.body || {}
            const tokenUsage = extractTokenUsage(rawMessage)
            return parseScriptResponse(validated, request, this.getName(), this.modelName, tokenUsage)
          } catch (parseErr: any) {
            console.error(`${LOG} ❌ Falha ao recuperar:`, parseErr?.message || parseErr)
          }
        }
      }

      throw error
    }
  }
}
