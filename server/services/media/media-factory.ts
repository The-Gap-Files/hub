/**
 * Media Factory — Gerencia providers de mídia (image, TTS, motion, music)
 *
 * Espelho do llm-factory.ts para providers de mídia.
 * Ponto único de consulta de providers/assignments de mídia em todo o projeto.
 *
 * Fluxo: Task → MediaAssignment (DB) → Factory → { provider, model, apiKey }
 *
 * Providers e modelos são persistidos no banco (LlmProvider com category='media' / LlmModel).
 * API Keys migram do .env para o banco — o .env serve apenas como fallback.
 *
 * @see server/constants/media-registry.ts
 */

import {
  type MediaProviderId,
  type MediaTaskId,
  MEDIA_PROVIDERS,
  MEDIA_TASKS
} from '../../constants/media-registry'
import { prisma } from '../../utils/prisma'

// ─── Tipos ──────────────────────────────────────────────────────

export interface MediaAssignmentData {
  taskId: string
  provider: string
  model: string
  extraConfig?: Record<string, unknown>
}

/** Dados retornados por getMediaProviderForTask — tudo que o ProviderManager precisa */
export interface MediaProviderForTask {
  providerId: MediaProviderId
  model: string
  apiKey: string | null
  extraConfig?: Record<string, unknown>
  inputSchema?: any
}

/** Tipo do provider de mídia no cache (com modelos incluídos) */
export interface DbMediaProvider {
  id: string
  name: string
  description: string | null
  apiKey: string | null
  baseUrl: string | null
  iconKey: string
  category: string
  isActive: boolean
  extraConfig: unknown
  models: DbMediaModel[]
}

export interface DbMediaModel {
  id: string
  modelId: string
  name: string
  providerId: string
  costTier: number
  isActive: boolean
  inputSchema?: unknown
}

// ─── Cache em memória ───────────────────────────────────────────

/** Cache de providers de mídia (category='media') carregados do banco */
let _providerCache: DbMediaProvider[] | null = null

/** Cache de assignments de mídia (taskId → assignment) */
const _assignmentCache = new Map<string, MediaAssignmentData>()

/** Flag de inicialização lazy */
let _initialized = false

// ─── Seed: Providers & Models ───────────────────────────────────

/**
 * Seed: Lê os providers/modelos do registry estático (MEDIA_PROVIDERS)
 * e faz upsert nas tabelas LlmProvider (category='media') e LlmModel.
 *
 * - Provider novo → cria com apiKey lida do process.env
 * - Provider existente → atualiza metadados mas NÃO sobrescreve apiKey
 * - Modelos → sempre atualiza metadados (nome, costTier, etc.)
 */
async function seedProvidersAndModels(): Promise<void> {
  console.log('[Media Factory] 🌱 Seeding media providers and models from registry...')

  let providersSeeded = 0
  let modelsSeeded = 0

  for (const provider of Object.values(MEDIA_PROVIDERS)) {
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
          category: 'media',
          apiKey: envApiKey,
          isActive: true
        }
      })
      console.log(
        `[Media Factory]   + Provider "${provider.id}" criado` +
        (envApiKey ? ` (API Key importada do env ${provider.envKey})` : ' (sem API Key)')
      )
    } else {
      // Provider existente — atualizar metadados, NÃO sobrescrever apiKey
      await prisma.llmProvider.update({
        where: { id: provider.id },
        data: {
          name: provider.name,
          description: provider.description,
          iconKey: provider.iconKey,
          category: 'media'
        }
      })
      console.log(`[Media Factory]   ~ Provider "${provider.id}" atualizado (apiKey preservada)`)
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
          costTier: model.costTier,
          isActive: true,
          inputSchema: model.inputSchema ? (model.inputSchema as any) : null
        },
        update: {
          name: model.name,
          costTier: model.costTier,
          // SEMPRE sobrescrever inputSchema no update — garante que schemas novos do registry cheguem ao banco
          inputSchema: model.inputSchema ? (model.inputSchema as any) : null
        }
      })
      modelsSeeded++
    }
  }

  console.log(`[Media Factory] 🌱 Seed concluído: ${providersSeeded} providers, ${modelsSeeded} modelos`)
}

// ─── Seed: Default Assignments ──────────────────────────────────

/**
 * Popula a tabela media_assignments com os defaults do registry.
 */
async function seedDefaultAssignments(): Promise<void> {
  console.log('[Media Factory] 🌱 Seeding default media assignments...')

  for (const [taskId, task] of Object.entries(MEDIA_TASKS)) {
    const data: MediaAssignmentData = {
      taskId,
      provider: task.defaultProvider,
      model: task.defaultModel
    }

    await prisma.mediaAssignment.upsert({
      where: { taskId },
      create: {
        taskId,
        provider: data.provider,
        model: data.model
      },
      update: {} // Não sobrescreve se já existe
    })

    _assignmentCache.set(taskId, data)
  }

  console.log(`[Media Factory] 🌱 Seeded ${Object.keys(MEDIA_TASKS).length} default media assignments`)
}

