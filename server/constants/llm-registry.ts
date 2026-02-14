/**
 * LLM Registry - SEED & FALLBACK ONLY
 * 
 * Este arquivo serve APENAS como dados iniciais (seed) para popular o banco
 * na primeira execução. Após o seed, providers e modelos são gerenciados
 * via banco de dados (tabelas llm_providers + llm_models) e a UI em /settings/providers.
 * 
 * NÃO edite este arquivo para adicionar novos providers/modelos — use a UI.
 * Este registry é usado como fallback se o banco estiver vazio.
 * 
 * @see server/services/llm/llm-factory.ts (seedProvidersAndModels)
 */

// ─── Tipos ──────────────────────────────────────────────────────

export type LlmProviderId = 'openai' | 'anthropic' | 'groq' | 'gemini' | 'replicate'

/** Tarefas que usam LLM — cada uma pode ter provider/modelo independente */
export type LlmTaskId =
  | 'script'              // Geração de roteiro completo
  | 'analysis'            // Análise de insights neurais
  | 'story-architect'     // Planejamento narrativo / outline
  | 'story-validator'     // Validação de outline (checa aderência a regras narrativas)
  | 'script-validator'    // Validação de roteiro final (checa resolução, open loops, duração)
  | 'monetization'        // Plano de monetização
  | 'monetization-validator' // Validação do plano de monetização (diversidade, coerência, funil)
  | 'intelligence-query'  // Consulta manual ao dossiê
  | 'creative-direction'  // Consultoria de direção criativa
  | 'merge'               // Merge inteligente de prompts visuais
  | 'summarize'           // Resumo de fontes do dossiê
  | 'sanitize'            // Reescrita de prompts bloqueados por filtro
  | 'thumbnail-prompt'    // Geração de prompts para thumbnails
  | 'social-kit'          // Kit de publicação para redes sociais
  | 'deep-research-prompt' // Gera prompt otimizado para Deep Research
  | 'dossier-investigator'  // Investiga uma semente e preenche metadados do dossiê

export interface LlmModel {
  id: string
  name: string
  contextWindow: number
  /** Custo relativo: 1 = barato, 5 = caro */
  costTier: 1 | 2 | 3 | 4 | 5
  /** Suporta structured output (JSON mode / tool calling)? */
  supportsStructuredOutput: boolean
  /** Suporta visão (imagens no prompt)? */
  supportsVision: boolean
}

export interface LlmProvider {
  id: LlmProviderId
  name: string
  description: string
  /** Variável de ambiente da API Key */
  envKey: string
  iconKey: string
  models: LlmModel[]
}

export interface LlmTask {
  id: LlmTaskId
  label: string
  description: string
  iconKey: string
  /** Precisa de structured output (JSON)? */
  requiresStructuredOutput: boolean
  /** Precisa de context window grande? */
  requiresLargeContext: boolean
  /** Provider/modelo padrão (fallback) */
  defaultProvider: LlmProviderId
  defaultModel: string
}

// ─── Providers ──────────────────────────────────────────────────

