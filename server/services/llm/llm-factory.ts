/**
 * LLM Factory - Cria instâncias LangChain BaseChatModel
 *
 * Ponto único de criação de LLMs em todo o projeto.
 * Todos os serviços usam esta factory em vez de instanciar diretamente.
 *
 * Fluxo: Task → LlmAssignment (DB direto) → Factory → BaseChatModel
 *
 * Providers e modelos são persistidos no banco (LlmProvider / LlmModel).
 * API Keys migram do .env para o banco — o .env serve apenas como fallback.
 *
 * DESIGN: Sem cache em memória para assignments — cada chamada consulta o banco.
 * É uma query simples (findUnique por taskId) que leva milissegundos,
 * antes de uma chamada de LLM que leva segundos.
 */

import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGroq } from '@langchain/groq'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ReplicateChatLLM } from './replicate-llm'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import {
  type LlmProviderId,
  type LlmTaskId,
  LLM_PROVIDERS,
  LLM_TASKS,
  isValidLlmConfig
} from '../../constants/llm-registry'
import { prisma } from '../../utils/prisma'

// ─── Tipos ──────────────────────────────────────────────────────

export interface LlmAssignment {
  taskId: LlmTaskId
  provider: LlmProviderId
  model: string
  temperature?: number
}

export interface CreateLlmOptions {
  provider: LlmProviderId
  model: string
  temperature?: number
  /** Limite de tokens na resposta — importante para Anthropic que exige maxTokens explícito */
  maxTokens?: number
  /** Ativa structured output (JSON mode) — depende do provider */
  structuredOutput?: boolean
}

/** Overrides para createLlmForTask — permite ajustar temperatura e maxTokens por operação */
export interface TaskLlmOverrides {
  temperature?: number
  maxTokens?: number
}

/** Tipo do provider retornado pelo banco (com modelos incluídos) */
export interface DbProvider {
  id: string
  name: string
  description: string | null
  apiKey: string | null
  baseUrl: string | null
  iconKey: string
  isActive: boolean
  models: DbModel[]
}

export interface DbModel {
  id: string
  modelId: string
  name: string
  providerId: string
  contextWindow: number
  costTier: number
  supportsStructuredOutput: boolean
  supportsVision: boolean
  isActive: boolean
  inputSchema: any | null
}

// ─── Seed (primeira execução) ────────────────────────────────────

/** Flag para evitar re-seed a cada request — seed só roda 1x por boot */
let _seeded = false

/**
 * Seed: Lê os providers/modelos do registry estático (LLM_PROVIDERS)
 * e faz upsert nas tabelas LlmProvider e LlmModel.
 *
 * - Provider novo → cria com apiKey lida do process.env
 * - Provider existente → atualiza metadados mas NÃO sobrescreve apiKey
 * - Modelos → sempre atualiza metadados (nome, contextWindow, etc.)
 */
