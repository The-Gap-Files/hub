/**
 * POST /api/dossiers/:id/confirm-style-preview
 * 
 * Confirma um preview visual gerado anteriormente.
 * Ao confirmar, o sistema:
 * 1. Cria/encontra a Seed no banco
 * 2. Registra o SeedSample (rastreabilidade universal)
 * 3. Incrementa usageCount da Seed
 * 4. Cria CostLog (ledger financeiro)
 * 5. Marca o preview como confirmed: true no planData
 */

import { prisma } from '../../../utils/prisma'
import { z } from 'zod'

const requestSchema = z.object({
  /** 'fullVideo' ou 'teaser' */
  itemType: z.enum(['fullVideo', 'teaser']),
  /** Índice do teaser (obrigatório quando itemType === 'teaser') */
  teaserIndex: z.number().int().min(0).optional()
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

  // ─── Extrair o item e o preview ──────────────────────────────────
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

  const stylePreview = item?.stylePreview
  if (!stylePreview || !stylePreview.base64) {
    throw createError({ statusCode: 422, statusMessage: 'Nenhum preview pendente para confirmar. Gere um preview primeiro.' })
  }

  if (stylePreview.confirmed) {
    // Já confirmado, retornar sucesso idempotente
    return {
      success: true,
      message: 'Preview já estava confirmado',
      seedId: stylePreview.seedId
    }
  }

  // ─── Criar/encontrar Seed ────────────────────────────────────────
  const seedValue = stylePreview.seedValue as number
  let seedRecord = await prisma.seed.findUnique({ where: { value: seedValue } })

  if (!seedRecord) {
    seedRecord = await prisma.seed.create({
      data: { value: seedValue, usageCount: 0 }
    })
    console.log(`[ConfirmPreview] 🧬 Seed ${seedValue} criada (id: ${seedRecord.id})`)
  }

  // ─── Registrar SeedSample ────────────────────────────────────────
  await prisma.seedSample.create({
    data: {
      seedId: seedRecord.id,
      dossierId,
      source: 'style-preview',
      prompt: item.visualPrompt || '',
      base64: stylePreview.base64,
      mimeType: stylePreview.mimeType || 'image/png',
      provider: 'REPLICATE',
      model: stylePreview.model,
      aspectRatio: '16:9',
      metadata: {
        visualStyleId: stylePreview.visualStyleId || planData.visualStyleId,
        itemKey,
        predictTime: stylePreview.predictTime,
        planId: plan.id
      }
    }
  })

  // ─── Incrementar usageCount ──────────────────────────────────────
  await prisma.seed.update({
    where: { id: seedRecord.id },
    data: { usageCount: { increment: 1 } }
  })

  // ─── CostLog (ledger financeiro) ─────────────────────────────────
  const cost = stylePreview.cost ?? 0

  await prisma.costLog.create({
    data: {
      dossierId,
      resource: 'style-preview',
      action: 'create',
      provider: 'REPLICATE',
      model: stylePreview.model,
      cost,
      detail: `Style preview: ${itemKey} | Seed ${seedValue}`,
      metadata: {
        predictTime: stylePreview.predictTime,
        seedValue,
        visualStyleId: stylePreview.visualStyleId || planData.visualStyleId,
        seedId: seedRecord.id
      }
    }
  })

  // ─── Marcar como confirmado no planData ───────────────────────────
  stylePreview.confirmed = true
  stylePreview.seedId = seedRecord.id

  await prisma.monetizationPlan.update({
    where: { id: plan.id },
    data: { planData }
  })

  console.log(`[ConfirmPreview] ✅ Preview confirmado: ${itemKey} | Seed ${seedValue} (${seedRecord.id}) | Custo: $${cost.toFixed(4)}`)

  return {
    success: true,
    seedId: seedRecord.id,
    seedValue,
    cost
  }
})
