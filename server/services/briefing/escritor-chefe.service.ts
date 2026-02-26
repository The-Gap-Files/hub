import crypto from 'node:crypto'
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { prisma } from '../../utils/prisma'
import { loadSkill } from '../../utils/skill-loader'
import { buildDossierBlock } from '../../utils/dossier-prompt-block'
import {
  type EscritorChefeBundleV1,
  type EpisodeProse,
  normalizeEscritorChefeBundleV1,
  formatEscritorChefeBundleV1AsSummary,
  DEFAULT_ESCRITOR_CHEFE_GLOBAL_SAFETY,
} from '../../types/escritor-chefe.types'
import { createLlmForTask, getAssignment } from '../llm/llm-factory'
import { costLogService } from '../cost-log.service'
import { calculateLLMCost } from '../../constants/pricing'
import { logLlmResponse, logLlmError } from '../../utils/llm-debug-logger'

const LOG = '[EscritorChefe]'

export interface GenerateEscritorChefeOptions {
  force?: boolean
}

export interface EscritorChefeBundleResult {
  bundle: EscritorChefeBundleV1
  bundleHash: string
  updatedAt: Date
  summary: string
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

// =============================================================================
// Tipos internos para ângulos do monetizador
// =============================================================================

interface MonetizationEpisodeAngle {
  title: string
  hook: string
  angle: string
  structure?: string
  keyPoints?: string[]
  emotionalArc?: string
}

// =============================================================================
// Serviço principal
// =============================================================================

/**
 * Retorna o EscritorChefeBundleV1 do dossier, gerando-o se não existir ou se
 * o dossier tiver mudado (hash inválido).
 *
 * Diferenças do Episode Brief:
 * 1. Gera PROSA NARRATIVA (texto livre) em vez de facts estruturados (JSON)
 * 2. 3 chamadas LLM sequenciais (EP1 → EP2 → EP3) para controle de holdbacks
 * 3. Sem structured output — output é texto Markdown puro
 * 4. Usa ângulos do Monetizador para guiar cada EP
 */
export async function getOrCreateEscritorChefeBundleV1ForDossier(
  dossierId: string,
  options: GenerateEscritorChefeOptions = {}
): Promise<EscritorChefeBundleResult> {
  const force = !!options.force

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      sources: { orderBy: { order: 'asc' } },
      images: { orderBy: { order: 'asc' } },
      notes: { orderBy: { order: 'asc' } },
      persons: { orderBy: { order: 'asc' } },
    },
  })

  if (!dossier) {
    throw createError({ statusCode: 404, message: 'Dossier not found' })
  }

  if (!dossier.sources || dossier.sources.length === 0) {
    throw createError({
      statusCode: 422,
      message: 'Dossiê não possui fontes. Adicione pelo menos 1 fonte antes de gerar prosa.',
    })
  }

  // Hash canônico do dossier
  const dossierBlock = buildDossierBlock({
    theme: dossier.theme,
    title: dossier.title,
    visualIdentityContext: dossier.visualIdentityContext || undefined,
    sources: dossier.sources.map(s => ({
      title: s.title,
      content: s.content,
      type: s.sourceType,
      weight: s.weight ?? 1.0,
    })),
    userNotes: dossier.notes.map(n => n.content),
    imageDescriptions: dossier.images.map(i => i.description).filter(Boolean) as string[],
    persons: dossier.persons.map(p => ({
      name: p.name,
      role: p.role || '',
      description: p.description || '',
      visualDescription: p.visualDescription || '',
      relevance: p.relevance || '',
    })),
  })

  const bundleHash = sha256Hex(dossierBlock)

  // Cache hit
  const hasCached =
    !!dossier.escritorChefeBundleV1 &&
    !!dossier.escritorChefeBundleV1Hash &&
    dossier.escritorChefeBundleV1Hash === bundleHash

  if (hasCached && !force) {
    const bundle = normalizeEscritorChefeBundleV1(dossier.escritorChefeBundleV1)
    return {
      bundle,
      bundleHash,
      updatedAt: dossier.escritorChefeBundleV1UpdatedAt || dossier.updatedAt,
      summary: formatEscritorChefeBundleV1AsSummary(bundle),
    }
  }

  console.log(`${LOG} 📖 Gerando EscritorChefeBundleV1 para dossier=${dossierId} (force=${force})...`)

  // Carregar ângulos do Monetizador
  const episodeAngles = await loadMonetizationAngles(dossierId)

  // Skill prompt (system prompt)
  const systemPrompt = loadSkill('steps/briefing/escritor-chefe')

  const assignment = await getAssignment('briefing-episodes')
  const startTimeTotal = Date.now()
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // ─── Geração sequencial: EP1 → EP2 → EP3 ───

  console.log(`${LOG} ── EP1: Origem + Ascensão ──`)
  const ep1Prose = await generateEpisodeProse({
    episodeNumber: 1,
    dossierBlock,
    systemPrompt,
    assignment,
    episodeAngle: episodeAngles[0] ?? null,
    previousProse: [],
    theme: dossier.theme,
  })
  totalInputTokens += ep1Prose.usage.inputTokens
  totalOutputTokens += ep1Prose.usage.outputTokens

  console.log(`${LOG} ── EP2: Grande Virada ──`)
  const ep2Prose = await generateEpisodeProse({
    episodeNumber: 2,
    dossierBlock,
    systemPrompt,
    assignment,
    episodeAngle: episodeAngles[1] ?? null,
    previousProse: [{ episodeNumber: 1, prose: ep1Prose.prose }],
    theme: dossier.theme,
  })
  totalInputTokens += ep2Prose.usage.inputTokens
  totalOutputTokens += ep2Prose.usage.outputTokens

  console.log(`${LOG} ── EP3: Desfecho + Legado ──`)
  const ep3Prose = await generateEpisodeProse({
    episodeNumber: 3,
    dossierBlock,
    systemPrompt,
    assignment,
    episodeAngle: episodeAngles[2] ?? null,
    previousProse: [
      { episodeNumber: 1, prose: ep1Prose.prose },
      { episodeNumber: 2, prose: ep2Prose.prose },
    ],
    theme: dossier.theme,
  })
  totalInputTokens += ep3Prose.usage.inputTokens
  totalOutputTokens += ep3Prose.usage.outputTokens

  const totalElapsed = ((Date.now() - startTimeTotal) / 1000).toFixed(2)

  // ─── Montar bundle ───

  const bundle = normalizeEscritorChefeBundleV1({
    version: 'escritorChefeBundleV1' as const,
    language: 'pt-BR',
    theme: dossier.theme,
    title: dossier.title,
    globalSafety: DEFAULT_ESCRITOR_CHEFE_GLOBAL_SAFETY,
    sharedContext: buildSharedContext(dossier),
    episodes: {
      ep1: buildEpisodeData(1, ep1Prose.prose, episodeAngles[0] ?? null),
      ep2: buildEpisodeData(2, ep2Prose.prose, episodeAngles[1] ?? null, ep1Prose.coveredTopics),
      ep3: buildEpisodeData(3, ep3Prose.prose, episodeAngles[2] ?? null, [
        ...ep1Prose.coveredTopics,
        ...ep2Prose.coveredTopics,
      ]),
    },
  })

  // Persistir
  const now = new Date()
  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      escritorChefeBundleV1: bundle as any,
      escritorChefeBundleV1Hash: bundleHash,
      escritorChefeBundleV1UpdatedAt: now,
    },
  })

  // Cost log
  const cost = calculateLLMCost(assignment.model, totalInputTokens, totalOutputTokens)
  costLogService.log({
    dossierId,
    resource: 'insights',
    action: 'create',
    provider: assignment.provider.toUpperCase(),
    model: assignment.model,
    cost,
    metadata: {
      task: 'escritor-chefe',
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      total_tokens: totalInputTokens + totalOutputTokens,
      ep1_words: bundle.episodes.ep1.proseWordCount,
      ep2_words: bundle.episodes.ep2.proseWordCount,
      ep3_words: bundle.episodes.ep3.proseWordCount,
    },
    detail: `EscritorChefe 3 EPs em ${totalElapsed}s`,
  }).catch(() => {})

  console.log(
    `${LOG} ✅ EscritorChefeBundleV1 gerado para dossier=${dossierId} | ` +
    `ep1=${bundle.episodes.ep1.proseWordCount}w | ` +
    `ep2=${bundle.episodes.ep2.proseWordCount}w | ` +
    `ep3=${bundle.episodes.ep3.proseWordCount}w | ` +
    `${totalElapsed}s`
  )

  return {
    bundle,
    bundleHash,
    updatedAt: now,
    summary: formatEscritorChefeBundleV1AsSummary(bundle),
  }
}