async function seedProvidersAndModels(): Promise<void> {
  if (_seeded) return
  _seeded = true

  console.log('[LLM Factory] 🌱 Seeding providers and models from registry...')

  let providersSeeded = 0
  let modelsSeeded = 0

  for (const provider of Object.values(LLM_PROVIDERS)) {
    // Verificar se o provider já existe no banco
    const existing = await prisma.llmProvider.findUnique({
      where: { id: provider.id }
    })

    if (!existing) {
      // Provider novo — criar com API Key do env (se disponível)
      const envApiKey = process.env[provider.envKey]?.replace(/"/g, '') || null
      await prisma.llmProvider.create({
        data: {
          id: provider.id,
          name: provider.name,
          description: provider.description,
          iconKey: provider.iconKey,
          apiKey: envApiKey,
          isActive: true
        }
      })
      console.log(
        `[LLM Factory]   + Provider "${provider.id}" criado` +
        (envApiKey ? ` (API Key importada do env ${provider.envKey})` : ' (sem API Key)')
      )
    } else {
      // Provider existente — atualizar metadados, NÃO sobrescrever apiKey
      await prisma.llmProvider.update({
        where: { id: provider.id },
        data: {
          name: provider.name,
          description: provider.description,
          iconKey: provider.iconKey
        }
      })
    }
    providersSeeded++

    // Upsert dos modelos deste provider
    for (const model of provider.models) {
      await prisma.llmModel.upsert({
        where: {
          providerId_modelId: {
            providerId: provider.id,
            modelId: model.id
          }
        },
        create: {
          modelId: model.id,
          name: model.name,
          providerId: provider.id,
          contextWindow: model.contextWindow,
          costTier: model.costTier,
          supportsStructuredOutput: model.supportsStructuredOutput,
          supportsVision: model.supportsVision,
          isActive: true
        },
        update: {
          name: model.name,
          contextWindow: model.contextWindow,
          costTier: model.costTier,
          supportsStructuredOutput: model.supportsStructuredOutput,
          supportsVision: model.supportsVision
        }
      })
      modelsSeeded++
    }
  }

  // Seed default assignments para tasks que não existem no banco
  const existingAssignments = await prisma.llmAssignment.findMany({ select: { taskId: true } })
  const existingTaskIds = new Set(existingAssignments.map(a => a.taskId))

  for (const [taskId, task] of Object.entries(LLM_TASKS)) {
    if (!existingTaskIds.has(taskId)) {
      await prisma.llmAssignment.create({
        data: {
          taskId,
          provider: task.defaultProvider,
          model: task.defaultModel,
          temperature: taskId === 'script' ? 0.8 : 0.3
        }
      }).catch(() => { }) // Ignora se já existe (race condition)
      console.log(`[LLM Factory]   + Assignment "${taskId}" → ${task.defaultProvider}/${task.defaultModel}`)
    }
  }

  console.log(`[LLM Factory] 🌱 Seed concluído: ${providersSeeded} providers, ${modelsSeeded} modelos`)
}

// ─── Providers (consulta direta ao DB) ───────────────────────────

/** Retorna todos os providers ativos com seus modelos */
export async function getDbProviders(): Promise<DbProvider[]> {
  await seedProvidersAndModels()

  const rows = await prisma.llmProvider.findMany({
    where: { isActive: true },
    include: {
      models: {
        where: { isActive: true },
        orderBy: { costTier: 'desc' }
      }
    },
    orderBy: { name: 'asc' }
  })

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    apiKey: r.apiKey,
    baseUrl: r.baseUrl,
    iconKey: r.iconKey,
    isActive: r.isActive,
    models: r.models.map(m => ({
      id: m.id,
      modelId: m.modelId,
      name: m.name,
      providerId: m.providerId,
      contextWindow: m.contextWindow,
      costTier: m.costTier,
      supportsStructuredOutput: m.supportsStructuredOutput,
      supportsVision: m.supportsVision,
      isActive: m.isActive,
      inputSchema: m.inputSchema
    }))
  }))
}

/** Retorna um provider específico pelo ID */
export async function getDbProvider(id: string): Promise<DbProvider | undefined> {
  const providers = await getDbProviders()
  return providers.find(p => p.id === id)
}

/** Retorna um modelo específico pelo providerId + modelId */
export async function getDbModel(providerId: string, modelId: string): Promise<DbModel | undefined> {
  const provider = await getDbProvider(providerId)
  return provider?.models.find(m => m.modelId === modelId)
}

/** Valida se a combinação provider/modelo existe e está ativa no DB */
export async function isValidDbConfig(providerId: string, modelId: string): Promise<boolean> {
  const model = await getDbModel(providerId, modelId)
  return !!model
}

// ─── API Keys (DB primeiro, env como fallback) ───────────────────

async function getApiKey(provider: LlmProviderId): Promise<string> {
  // 1. Tentar ler do banco
  const dbProvider = await prisma.llmProvider.findUnique({
    where: { id: provider },
    select: { apiKey: true }
  })

  if (dbProvider?.apiKey) {
    return dbProvider.apiKey
  }

  // 2. Fallback: ler do process.env
  const envMap: Record<LlmProviderId, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    groq: 'GROQ_API_KEY',
    gemini: 'GOOGLE_API_KEY',
    replicate: 'REPLICATE_API_TOKEN'
  }

  const key = process.env[envMap[provider]]?.replace(/"/g, '')
  if (!key) {
    throw new Error(
      `[LLM Factory] API Key não configurada para "${provider}". ` +
      `Configure via UI (Settings → Providers) ou defina a variável de ambiente ${envMap[provider]}.`
    )
  }
  return key
}