// ─── Load Cache ─────────────────────────────────────────────────

/**
 * Carrega todos os providers de mídia (category='media') do banco para o cache.
 */
async function loadProviderCache(): Promise<void> {
  const rows = await prisma.llmProvider.findMany({
    where: { isActive: true, category: 'media' },
    include: {
      models: {
        where: { isActive: true },
        orderBy: { costTier: 'desc' }
      }
    },
    orderBy: { name: 'asc' }
  })

  _providerCache = rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    apiKey: r.apiKey,
    baseUrl: r.baseUrl,
    iconKey: r.iconKey,
    category: r.category,
    isActive: r.isActive,
    extraConfig: r.extraConfig,
    models: r.models.map(m => ({
      id: m.id,
      modelId: m.modelId,
      name: m.name,
      providerId: m.providerId,
      costTier: m.costTier,
      isActive: m.isActive,
      inputSchema: m.inputSchema ?? undefined
    }))
  }))

  console.log(
    `[Media Factory] ✅ Provider cache carregado: ${_providerCache.length} providers, ` +
    `${_providerCache.reduce((acc, p) => acc + p.models.length, 0)} modelos`
  )
}

/**
 * Carrega todos os media assignments do banco para o cache.
 */
async function loadAssignmentCache(): Promise<void> {
  const dbRows = await prisma.mediaAssignment.findMany()

  for (const row of dbRows) {
    _assignmentCache.set(row.taskId, {
      taskId: row.taskId,
      provider: row.provider,
      model: row.model,
      extraConfig: (row.extraConfig as Record<string, unknown>) ?? undefined
    })
  }
}

// ─── Inicialização Lazy ─────────────────────────────────────────

/**
 * Inicializa a factory: seed providers/models, seed assignments, carrega caches.
 * Chamada automaticamente no primeiro acesso (lazy).
 */
async function ensureInitialized(): Promise<void> {
  if (_initialized) return

  try {
    // 1. Seed providers e modelos do registry → banco
    await seedProvidersAndModels()

    // 2. Carregar cache de providers do banco
    await loadProviderCache()

    // 3. Carregar assignments do banco
    const dbRows = await prisma.mediaAssignment.findMany()

    if (dbRows.length > 0) {
      // Carregar do banco
      for (const row of dbRows) {
        _assignmentCache.set(row.taskId, {
          taskId: row.taskId,
          provider: row.provider,
          model: row.model,
          extraConfig: (row.extraConfig as Record<string, unknown>) ?? undefined
        })
      }
      console.log(`[Media Factory] ✅ Loaded ${dbRows.length} media assignments from DB`)
    } else {
      // Primeira vez: popular com defaults e persistir
      await seedDefaultAssignments()
    }

    // Garantir que todas as tasks do registry existam no cache
    for (const [taskId, task] of Object.entries(MEDIA_TASKS)) {
      if (!_assignmentCache.has(taskId)) {
        const assignment: MediaAssignmentData = {
          taskId,
          provider: task.defaultProvider,
          model: task.defaultModel
        }
        _assignmentCache.set(taskId, assignment)
        // Persistir tasks novas que não estavam no banco
        await prisma.mediaAssignment.create({
          data: {
            taskId,
            provider: assignment.provider,
            model: assignment.model
          }
        }).catch(() => { }) // Ignora se já existe (race condition)
      }
    }
  } catch (error) {
    console.error('[Media Factory] ⚠️ Erro ao inicializar, usando defaults:', error)
    // Fallback: defaults em memória (sem persistência)
    for (const [taskId, task] of Object.entries(MEDIA_TASKS)) {
      if (!_assignmentCache.has(taskId)) {
        _assignmentCache.set(taskId, {
          taskId,
          provider: task.defaultProvider,
          model: task.defaultModel
        })
      }
    }
  }

  _initialized = true
}

// ─── API Key (DB primeiro, env como fallback) ───────────────────

/**
 * Lê a API Key de um media provider.
 * Prioridade: cache do banco → process.env
 */