// =============================================================================
// Geração de um ÚNICO episódio (público — chamado pela API per-episode)
// =============================================================================

export interface SingleEpisodeResult {
  bundle: EscritorChefeBundleV1
  episodeNumber: 1 | 2 | 3
  prose: string
  wordCount: number
  coveredTopics: string[]
  usage: { inputTokens: number; outputTokens: number }
}

/**
 * Gera (ou regenera) a prosa de UM único episódio.
 * Carrega prosa dos EPs anteriores como contexto se necessário.
 * Persiste o bundle atualizado no dossier.
 */
export async function generateSingleEpisodeProse(
  dossierId: string,
  episodeNumber: 1 | 2 | 3,
  options: { force?: boolean } = {}
): Promise<SingleEpisodeResult> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      sources: { orderBy: { order: 'asc' } },
      images: { orderBy: { order: 'asc' } },
      notes: { orderBy: { order: 'asc' } },
      persons: { orderBy: { order: 'asc' } },
    },
  })

  if (!dossier) throw createError({ statusCode: 404, message: 'Dossier not found' })
  if (!dossier.sources?.length) {
    throw createError({ statusCode: 422, message: 'Dossiê sem fontes.' })
  }

  // Carregar bundle existente (se houver)
  let existingBundle: EscritorChefeBundleV1 | null = null
  if (dossier.escritorChefeBundleV1) {
    try {
      existingBundle = normalizeEscritorChefeBundleV1(dossier.escritorChefeBundleV1)
    } catch { /* bundle corrompido, ignorar */ }
  }

  // Validar dependências: EP2 precisa de EP1, EP3 de EP1+EP2
  if (episodeNumber >= 2) {
    const ep1Prose = existingBundle?.episodes?.ep1?.prose
    if (!ep1Prose || ep1Prose.length < 100) {
      throw createError({ statusCode: 422, message: 'Gere o EP1 primeiro antes de gerar o EP2.' })
    }
  }
  if (episodeNumber === 3) {
    const ep2Prose = existingBundle?.episodes?.ep2?.prose
    if (!ep2Prose || ep2Prose.length < 100) {
      throw createError({ statusCode: 422, message: 'Gere o EP2 primeiro antes de gerar o EP3.' })
    }
  }

  const dossierBlock = buildDossierBlock({
    theme: dossier.theme,
    title: dossier.title,
    visualIdentityContext: dossier.visualIdentityContext || undefined,
    sources: dossier.sources.map(s => ({
      title: s.title, content: s.content, type: s.sourceType, weight: s.weight ?? 1.0,
    })),
    userNotes: dossier.notes.map(n => n.content),
    imageDescriptions: dossier.images.map(i => i.description).filter(Boolean) as string[],
    persons: dossier.persons.map(p => ({
      name: p.name, role: p.role || '', description: p.description || '',
      visualDescription: p.visualDescription || '', relevance: p.relevance || '',
    })),
  })

  const bundleHash = sha256Hex(dossierBlock)
  const episodeAngles = await loadMonetizationAngles(dossierId)
  const systemPrompt = loadSkill('steps/briefing/escritor-chefe')
  const assignment = await getAssignment('briefing-episodes')

  // Build previous prose context
  const previousProse: Array<{ episodeNumber: number; prose: string }> = []
  if (episodeNumber >= 2 && existingBundle?.episodes?.ep1?.prose) {
    previousProse.push({ episodeNumber: 1, prose: existingBundle.episodes.ep1.prose })
  }
  if (episodeNumber === 3 && existingBundle?.episodes?.ep2?.prose) {
    previousProse.push({ episodeNumber: 2, prose: existingBundle.episodes.ep2.prose })
  }

  console.log(`${LOG} 📖 Gerando EP${episodeNumber} individual para dossier=${dossierId}...`)

  const result = await generateEpisodeProse({
    episodeNumber,
    dossierBlock,
    systemPrompt,
    assignment,
    episodeAngle: episodeAngles[episodeNumber - 1] ?? null,
    previousProse,
    theme: dossier.theme,
  })

  // Covered topics dos EPs anteriores (para previouslyCoveredTopics)
  const prevCoveredTopics: string[] = []
  if (episodeNumber >= 2 && existingBundle?.episodes?.ep1) {
    prevCoveredTopics.push(...(existingBundle.episodes.ep1.previouslyCoveredTopics || []))
    // Add EP1 headers as covered topics
    const ep1Topics = (existingBundle.episodes.ep1.prose.match(/^##\s+(.+)$/gm) || [])
      .map(h => h.replace(/^##\s+/, '').trim()).filter(t => t.length > 3)
    prevCoveredTopics.push(...ep1Topics)
  }
  if (episodeNumber === 3 && existingBundle?.episodes?.ep2) {
    const ep2Topics = (existingBundle.episodes.ep2.prose.match(/^##\s+(.+)$/gm) || [])
      .map(h => h.replace(/^##\s+/, '').trim()).filter(t => t.length > 3)
    prevCoveredTopics.push(...ep2Topics)
  }

  const newEpData = buildEpisodeData(
    episodeNumber,
    result.prose,
    episodeAngles[episodeNumber - 1] ?? null,
    prevCoveredTopics.length > 0 ? prevCoveredTopics : undefined
  )

  // Merge into bundle
  const epKey = `ep${episodeNumber}` as 'ep1' | 'ep2' | 'ep3'
  const episodes = existingBundle
    ? { ...existingBundle.episodes, [epKey]: newEpData }
    : {
      ep1: episodeNumber === 1 ? newEpData : buildEpisodeData(1, '', null),
      ep2: episodeNumber === 2 ? newEpData : buildEpisodeData(2, '', null),
      ep3: episodeNumber === 3 ? newEpData : buildEpisodeData(3, '', null),
    }

  const bundle = normalizeEscritorChefeBundleV1({
    version: 'escritorChefeBundleV1' as const,
    language: existingBundle?.language || 'pt-BR',
    theme: dossier.theme,
    title: dossier.title,
    globalSafety: existingBundle?.globalSafety || DEFAULT_ESCRITOR_CHEFE_GLOBAL_SAFETY,
    sharedContext: existingBundle?.sharedContext || buildSharedContext(dossier),
    episodes,
  })

  // Persist
  const now = new Date()
  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      escritorChefeBundleV1: bundle as any,
      escritorChefeBundleV1Hash: bundleHash,
      escritorChefeBundleV1UpdatedAt: now,
    },
  })

  // Cost log
  const cost = calculateLLMCost(assignment.model, result.usage.inputTokens, result.usage.outputTokens)
  costLogService.log({
    dossierId,
    resource: 'insights',
    action: 'create',
    provider: assignment.provider.toUpperCase(),
    model: assignment.model,
    cost,
    metadata: { task: 'escritor-chefe-single', episodeNumber, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens },
    detail: `EscritorChefe EP${episodeNumber} individual`,
  }).catch(() => {})

  const wordCount = result.prose.split(/\s+/).length
  console.log(`${LOG} ✅ EP${episodeNumber} individual concluído — ${wordCount} palavras`)

  return {
    bundle,
    episodeNumber,
    prose: result.prose,
    wordCount,
    coveredTopics: result.coveredTopics,
    usage: result.usage,
  }
}

// =============================================================================
// Geração de prosa por episódio (chamada LLM individual — privada)
// =============================================================================

interface GenerateEpisodeProseInput {
  episodeNumber: 1 | 2 | 3
  dossierBlock: string
  systemPrompt: string
  assignment: { provider: string; model: string; temperature?: number }
  episodeAngle: MonetizationEpisodeAngle | null
  previousProse: Array<{ episodeNumber: number; prose: string }>
  theme: string
}

interface GenerateEpisodeProseResult {
  prose: string
  coveredTopics: string[]
  usage: { inputTokens: number; outputTokens: number }
}

async function generateEpisodeProse(input: GenerateEpisodeProseInput): Promise<GenerateEpisodeProseResult> {
  const { episodeNumber, dossierBlock, systemPrompt, assignment, episodeAngle, previousProse, theme } = input

  const model = await createLlmForTask('briefing-episodes', {
    maxTokens: 64000,
    temperature: assignment.temperature ?? 0.4,
  })

  // Build user prompt
  const userPromptParts: string[] = []

  userPromptParts.push(`Escreva a prosa narrativa completa do EP${episodeNumber} sobre "${theme}".`)
  userPromptParts.push(`Idioma: pt-BR`)
  userPromptParts.push('')

  // Episode territory
  const territories: Record<number, string> = {
    1: 'Origem + Ascensão. Resolução: NONE. NÃO revelar virada, traições, desfechos ou destinos finais.',
    2: 'Grande Virada. Resolução: PARTIAL. NÃO revelar desfecho final, destino pós-história ou legado.',
    3: 'Desfecho + Legado. Resolução: FULL. Fechar TODOS os arcos narrativos.',
  }
  userPromptParts.push(`🎬 TERRITÓRIO DO EP${episodeNumber}: ${territories[episodeNumber]}`)
  userPromptParts.push('')

  // Monetization angle (if available)
  if (episodeAngle) {
    userPromptParts.push(`📊 ÂNGULO DO MONETIZADOR:`)
    userPromptParts.push(`- Título: ${episodeAngle.title}`)
    userPromptParts.push(`- Hook: ${episodeAngle.hook}`)
    userPromptParts.push(`- Ângulo: ${episodeAngle.angle}`)
    if (episodeAngle.structure) userPromptParts.push(`- Estrutura: ${episodeAngle.structure}`)
    if (episodeAngle.keyPoints?.length) userPromptParts.push(`- Key Points: ${episodeAngle.keyPoints.join('; ')}`)
    if (episodeAngle.emotionalArc) userPromptParts.push(`- Arco emocional: ${episodeAngle.emotionalArc}`)
    userPromptParts.push('')
  }

  // Previous episodes context (EP2+ receives EP1 prose, EP3 receives EP1+EP2)
  if (previousProse.length > 0) {
    userPromptParts.push(`📖 PROSA DOS EPISÓDIOS ANTERIORES (CONTEXTO — NÃO re-descreva):`)
    for (const prev of previousProse) {
      userPromptParts.push(`\n--- EP${prev.episodeNumber} (já escrito) ---`)
      userPromptParts.push(prev.prose)
    }
    userPromptParts.push('')
    userPromptParts.push(`🚨 REGRA: O espectador JÁ VIU os episódios acima. Pode REFERENCIAR por nome, mas PROIBIDO re-descrever ou elaborar tópicos já cobertos.`)
    userPromptParts.push('')
  }

  // Dossier content
  userPromptParts.push(`📚 DOSSIÊ COMPLETO:`)
  userPromptParts.push(dossierBlock)
  userPromptParts.push('')

  // Volume requirement
  userPromptParts.push(`📏 VOLUME OBRIGATÓRIO: MÍNIMO 5000 palavras (target: 6000-8000). Esta prosa alimenta 150 CENAS de vídeo. Se você escrever menos de 5000 palavras, o vídeo final será curto e superficial.`)
  userPromptParts.push(`Se terminar antes de 5000 palavras, você está RESUMINDO o material. Volte e expanda:`)
  userPromptParts.push(`- Cada evento merece 5-8 parágrafos (contexto, o evento, consequências, reações de cada ator, impacto social, legado)`)
  userPromptParts.push(`- Explore personagens secundários e suas motivações`)
  userPromptParts.push(`- Contextualize cada momento no cenário geopolítico/histórico`)
  userPromptParts.push(`- NÃO repita — EXPANDA em direções diferentes (consequências, reações, desdobramentos)`)
  userPromptParts.push(``)
  userPromptParts.push(`Retorne APENAS prosa narrativa em Markdown (## headers). Sem JSON, sem metadados.`)

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPromptParts.join('\n')),
  ]

  const startTime = Date.now()
  const MIN_WORD_COUNT = 5000
  const MAX_ATTEMPTS = 2

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let currentMessages: Array<SystemMessage | HumanMessage | AIMessage> = [...messages]

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await model.invoke(currentMessages)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

      // Extract text
      const prose = typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join('')
          : String(response.content)

      // Extract usage
      const meta = (response?.response_metadata || {}) as any
      const usageMeta = (response?.usage_metadata || {}) as any
      const inputTokens = meta.promptTokenCount || usageMeta.input_tokens || meta.usage?.input_tokens || 0
      const outputTokens = meta.candidatesTokenCount || usageMeta.output_tokens || meta.usage?.output_tokens || 0
      totalInputTokens += inputTokens
      totalOutputTokens += outputTokens

      const wordCount = prose.split(/\s+/).length
      const blockCount = (prose.match(/^##\s/gm) || []).length

      console.log(`${LOG} ${attempt === 1 ? '✅' : '🔄'} EP${episodeNumber} tentativa ${attempt} em ${elapsed}s — ${wordCount} palavras, ${blockCount} blocos`)

      // Log response for debugging
      logLlmResponse('escritor-chefe', {
        provider: assignment.provider,
        model: assignment.model,
        requestMessages: currentMessages,
        parsed: { prose: prose.substring(0, 500) + '...', wordCount, attempt },
        raw: response,
      }).catch(() => {})

      // Volume check — retry if too short
      if (wordCount < MIN_WORD_COUNT && attempt < MAX_ATTEMPTS) {
        const deficit = MIN_WORD_COUNT - wordCount
        console.log(`${LOG} ⚠️ EP${episodeNumber} com ${wordCount} palavras (mínimo: ${MIN_WORD_COUNT}, faltam ${deficit}). Solicitando expansão...`)

        // Build retry conversation: original messages + AI response + expansion request
        currentMessages = [
          ...messages,
          new AIMessage(prose),
          new HumanMessage(
            `🚨 VOLUME INSUFICIENTE: Sua prosa tem ${wordCount} palavras mas o MÍNIMO é ${MIN_WORD_COUNT} (faltam ${deficit} palavras).\n\n` +
            `Reescreva a prosa COMPLETA do EP${episodeNumber}, desta vez EXPANDINDO significativamente:\n` +
            `- Cada evento mencionado em 1-2 parágrafos deve virar 5-8 parágrafos\n` +
            `- Explore consequências, reações de cada ator, impacto social, contexto geopolítico\n` +
            `- Adicione sub-histórias de personagens secundários\n` +
            `- Aprofunde cada bloco (## header) com mais detalhes concretos: nomes, datas, locais, mecanismos\n` +
            `- NÃO repita — EXPANDA em direções diferentes\n\n` +
            `Retorne a prosa COMPLETA reescrita (não apenas o trecho adicionado). Mínimo ${MIN_WORD_COUNT} palavras.`
          ),
        ]
        continue
      }

      // Extract covered topics from ## headers (for anti-repetition in later EPs)
      const coveredTopics = (prose.match(/^##\s+(.+)$/gm) || [])
        .map(h => h.replace(/^##\s+/, '').trim())
        .filter(t => t.length > 3)

      return {
        prose,
        coveredTopics,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      }
    }

    // Should not reach here, but just in case
    throw new Error(`EP${episodeNumber}: Não atingiu volume mínimo após ${MAX_ATTEMPTS} tentativas`)
  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`${LOG} ❌ Erro no EP${episodeNumber} após ${elapsed}s:`, error?.message || error)

    logLlmError('escritor-chefe', {
      provider: assignment.provider,
      model: assignment.model,
      requestMessages: currentMessages,
      error,
    }).catch(() => {})

    throw error
  }
}

// =============================================================================
// Helpers
// =============================================================================

async function loadMonetizationAngles(dossierId: string): Promise<(MonetizationEpisodeAngle | null)[]> {
  const plan = await prisma.monetizationPlan.findFirst({
    where: { dossierId, isActive: true },
    select: { planData: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!plan?.planData) {
    console.warn(`${LOG} ⚠️ Sem plano de monetização ativo para dossier=${dossierId}. Gerando sem ângulos.`)
    return [null, null, null]
  }

  const planData = plan.planData as any
  const fullVideos = planData.fullVideos || []

  return [1, 2, 3].map(epNum => {
    const ep = fullVideos.find((v: any) => v.episodeNumber === epNum)
    if (!ep) return null
    return {
      title: ep.title || '',
      hook: ep.hook || '',
      angle: ep.angle || '',
      structure: ep.structure,
      keyPoints: ep.keyPoints,
      emotionalArc: ep.emotionalArc,
    }
  })
}

function buildSharedContext(dossier: any): string {
  const parts: string[] = []
  parts.push(`Tema: ${dossier.theme}`)
  if (dossier.title) parts.push(`Título: ${dossier.title}`)
  if (dossier.visualIdentityContext) parts.push(`Universo visual: ${dossier.visualIdentityContext}`)

  // Persons as shared context
  const persons = dossier.persons || []
  if (persons.length > 0) {
    parts.push(`\nPersonagens principais:`)
    for (const p of persons.slice(0, 10)) {
      parts.push(`- ${p.name} (${p.role || 'personagem'}): ${p.description || p.relevance || ''}`)
    }
  }

  return parts.join('\n')
}

function buildEpisodeData(
  episodeNumber: 1 | 2 | 3,
  prose: string,
  angle: MonetizationEpisodeAngle | null,
  previousCoveredTopics?: string[]
): EpisodeProse {
  const territories: Record<number, { fn: string; arc: string; resolution: 'none' | 'partial' | 'full' }> = {
    1: { fn: 'Origem + Ascensão', arc: 'curiosidade → tensão crescente → suspense', resolution: 'none' },
    2: { fn: 'Grande Virada', arc: 'tensão → choque → instabilidade', resolution: 'partial' },
    3: { fn: 'Desfecho + Legado', arc: 'tensão final → resolução → reflexão', resolution: 'full' },
  }

  const territory = territories[episodeNumber]!

  return {
    episodeNumber,
    narrativeFunction: angle?.angle || territory.fn,
    emotionalArc: angle?.emotionalArc || territory.arc,
    resolutionLevel: territory.resolution,
    prose,
    previousEpisodeBridge: episodeNumber === 1
      ? null
      : `Continuação do EP${episodeNumber - 1}`,
    previouslyCoveredTopics: (previousCoveredTopics || []).slice(0, 50),
  }
}