// ─── Factory Principal ──────────────────────────────────────────

/**
 * Cria uma instância de BaseChatModel LangChain para qualquer provider.
 * Todos os chat models retornados implementam a mesma interface:
 * .invoke(), .withStructuredOutput(), .stream(), etc.
 *
 * API Keys são lidas do banco (LlmProvider.apiKey) primeiro,
 * com fallback para process.env caso não estejam configuradas no banco.
 */
export async function createChatModel(options: CreateLlmOptions): Promise<BaseChatModel> {
  const { provider, model, temperature = 0.7, maxTokens } = options

  if (!isValidLlmConfig(provider, model)) {
    console.warn(`[LLM Factory] Combinação ${provider}/${model} não está no registry. Prosseguindo mesmo assim.`)
  }

  const apiKey = await getApiKey(provider)
  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '(vazia)'

  // Verificar se há baseUrl customizada no banco
  const dbProvider = await prisma.llmProvider.findUnique({
    where: { id: provider },
    select: { baseUrl: true }
  })
  const baseUrl = dbProvider?.baseUrl || undefined

  console.log(
    `[LLM Factory] 🔧 Criando modelo:` +
    `\n  → Provider: ${provider}` +
    `\n  → Model: "${model}"` +
    `\n  → Temperature: ${temperature}` +
    (maxTokens ? `\n  → Max Tokens: ${maxTokens}` : '') +
    `\n  → API Key: ${maskedKey}` +
    (baseUrl ? `\n  → Base URL: ${baseUrl}` : '')
  )

  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: model,
        temperature,
        maxRetries: 2,
        timeout: 60_000,
        ...(maxTokens ? { maxTokens } : {}),
        ...(baseUrl ? { configuration: { baseURL: baseUrl } } : {})
      })

    case 'anthropic':
      return new ChatAnthropic({
        anthropicApiKey: apiKey,
        modelName: model,
        temperature,
        maxRetries: 3,
        ...(maxTokens ? { maxTokens } : {}),
        clientOptions: {
          timeout: 600_000, // 10 minutos para tarefas complexas (monetization com 15 teasers)
          ...(baseUrl ? { baseURL: baseUrl } : {})
        }
      })

    case 'groq': {
      // Groq: Llama 4 Maverick/Scout limita a 8192 tokens. GPT-OSS suporta até 65536.
      const isLlama4 = model.includes('llama-4')
      const groqMaxLimit = isLlama4 ? 8192 : 65536
      const groqMaxTokens = maxTokens ? Math.min(maxTokens, groqMaxLimit) : undefined
      if (maxTokens && maxTokens > groqMaxLimit) {
        console.warn(`[LLM Factory] ⚠️ Groq (${model}): maxTokens ${maxTokens} excede limite de ${groqMaxLimit}. Limitando.`)
      }
      return new ChatGroq({
        apiKey,
        model,
        temperature,
        maxRetries: 2,
        timeout: 60_000,
        ...(groqMaxTokens ? { maxTokens: groqMaxTokens } : {})
      })
    }

    case 'gemini':
      return new ChatGoogleGenerativeAI({
        apiKey,
        model,
        temperature,
        maxRetries: 2,
        ...(maxTokens ? { maxOutputTokens: maxTokens } : {})
      })

    case 'replicate':
      // Wrapper customizado usando SDK nativo do Replicate (sem exigir version hash).
      // Funciona com invoke() mas não suporta withStructuredOutput nativamente.
      // Tasks que precisam de structured output usam fallback parsing (padrão Gemini raw).
      return new ReplicateChatLLM({
        model,
        apiKey,
        temperature,
        maxTokens: maxTokens || 16384,
        topK: 50,
        topP: 0.9
      }) as any // Cast: LLM → BaseChatModel (invoke funciona, structured output via fallback)

    default:
      throw new Error(`[LLM Factory] Provider desconhecido: "${provider}"`)
  }
}

