import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { loadSkill } from '../../utils/skill-loader'
import { buildDossierBlock } from '../../utils/dossier-prompt-block'
import {
  BriefBundleV1Schema,
  type BriefBundleV1,
  DEFAULT_TEASER_GLOBAL_SAFETY,
  formatBriefBundleV1AsDossierBlock
} from '../../types/briefing.types'
import { createLlmForTask, getAssignment } from '../llm/llm-factory'
import { buildCacheableMessages } from '../llm/anthropic-cache-helper'
import { invokeWithLogging } from '../../utils/llm-invoke-wrapper'
import { costLogService } from '../cost-log.service'
import { calculateLLMCost } from '../../constants/pricing'

const LOG = '[Briefing]'

export interface GenerateBriefBundleOptions {
  force?: boolean
}

export interface BriefBundleResult {
  bundle: BriefBundleV1
  bundleHash: string
  updatedAt: Date
  dossierBlockForTeasers: string
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

function normalizeBriefBundleV1(input: unknown): BriefBundleV1 {
  const parsed = BriefBundleV1Schema.parse(input)

  // Garantir que regras hard existam sempre (fallback mínimo).
  // Preferimos “union” (não sobrescrever) para manter ajustes da LLM quando úteis.
  const forbidden = new Set([...(parsed.globalSafety?.forbiddenElements || []), ...DEFAULT_TEASER_GLOBAL_SAFETY.forbiddenElements])
  const allowed = new Set([...(parsed.globalSafety?.allowedArtifacts || []), ...DEFAULT_TEASER_GLOBAL_SAFETY.allowedArtifacts])

  return {
    ...parsed,
    globalSafety: {
      ...parsed.globalSafety,
      forbiddenElements: Array.from(forbidden),
      allowedArtifacts: Array.from(allowed),
      forbiddenNarrationTerms: parsed.globalSafety.forbiddenNarrationTerms || [],
      notes: parsed.globalSafety.notes || []
    }
  }
}

export async function getOrCreateBriefBundleV1ForDossier(
  dossierId: string,
  options: GenerateBriefBundleOptions = {}
): Promise<BriefBundleResult> {
  const force = !!options.force

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      sources: { orderBy: { order: 'asc' } },
      images: { orderBy: { order: 'asc' } },
      notes: { orderBy: { order: 'asc' } },
      persons: { orderBy: { order: 'asc' } }
    }
  })

  if (!dossier) {
    throw createError({ statusCode: 404, message: 'Dossier not found' })
  }

  // Regra de negócio: sem fontes, brief vira hallucination.
  if (!dossier.sources || dossier.sources.length === 0) {
    throw createError({ statusCode: 422, message: 'Dossiê não possui fontes. Adicione pelo menos 1 fonte antes de gerar brief.' })
  }

  // Hash do dossiê canônico (determinístico). Se mudou, brief é inválido.
  const dossierBlock = buildDossierBlock({
    theme: dossier.theme,
    title: dossier.title,
    visualIdentityContext: dossier.visualIdentityContext || undefined,
    sources: dossier.sources.map(s => ({
      title: s.title,
      content: s.content,
      type: s.sourceType,
      weight: s.weight ?? 1.0
    })),
    userNotes: dossier.notes.map(n => n.content),
    imageDescriptions: dossier.images.map(i => i.description).filter(Boolean),
    persons: dossier.persons.map(p => ({
      name: p.name,
      role: p.role || '',
      description: p.description || '',
      visualDescription: p.visualDescription || '',
      relevance: p.relevance || ''
    }))
  })

  const bundleHash = sha256Hex(dossierBlock)

  const hasCached = !!dossier.briefBundleV1 && !!dossier.briefBundleV1Hash && dossier.briefBundleV1Hash === bundleHash
  if (hasCached && !force) {
    const bundle = normalizeBriefBundleV1(dossier.briefBundleV1)
    return {
      bundle,
      bundleHash,
      updatedAt: dossier.briefBundleV1UpdatedAt || dossier.updatedAt,
      dossierBlockForTeasers: formatBriefBundleV1AsDossierBlock(bundle)
    }
  }

  console.log(`${LOG} 🧾 Gerando BriefBundleV1 para dossier=${dossierId} (force=${force})...`)

  const assignment = await getAssignment('briefing-teasers')
  const model = await createLlmForTask('briefing-teasers', { temperature: 0.3, maxTokens: 8192 })

  // Structured output — Gemini tem limitações em response_schema (const, default, etc).
  // jsonMode evita enviar schema à API; parseamos com Zod no client.
  const isGemini = assignment.provider.toLowerCase().includes('gemini') || assignment.provider.toLowerCase().includes('google')
  const isGroqLlama4 = assignment.provider.toLowerCase().includes('groq') && assignment.model.includes('llama-4')
  const method = isGemini ? 'jsonMode' : isGroqLlama4 ? 'jsonMode' : undefined

  const structuredLlm = (model as any).withStructuredOutput(BriefBundleV1Schema, {
    includeRaw: true,
    ...(method ? { method } : {})
  })

  const skill = loadSkill('steps/briefing/bundle-teasers')
  const systemPrompt = skill
  const userPrompt = `Gere o BriefBundleV1 para o dossiê acima.\n\nRegras:\n- Idioma: pt-BR\n- Retorne APENAS JSON válido\n- NÃO invente fatos que não estejam nas fontes\n`

  const cacheResult = buildCacheableMessages({
    dossierBlock,
    systemPrompt,
    taskPrompt: userPrompt,
    providerName: assignment.provider.toLowerCase().includes('anthropic') ? 'ANTHROPIC' : assignment.provider
  })

  const startTime = Date.now()
  const result = await invokeWithLogging(structuredLlm, cacheResult.messages, {
    taskId: 'briefing-teasers',
    provider: assignment.provider,
    model: assignment.model
  })

  const rawMessage = result.raw as any
  const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  const bundle = normalizeBriefBundleV1(result.parsed)

  // Persistir no Dossier
  const now = new Date()
  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      briefBundleV1: bundle as any,
      briefBundleV1Hash: bundleHash,
      briefBundleV1UpdatedAt: now
    }
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
      task: 'briefing-teasers',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens
    },
    detail: `BriefBundleV1 (teasers) em ${elapsed}s`
  }).catch(() => { })

  return {
    bundle,
    bundleHash,
    updatedAt: now,
    dossierBlockForTeasers: formatBriefBundleV1AsDossierBlock(bundle)
  }
}

// -----------------------------------------------------------------------------
// Zod helpers (para uso em handlers)
// -----------------------------------------------------------------------------

export const GenerateBriefBodySchema = z.object({
  force: z.boolean().optional()
})