export const LLM_PROVIDERS: Record<LlmProviderId, LlmProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o Mini — Alta qualidade criativa, structured output robusto',
    envKey: 'OPENAI_API_KEY',
    iconKey: 'brain',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, costTier: 4, supportsStructuredOutput: true, supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, costTier: 2, supportsStructuredOutput: true, supportsVision: true },
      { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1047576, costTier: 4, supportsStructuredOutput: true, supportsVision: true },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextWindow: 1047576, costTier: 2, supportsStructuredOutput: true, supportsVision: true },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', contextWindow: 1047576, costTier: 1, supportsStructuredOutput: true, supportsVision: true },
      { id: 'o3-mini', name: 'o3 Mini (Reasoning)', contextWindow: 200000, costTier: 3, supportsStructuredOutput: true, supportsVision: false }
    ]
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet, Haiku — Excelente em instrução-following e criatividade',
    envKey: 'ANTHROPIC_API_KEY',
    iconKey: 'sparkles',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, costTier: 4, supportsStructuredOutput: true, supportsVision: true },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', contextWindow: 200000, costTier: 2, supportsStructuredOutput: true, supportsVision: true }
    ]
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Inferência ultrarrápida (~10x) — Llama 3, Mixtral, DeepSeek via hardware LPU',
    envKey: 'GROQ_API_KEY',
    iconKey: 'zap',
    models: [
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', contextWindow: 131072, costTier: 1, supportsStructuredOutput: true, supportsVision: false },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', contextWindow: 131072, costTier: 2, supportsStructuredOutput: true, supportsVision: false },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, costTier: 2, supportsStructuredOutput: true, supportsVision: false },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000, costTier: 1, supportsStructuredOutput: true, supportsVision: false },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', contextWindow: 128000, costTier: 2, supportsStructuredOutput: true, supportsVision: false },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, costTier: 1, supportsStructuredOutput: true, supportsVision: false },
      { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', contextWindow: 131072, costTier: 1, supportsStructuredOutput: true, supportsVision: true },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', contextWindow: 131072, costTier: 1, supportsStructuredOutput: true, supportsVision: true }
    ]
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro e Flash — multimodal, contexto longo, integração Google',
    envKey: 'GOOGLE_API_KEY',
    iconKey: 'brain',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, costTier: 1, supportsStructuredOutput: true, supportsVision: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, costTier: 1, supportsStructuredOutput: true, supportsVision: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, costTier: 3, supportsStructuredOutput: true, supportsVision: true },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', contextWindow: 1000000, costTier: 1, supportsStructuredOutput: true, supportsVision: true }
    ]
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    description: 'Llama 4 Maverick via Replicate — 17B params, 128 experts, multimodal, contexto longo',
    envKey: 'REPLICATE_API_TOKEN',
    iconKey: 'cpu',
    models: [
      { id: 'meta/llama-4-maverick-instruct', name: 'Llama 4 Maverick 17B', contextWindow: 1048576, costTier: 1, supportsStructuredOutput: false, supportsVision: true }
    ]
  }
}

// ─── Tasks ──────────────────────────────────────────────────────