// ─── Assignments (consulta direta ao DB, sem cache) ──────────────

/**
 * Retorna o assignment atual de uma task — consulta direta ao banco.
 * Se não existir no banco, usa default do registry e persiste.
 */
export async function getAssignment(taskId: LlmTaskId): Promise<LlmAssignment> {
  await seedProvidersAndModels()

  // Consulta direta ao banco
  const row = await prisma.llmAssignment.findUnique({
    where: { taskId }
  })

  if (row) {
    return {
      taskId: row.taskId as LlmTaskId,
      provider: row.provider as LlmProviderId,
      model: row.model,
      temperature: row.temperature
    }
  }

  // Task não existe no banco — criar com default do registry
  const task = LLM_TASKS[taskId]
  if (!task) {
    throw new Error(`[LLM Factory] Task desconhecida: "${taskId}"`)
  }

  console.warn(`[LLM Factory] ⚠️ Task "${taskId}" não encontrada no banco — criando com default`)
  const assignment: LlmAssignment = {
    taskId,
    provider: task.defaultProvider,
    model: task.defaultModel,
    temperature: taskId === 'script' ? 0.8 : 0.3
  }

  await prisma.llmAssignment.create({
    data: {
      taskId,
      provider: assignment.provider,
      model: assignment.model,
      temperature: assignment.temperature
    }
  }).catch(() => { }) // Race condition safe

  return assignment
}

/** Inicializa o seed (pode ser chamado no boot do server) */
export async function initAssignments(): Promise<void> {
  await seedProvidersAndModels()
}

/** Retorna todos os assignments */
export async function getAllAssignments(): Promise<LlmAssignment[]> {
  await seedProvidersAndModels()

  const rows = await prisma.llmAssignment.findMany()
  return rows.map(row => ({
    taskId: row.taskId as LlmTaskId,
    provider: row.provider as LlmProviderId,
    model: row.model,
    temperature: row.temperature
  }))
}

/** Atualiza o assignment de uma task (persiste no banco) */
export async function setAssignment(
  taskId: LlmTaskId,
  provider: LlmProviderId,
  model: string,
  temperature?: number
): Promise<void> {
  const temp = temperature ?? 0.7

  await prisma.llmAssignment.upsert({
    where: { taskId },
    create: { taskId, provider, model, temperature: temp },
    update: { provider, model, temperature: temp }
  })

  console.log(`[LLM Factory] 💾 Task "${taskId}" → ${provider}/${model} (persistido)`)
}

// ─── Atalho: Cria LLM direto por Task ID ────────────────────────

/**
 * Cria o BaseChatModel configurado para uma task específica.
 * Usa o assignment atual (default ou customizado via UI).
 *
 * Aceita overrides opcionais para ajustes por operação (ex: temperature, maxTokens)
 * sem alterar o provider/modelo configurado na UI.
 *
 * Exemplo:
 *   const llm = await createLlmForTask('analysis')
 *   const llm = await createLlmForTask('merge', { temperature: 0.3, maxTokens: 200 })
 */
export async function createLlmForTask(taskId: LlmTaskId, overrides?: TaskLlmOverrides): Promise<BaseChatModel> {
  const assignment = await getAssignment(taskId)
  return createChatModel({
    provider: assignment.provider,
    model: assignment.model,
    temperature: overrides?.temperature ?? assignment.temperature,
    maxTokens: overrides?.maxTokens
  })
}

// ─── Utilitários ────────────────────────────────────────────────

/** Verifica se um provider tem API Key configurada (DB ou env) */
export async function isProviderAvailable(provider: LlmProviderId): Promise<boolean> {
  try {
    await getApiKey(provider)
    return true
  } catch {
    return false
  }
}

/** Retorna quais providers estão disponíveis (com API Key no DB ou env) */
export async function getAvailableProviders(): Promise<LlmProviderId[]> {
  const all: LlmProviderId[] = ['openai', 'anthropic', 'groq', 'gemini', 'replicate']
  const results = await Promise.all(all.map(async p => ({ p, ok: await isProviderAvailable(p) })))
  return results.filter(r => r.ok).map(r => r.p)
}
