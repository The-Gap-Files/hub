/**
 * POST /api/dossiers/:id/generate-style-preview
 * 
 * Gera uma imagem de preview visual para um item do plano de monetização.
 * O usuário escolhe uma seed (existente ou aleatória) e o sistema gera
 * uma imagem usando o visualPrompt produzido pela LangChain.
 * 
 * A imagem retorna como base64 e fica armazenada no planData JSON.
 * A seed só é persistida no banco se o usuário aprovar.
 */

import { prisma } from '../../../utils/prisma'
import { ReplicateImageProvider } from '../../../services/providers'
import { getVisualStyleById } from '../../../constants/cinematography/visual-styles'
import { z } from 'zod'

const requestSchema = z.object({
  /** 'fullVideo' ou índice do teaser (0, 1, 2...) */
  itemType: z.enum(['fullVideo', 'teaser']),
  /** Índice do teaser (obrigatório quando itemType === 'teaser') */
  teaserIndex: z.number().int().min(0).optional(),
  /** Valor numérico da seed para a geração */
  seedValue: z.number().int().min(0),
  /** Se a seed é de um registro existente no banco (para incrementar usageCount) */
  seedId: z.string().uuid().optional(),
  /** Aspect ratio desejado (padrão 16:9 para preview) */
  aspectRatio: z.string().default('16:9')
})

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({ statusCode: 400, statusMessage: 'ID do dossiê é obrigatório' })
  }

  const rawBody = await readBody(event)
  const body = requestSchema.parse(rawBody)

  // ─── Buscar plano ativo ──────────────────────────────────────────
  const plan = await prisma.monetizationPlan.findFirst({
    where: { dossierId, isActive: true },
    orderBy: { createdAt: 'desc' }
  })

  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Nenhum plano de monetização ativo encontrado' })
  }

  const planData = plan.planData as any

  // ─── Extrair o item e o visualPrompt ─────────────────────────────
  let item: any
  let itemKey: string

  if (body.itemType === 'fullVideo') {
    item = planData.fullVideo
    itemKey = 'fullVideo'
  } else {
    if (body.teaserIndex === undefined || body.teaserIndex === null) {
      throw createError({ statusCode: 400, statusMessage: 'teaserIndex é obrigatório para tipo teaser' })
    }
    if (!planData.teasers?.[body.teaserIndex]) {
      throw createError({ statusCode: 404, statusMessage: `Teaser #${body.teaserIndex} não encontrado no plano` })
    }
    item = planData.teasers[body.teaserIndex]
    itemKey = `teasers.${body.teaserIndex}`
  }

  const visualPrompt = item?.visualPrompt
  if (!visualPrompt) {
    throw createError({ statusCode: 422, statusMessage: 'Este item não possui visualPrompt. Regenere o plano para incluí-lo.' })
  }

  // ─── Enriquecer prompt com estilo visual (nível do plano) ──────
  const visualStyleId = planData.visualStyleId
  const visualStyle = visualStyleId ? getVisualStyleById(visualStyleId) : null

  // ─── Config do provider ──────────────────────────────────────────
  const config = useRuntimeConfig()
  const imageConfig = config.providers?.image as any

  if (!imageConfig?.apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'Provider de imagem não configurado' })
  }

  // ─── Gerar imagem ────────────────────────────────────────────────
  const provider = new ReplicateImageProvider({
    apiKey: imageConfig.apiKey,
    model: imageConfig.model
  })

  console.log(`[StylePreview] 🎨 Gerando preview para ${itemKey} | Seed: ${body.seedValue} | Style: ${visualStyleId || 'default'}`)

  const startTime = Date.now()

  const result = await provider.generate({
    prompt: visualPrompt,
    style: visualStyle?.baseStyle || undefined,
    seed: body.seedValue,
    aspectRatio: body.aspectRatio,
    width: 1024,
    height: body.aspectRatio === '9:16' ? 1820 : body.aspectRatio === '1:1' ? 1024 : 576,
    numVariants: 1
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  if (!result.images?.length) {
    throw createError({ statusCode: 500, statusMessage: 'Nenhuma imagem retornada pelo modelo' })
  }

  const image = result.images[0]!
  const base64 = image.buffer.toString('base64')
  const mimeType = 'image/png'

  console.log(`[StylePreview] ✅ Preview gerado em ${elapsed}s | ${(base64.length / 1024).toFixed(0)}KB base64`)

  // ─── Calcular custo (informativo, sem persistir ainda) ──────────
  const predictTime = result.predictTime ?? 0
  const costPerSec = 0.0023 // Replicate GPU cost approximation
  const cost = predictTime * costPerSec

  // ─── Salvar preview TEMPORÁRIO no planData ────────────────────────
  // confirmed: false → seed/sample/costLog só são criados na confirmação
  const stylePreview = {
    base64,
    mimeType,
    seedValue: body.seedValue,
    seedId: null as string | null,       // Será preenchido na confirmação
    confirmed: false,                     // Flag de confirmação pendente
    model: result.model || imageConfig.model,
    predictTime,
    cost,
    visualStyleId,
    generatedAt: new Date().toISOString()
  }

  // Atualizar o item no planData
  if (body.itemType === 'fullVideo') {
    planData.fullVideo.stylePreview = stylePreview
  } else {
    planData.teasers[body.teaserIndex!].stylePreview = stylePreview
  }

  await prisma.monetizationPlan.update({
    where: { id: plan.id },
    data: { planData }
  })

  console.log(`[StylePreview] 💰 Custo estimado: $${cost.toFixed(4)} | predictTime: ${predictTime.toFixed(2)}s | ⏳ Aguardando confirmação`)

  return {
    success: true,
    preview: {
      base64: `data:${mimeType};base64,${base64}`,
      seedValue: body.seedValue,
      confirmed: false,
      model: result.model,
      predictTime
    },
    cost
  }
})