export const LLM_TASKS: Record<LlmTaskId, LlmTask> = {
  script: {
    id: 'script',
    label: 'Geração de Roteiro',
    description: 'Cria o roteiro completo do vídeo — cenas, narração, visual, música. Requer alta qualidade criativa.',
    iconKey: 'film',
    requiresStructuredOutput: true,
    requiresLargeContext: true,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514'
  },
  analysis: {
    id: 'analysis',
    label: 'Análise de Insights',
    description: 'Analisa o dossiê e extrai insights, pessoas-chave e conexões. Velocidade > criatividade.',
    iconKey: 'scan',
    requiresStructuredOutput: true,
    requiresLargeContext: true,
    defaultProvider: 'groq',
    defaultModel: 'openai/gpt-oss-20b'
  },
  'story-architect': {
    id: 'story-architect',
    label: 'Arquiteto de Narrativa',
    description: 'Planeja a estrutura narrativa e sugere caminhos para o roteiro. Equilíbrio criativo/analítico.',
    iconKey: 'git-branch',
    requiresStructuredOutput: true,
    requiresLargeContext: true,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514'
  },
  'story-validator': {
    id: 'story-validator',
    label: 'Validador de Narrativa',
    description: 'Valida outlines contra regras de role e ângulo narrativo. Tarefa analítica que exige precisão, não criatividade.',
    iconKey: 'check-circle',
    requiresStructuredOutput: true,
    requiresLargeContext: false,
    defaultProvider: 'groq',
    defaultModel: 'openai/gpt-oss-20b'
  },
  'script-validator': {
    id: 'script-validator',
    label: 'Validador de Roteiro',
    description: 'Valida roteiro final contra regras de resolução, open loops e duração. Verifica se shorts não resolvem demais.',
    iconKey: 'file-check',
    requiresStructuredOutput: true,
    requiresLargeContext: false,
    defaultProvider: 'groq',
    defaultModel: 'openai/gpt-oss-20b'
  },
  monetization: {
    id: 'monetization',
    label: 'Plano de Monetização',
    description: 'Gera estratégia de monetização e variantes de conteúdo. Velocidade priorizada.',
    iconKey: 'dollar-sign',
    requiresStructuredOutput: true,
    requiresLargeContext: false,
    defaultProvider: 'gemini',
    defaultModel: 'gemini-2.0-flash'
  },
  'monetization-validator': {
    id: 'monetization-validator',
    label: 'Validador de Monetização',
    description: 'Valida plano de monetização contra regras de diversidade, coerência role×format e estratégia de funil.',
    iconKey: 'shield-check',
    requiresStructuredOutput: true,
    requiresLargeContext: false,
    defaultProvider: 'groq',
    defaultModel: 'openai/gpt-oss-20b'
  },
  'intelligence-query': {
    id: 'intelligence-query',
    label: 'Consulta de Inteligência',
    description: 'Responde perguntas sobre o dossiê em tempo real. Velocidade é crítica.',
    iconKey: 'message-circle',
    requiresStructuredOutput: false,
    requiresLargeContext: true,
    defaultProvider: 'groq',
    defaultModel: 'openai/gpt-oss-20b'
  },
  'creative-direction': {
    id: 'creative-direction',
    label: 'Direção Criativa',
    description: 'Aconselha sobre direção criativa, estilo e tom do conteúdo.',
    iconKey: 'palette',
    requiresStructuredOutput: true,
    requiresLargeContext: false,
    defaultProvider: 'groq',
    defaultModel: 'openai/gpt-oss-20b'
  },
  merge: {
    id: 'merge',
    label: 'Merge de Prompts',
    description: 'Merge inteligente de prompts visuais com estilos — remove redundâncias e gera prompts naturais. Tarefa leve e rápida.',
    iconKey: 'layers',
    requiresStructuredOutput: false,
    requiresLargeContext: false,
    defaultProvider: 'groq',
    defaultModel: 'openai/gpt-oss-20b'
  },
  summarize: {
    id: 'summarize',
    label: 'Resumo de Fontes',
    description: 'Resume conteúdo de fontes do dossiê, incluindo estratégia Map-Reduce para textos longos.',
    iconKey: 'file-text',
    requiresStructuredOutput: false,
    requiresLargeContext: true,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514'
  },
  sanitize: {
    id: 'sanitize',
    label: 'Sanitização de Prompts',
    description: 'Reescreve prompts visuais bloqueados por filtros de conteúdo em nível de segurança escolhido.',
    iconKey: 'shield',
    requiresStructuredOutput: false,
    requiresLargeContext: false,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514'
  },
  'thumbnail-prompt': {
    id: 'thumbnail-prompt',
    label: 'Prompts de Thumbnail',
    description: 'Gera prompts de imagem + hook texts para thumbnails virais. Requer criatividade alta.',
    iconKey: 'image',
    requiresStructuredOutput: false,
    requiresLargeContext: false,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-haiku-3-5-20241022'
  },
  'social-kit': {
    id: 'social-kit',
    label: 'Kit Social Media',
    description: 'Gera títulos, descrições, hashtags e SEO tags otimizados por plataforma (YouTube, TikTok, Instagram).',
    iconKey: 'share-2',
    requiresStructuredOutput: false,
    requiresLargeContext: false,
    defaultProvider: 'anthropic',
    defaultModel: 'claude-haiku-3-5-20241022'
  },
  'deep-research-prompt': {
    id: 'deep-research-prompt',
    label: 'Prompt de Deep Research',
    description: 'Gera prompt de pesquisa otimizado para o Gemini Deep Research, baseado nos metadados do dossiê.',
    iconKey: 'search',
    requiresStructuredOutput: false,
    requiresLargeContext: false,
    defaultProvider: 'groq',
    defaultModel: 'openai/gpt-oss-20b'
  },
  'dossier-investigator': {
    id: 'dossier-investigator',
    label: 'Investigador de Dossiê',
    description: 'Investiga uma semente (palavra, pessoa, tema) na web e gera todos os metadados para criação de dossiê.',
    iconKey: 'search',
    requiresStructuredOutput: true,
    requiresLargeContext: false,
    defaultProvider: 'gemini',
    defaultModel: 'gemini-2.0-flash'
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** Retorna todos os providers como array */
export function getLlmProviders(): LlmProvider[] {
  return Object.values(LLM_PROVIDERS)
}

/** Retorna todas as tasks como array */
export function getLlmTasks(): LlmTask[] {
  return Object.values(LLM_TASKS)
}

/** Busca um provider pelo ID */
export function getLlmProvider(id: string): LlmProvider | undefined {
  return LLM_PROVIDERS[id as LlmProviderId]
}

/** Busca uma task pelo ID */
export function getLlmTask(id: string): LlmTask | undefined {
  return LLM_TASKS[id as LlmTaskId]
}

/** Busca um modelo específico de um provider */
export function getLlmModel(providerId: string, modelId: string): LlmModel | undefined {
  const provider = getLlmProvider(providerId)
  return provider?.models.find(m => m.id === modelId)
}

/** Valida se a combinação provider/modelo é válida */
export function isValidLlmConfig(providerId: string, modelId: string): boolean {
  return !!getLlmModel(providerId, modelId)
}
