import crypto from 'node:crypto'
import { prisma } from '../../utils/prisma'
import { loadSkill } from '../../utils/skill-loader'
import { buildDossierBlock } from '../../utils/dossier-prompt-block'
import {
  EpisodeBriefBundleV1Schema,
  type EpisodeBriefBundleV1,
  normalizeEpisodeBriefBundleV1,
  formatEpisodeBriefBundleV1AsSummary,
} from '../../types/episode-briefing.types'
import { createLlmForTask, getAssignment } from '../llm/llm-factory'
import { buildCacheableMessages } from '../llm/anthropic-cache-helper'
import { invokeWithLogging } from '../../utils/llm-invoke-wrapper'
import { costLogService } from '../cost-log.service'
import { calculateLLMCost } from '../../constants/pricing'
import { sanitizeSchemaForGemini } from '../../utils/gemini-schema-sanitizer'
import { toJsonSchema } from '@langchain/core/utils/json_schema'

const LOG = '[EpisodeBriefing]'

export interface GenerateEpisodeBriefOptions {
  force?: boolean
}

export interface EpisodeBriefBundleResult {
  bundle: EpisodeBriefBundleV1
  bundleHash: string
  updatedAt: Date
  summary: string
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Retorna o EpisodeBriefBundleV1 do dossier, gerando-o se não existir ou se
 * o dossier tiver mudado (hash inválido).
 *
 * Responsabilidade única (SRP): este serviço só conhece briefs de episódios.
 * Briefs de teasers são responsabilidade de briefing.service.ts.
 */
export async function getOrCreateEpisodeBriefBundleV1ForDossier(
  dossierId: string,
  options: GenerateEpisodeBriefOptions = {}
): Promise<EpisodeBriefBundleResult> {
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
      message: 'Dossiê não possui fontes. Adicione pelo menos 1 fonte antes de gerar o Episode Brief.',
    })
  }

  // Hash canônico do dossier — mesma lógica do briefing de teasers para consistência
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

  // Cache hit: retorna bundle salvo se dossier não mudou
  const hasCached =
    !!dossier.episodeBriefBundleV1 &&
    !!dossier.episodeBriefBundleV1Hash &&
    dossier.episodeBriefBundleV1Hash === bundleHash

  if (hasCached && !force) {
    const bundle = normalizeEpisodeBriefBundleV1(dossier.episodeBriefBundleV1)
    return {
      bundle,
      bundleHash,
      updatedAt: dossier.episodeBriefBundleV1UpdatedAt || dossier.updatedAt,
      summary: formatEpisodeBriefBundleV1AsSummary(bundle),
    }
  }

  console.log(`${LOG} 🎬 Gerando EpisodeBriefBundleV1 para dossier=${dossierId} (force=${force})...`)

  const assignment = await getAssignment('briefing-episodes')
  const model = await createLlmForTask('briefing-episodes', { temperature: 0.3, maxTokens: 50000 })

  // Gemini: functionCalling evita limitações de response_schema (const, default).
  // jsonMode foi removido de @langchain/google-genai v2.x — apenas jsonSchema e functionCalling são suportados.
  const isGemini =
    assignment.provider.toLowerCase().includes('gemini') ||
    assignment.provider.toLowerCase().includes('google')
  const isGroqLlama4 =
    assignment.provider.toLowerCase().includes('groq') && assignment.model.includes('llama-4')
  const method = isGemini ? 'functionCalling' : isGroqLlama4 ? 'jsonMode' : undefined

  const structuredLlm = isGemini
    ? (model as any).withStructuredOutput(sanitizeSchemaForGemini(toJsonSchema(EpisodeBriefBundleV1Schema)), {
      includeRaw: true,
      method: 'functionCalling',
      zodSchema: EpisodeBriefBundleV1Schema
    })
    : (model as any).withStructuredOutput(EpisodeBriefBundleV1Schema, {
      includeRaw: true,
      ...(method ? { method } : {}),
    })

  const skill = loadSkill('steps/briefing/bundle-episodes')
  const systemPrompt = skill
  const userPrompt = [
    'Gere o EpisodeBriefBundleV1 para o dossiê acima.',
    '',
    'Regras:',
    '- Idioma: pt-BR',
    '- Retorne APENAS JSON válido no schema EpisodeBriefBundleV1',
    '- NÃO invente fatos que não estejam nas fontes',
    '- Distribua os fatos respeitando a lei narrativa EP1/EP2/EP3',
    '- EP1 deve ter resolutionLevel: "none"',
    '- EP2 deve ter resolutionLevel: "partial"',
    '- EP3 deve ter resolutionLevel: "full"',
    '- ep1.previousEpisodeBridge deve ser null',
  ].join('\n')

  const cacheResult = buildCacheableMessages({
    dossierBlock,
    systemPrompt,
    taskPrompt: userPrompt,
    providerName: assignment.provider.toLowerCase().includes('anthropic') ? 'ANTHROPIC' : assignment.provider,
  })

  const startTime = Date.now()
  const result = await invokeWithLogging(structuredLlm, cacheResult.messages, {
    taskId: 'briefing-episodes',
    provider: assignment.provider,
    model: assignment.model,
  })

  const rawMessage = result.raw as any
  const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  const bundle = normalizeEpisodeBriefBundleV1(result.parsed)

  // Persistir no Dossier
  const now = new Date()
  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      episodeBriefBundleV1: bundle as any,
      episodeBriefBundleV1Hash: bundleHash,
      episodeBriefBundleV1UpdatedAt: now,
    },
  })

  // CostLog
  const cost = calculateLLMCost(assignment.model, inputTokens, outputTokens)
  costLogService.log({
    dossierId,
    resource: 'insights',
    action: 'create',
    provider: assignment.provider.toUpperCase(),
    model: assignment.model,
    cost,
    metadata: {
      task: 'briefing-episodes',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
    detail: `EpisodeBriefBundleV1 em ${elapsed}s`,
  }).catch(() => {})

  console.log(
    `${LOG} ✅ EpisodeBriefBundleV1 gerado para dossier=${dossierId} | ` +
    `ep1=${bundle.episodes.ep1.exclusiveFacts.length}f | ` +
    `ep2=${bundle.episodes.ep2.exclusiveFacts.length}f | ` +
    `ep3=${bundle.episodes.ep3.exclusiveFacts.length}f | ` +
    `${elapsed}s`
  )

  return {
    bundle,
    bundleHash,
    updatedAt: now,
    summary: formatEpisodeBriefBundleV1AsSummary(bundle),
  }
}