function resolveApiKey(providerId: MediaProviderId): string {
  // 1. Tentar ler do cache do banco (provider.apiKey)
  if (_providerCache) {
    const dbProvider = _providerCache.find(p => p.id === providerId)
    if (dbProvider?.apiKey) {
      return dbProvider.apiKey
    }
  }

  // 2. Fallback: ler do process.env via registry
  const registryProvider = MEDIA_PROVIDERS[providerId]
  if (!registryProvider) {
    throw new Error(`[Media Factory] Provider desconhecido: "${providerId}"`)
  }

  const key = process.env[registryProvider.envKey]?.replace(/"/g, '')
  if (!key) {
    throw new Error(
      `[Media Factory] API Key não configurada para "${providerId}". ` +
      `Configure via UI (Settings → Providers) ou defina a variável de ambiente ${registryProvider.envKey}.`
    )
  }
  return key
}

// ─── Funções Públicas ───────────────────────────────────────────

/**
 * Retorna o assignment de uma media task (do cache, fallback para defaults do registry).
 */
export async function getMediaAssignment(taskId: MediaTaskId): Promise<MediaAssignmentData> {
  await ensureInitialized()

  const cached = _assignmentCache.get(taskId)
  if (cached) return cached

  // Fallback: defaults do registry
  const task = MEDIA_TASKS[taskId]
  if (!task) {
    throw new Error(`[Media Factory] Task de mídia desconhecida: "${taskId}"`)
  }

  return {
    taskId,
    provider: task.defaultProvider,
    model: task.defaultModel
  }
}

/**
 * Atualiza o assignment de uma media task (persiste no banco + atualiza cache).
 */
export async function setMediaAssignment(
  taskId: MediaTaskId,
  provider: string,
  model: string,
  extraConfig?: Record<string, unknown>
): Promise<void> {
  await ensureInitialized()

  // Persistir no banco via upsert
  await prisma.mediaAssignment.upsert({
    where: { taskId },
    create: {
      taskId,
      provider,
      model,
      extraConfig: (extraConfig ?? undefined) as any
    },
    update: {
      provider,
      model,
      extraConfig: (extraConfig ?? undefined) as any
    }
  })

  // Atualizar cache
  const data: MediaAssignmentData = { taskId, provider, model, extraConfig }
  _assignmentCache.set(taskId, data)
  console.log(`[Media Factory] 💾 Task "${taskId}" → ${provider}/${model} (persistido)`)
}

/**
 * Retorna todos os media assignments (do cache).
 */
export async function getAllMediaAssignments(): Promise<MediaAssignmentData[]> {
  await ensureInitialized()
  return Array.from(_assignmentCache.values())
}

/**
 * Retorna todos os media providers (category='media') do cache.
 */
export async function getMediaProviders(): Promise<DbMediaProvider[]> {
  await ensureInitialized()
  return _providerCache ?? []
}

/**
 * Retorna a API Key de um media provider (do cache, fallback para process.env).
 */
export async function getMediaProviderApiKey(providerId: MediaProviderId): Promise<string> {
  await ensureInitialized()
  return resolveApiKey(providerId)
}

/**
 * Limpa os caches em memória — chamar após CRUD de providers/assignments.
 */
export function invalidateMediaCache(): void {
  _providerCache = null
  _assignmentCache.clear()
  _initialized = false
  console.log('[Media Factory] 🔄 Cache de mídia invalidado')
}

/**
 * Dado um task ID, retorna o provider ID, modelo e API Key do assignment.
 * Este é o método que o ProviderManager chama para resolver qual provider usar.
 */
export async function getMediaProviderForTask(taskId: MediaTaskId): Promise<MediaProviderForTask> {
  await ensureInitialized()

  const assignment = await getMediaAssignment(taskId)
  const apiKey = resolveApiKey(assignment.provider as MediaProviderId)

  const provider = _providerCache?.find(p => p.id === assignment.provider)
  const modelData = provider?.models?.find(m => m.modelId === assignment.model)

  return {
    providerId: assignment.provider as MediaProviderId,
    model: assignment.model,
    apiKey,
    extraConfig: assignment.extraConfig,
    inputSchema: modelData?.inputSchema ?? null
  }
}

/**
 * Versão SÍNCRONA de getMediaProviderForTask.
 * Lê diretamente do cache em memória (sem await).
 * Retorna null se o cache ainda não foi inicializado (ensureInitialized não rodou).
 *
 * Uso principal: ProviderManager (métodos sync) usa isto para tentar
 * resolver o provider via DB antes de fazer fallback para process.env.
 */
export function getMediaProviderForTaskSync(taskId: string): MediaProviderForTask | null {
  // Cache ainda não foi populado — retornar null para fallback env
  if (!_initialized || !_assignmentCache.size) {
    return null
  }

  const assignment = _assignmentCache.get(taskId)
  if (!assignment) return null

  try {
    const apiKey = resolveApiKey(assignment.provider as MediaProviderId)
    const provider = _providerCache?.find(p => p.id === assignment.provider)
    const modelData = provider?.models?.find(m => m.modelId === assignment.model)
    return {
      providerId: assignment.provider as MediaProviderId,
      model: assignment.model,
      apiKey,
      extraConfig: assignment.extraConfig,
      inputSchema: modelData?.inputSchema ?? null
    }
  } catch {
    // API Key não disponível no cache nem no env — retornar null para fallback
    return null
  }
}

/**
 * Inicializa a factory (pode ser chamado explicitamente no boot do server).
 * Se não chamado, a inicialização ocorre automaticamente no primeiro acesso.
 */
export async function initMediaFactory(): Promise<void> {
  await ensureInitialized()
}
