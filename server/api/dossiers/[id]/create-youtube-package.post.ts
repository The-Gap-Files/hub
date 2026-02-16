import { prisma } from '../../../utils/prisma'
import { getScriptStyleById } from '../../../constants/script-styles'
import { getEditorialObjectiveById } from '../../../constants/editorial-objectives'
import { getVisualStyleById } from '../../../constants/visual-styles'

type PackageCreateResponse = {
  success: true
  planId: string
  fullOutputId: string
  teaserOutputIds: string[]
  relationCount: number
}

/**
 * POST /api/dossiers/[id]/create-youtube-package
 *
 * Cria um pacote YouTube-first no banco:
 * - 1 Output VIDEO_FULL (YouTube, 16:9, 900s)
 * - 12 Outputs VIDEO_TEASER (YouTube Shorts, 9:16, duração do plano)
 * - Relations teaser_to_full e full_to_teaser
 *
 * NÃO executa Story Architect nem pipeline. Execução é manual, output por output.
 */
export default defineEventHandler(async (event): Promise<PackageCreateResponse> => {
  const dossierId = getRouterParam(event, 'id')
  if (!dossierId) throw createError({ statusCode: 400, message: 'Dossier ID is required' })

  const body = await readBody(event).catch(() => ({}))
  const planId = typeof body?.planId === 'string' && body.planId.trim() ? body.planId.trim() : undefined

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { channel: true }
  })
  if (!dossier) throw createError({ statusCode: 404, message: 'Dossier not found' })

  const plan = planId
    ? await prisma.monetizationPlan.findUnique({ where: { id: planId } })
    : await prisma.monetizationPlan.findFirst({
      where: { dossierId, isActive: true },
      orderBy: { createdAt: 'desc' }
    })

  if (!plan) {
    throw createError({
      statusCode: 400,
      message: 'Nenhum plano de monetização ativo encontrado para este dossiê'
    })
  }
  if (plan.dossierId !== dossierId) {
    throw createError({
      statusCode: 400,
      message: 'O planId informado não pertence a este dossiê'
    })
  }

  const planData = plan.planData as any
  const full = planData?.fullVideo
  const teasers: any[] = Array.isArray(planData?.teasers) ? planData.teasers : []
  const existingPackage = planData?._youtubePackage as undefined | { fullOutputId?: string; teaserOutputIds?: string[] }
  const fullTitle = typeof full?.title === 'string' ? full.title.trim() : ''

  if (!full) {
    throw createError({
      statusCode: 400,
      message: 'Plano de monetização inválido: campo fullVideo ausente'
    })
  }

  if (teasers.length !== 12) {
    throw createError({
      statusCode: 400,
      message: `Plano de monetização inválido para pacote YouTube: esperado 12 teasers, encontrado ${teasers.length}`
    })
  }

  // Pacote YouTube fixo: 15min + Shorts (usar duração do plano para shorts)
  if (plan.fullVideoDuration !== 900) {
    throw createError({
      statusCode: 400,
      message: `Este pacote exige fullVideoDuration=900 (15min). Plano atual: ${plan.fullVideoDuration}s`
    })
  }

  const resolvedPlanVisualStyleId = (() => {
    const candidates = [
      planData?.visualStyleId,
      full.visualStyleId,
      dossier.preferredVisualStyleId,
      dossier.channel?.defaultVisualStyleId,
      'noir-cinematic'
    ].filter(Boolean)
    for (const id of candidates) {
      if (typeof id === 'string' && getVisualStyleById(id)) return id
    }
    return 'noir-cinematic'
  })()

  const teaserDuration = plan.teaserDuration || 35

  const resolveSeedId = async (tx: any, preferredVisualStyleId?: string) => {
    let seedId: string | null | undefined = dossier.preferredSeedId || dossier.channel?.defaultSeedId
    if (!seedId && preferredVisualStyleId) {
      const randomValue = Math.floor(Math.random() * 2147483647)
      const seedRecord = await tx.seed.upsert({
        where: { value: randomValue },
        update: { usageCount: { increment: 1 } },
        create: { value: randomValue, usageCount: 1 }
      })
      seedId = seedRecord.id
    }
    return seedId ?? undefined
  }

  const resolveScriptStyleId = (candidate?: unknown) => {
    const candidates = [
      typeof candidate === 'string' ? candidate : undefined,
      dossier.channel?.defaultScriptStyleId,
      'documentary'
    ].filter(Boolean) as string[]
    for (const id of candidates) {
      if (getScriptStyleById(id)) return id
    }
    return 'documentary'
  }

  // Backfill: pacote criado anteriormente (antes de persistir _youtubePackage no planData)
  // Heurística segura: procurar o FULL do pacote pelo título + formato + duração, depois coletar relations full_to_teaser.
  if (!existingPackage?.fullOutputId && fullTitle) {
    const maybeFull = await prisma.output.findFirst({
      where: {
        dossierId,
        outputType: 'VIDEO_FULL',
        format: 'full-youtube',
        duration: 900,
        title: fullTitle,
        createdAt: { gte: plan.createdAt }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (maybeFull) {
      const rels = await prisma.outputRelation.findMany({
        where: { mainOutputId: maybeFull.id, relationType: 'full_to_teaser' },
        select: { relatedOutputId: true }
      })
      const teaserIds = rels.map(r => r.relatedOutputId)
      if (teaserIds.length === 12) {
        const found = await prisma.output.findMany({
          where: { id: { in: [maybeFull.id, ...teaserIds] } },
          select: { id: true }
        })
        const foundIds = new Set(found.map(o => o.id))
        const allExist = [maybeFull.id, ...teaserIds].every(id => foundIds.has(id))
        if (allExist) {
          const safePlanData = (planData && typeof planData === 'object') ? planData : {}
          await prisma.monetizationPlan.update({
            where: { id: plan.id },
            data: {
              planData: {
                ...(safePlanData as any),
                _youtubePackage: {
                  fullOutputId: maybeFull.id,
                  teaserOutputIds: teaserIds,
                  createdAt: new Date().toISOString()
                }
              } as any
            }
          })
          return {
            success: true,
            planId: plan.id,
            fullOutputId: maybeFull.id,
            teaserOutputIds: teaserIds,
            relationCount: teaserIds.length * 2
          }
        }
      }
    }
  }

  // Idempotência: se o pacote já foi criado para este plano, retornar (sem recriar outputs)
  if (existingPackage?.fullOutputId && Array.isArray(existingPackage.teaserOutputIds) && existingPackage.teaserOutputIds.length > 0) {
    const ids = [existingPackage.fullOutputId, ...existingPackage.teaserOutputIds].filter(Boolean)
    const found = await prisma.output.findMany({
      where: { id: { in: ids } },
      select: { id: true }
    })
    const foundIds = new Set(found.map(o => o.id))
    const allExist = ids.every(id => foundIds.has(id))
    if (allExist) {
      return {
        success: true,
        planId: plan.id,
        fullOutputId: existingPackage.fullOutputId,
        teaserOutputIds: existingPackage.teaserOutputIds,
        relationCount: existingPackage.teaserOutputIds.length * 2
      }
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const seedId = await resolveSeedId(tx, resolvedPlanVisualStyleId)

    // ── FULL OUTPUT ───────────────────────────────────────────────
    const fullScriptStyleId = resolveScriptStyleId(full?.scriptStyleId)
    const fullScriptStyle = getScriptStyleById(fullScriptStyleId)
    const fullEditorialObjectiveId = (full?.editorialObjectiveId && getEditorialObjectiveById(full.editorialObjectiveId)) ? full.editorialObjectiveId : 'hidden-truth'
    const fullEditorialObjective = getEditorialObjectiveById(fullEditorialObjectiveId)
    const fullVisualStyleId = resolvedPlanVisualStyleId || fullScriptStyle?.defaultVisualStyleId || 'noir-cinematic'

    const fullOutput = await tx.output.create({
      data: {
        dossierId,
        outputType: 'VIDEO_FULL',
        format: 'full-youtube',
        platform: 'YouTube',
        aspectRatio: '16:9',
        duration: 900,
        title: fullTitle || undefined,
        language: 'pt-BR',
        narrationLanguage: 'pt-BR',
        objective: fullEditorialObjective?.instruction || 'Foque no que NÃO está sendo dito. Desmonte a narrativa oficial ponto a ponto, revelando as camadas ocultas.',
        scriptStyleId: fullScriptStyleId,
        visualStyleId: fullVisualStyleId,
        seedId,
        status: 'PENDING',
        monetizationContext: {
          itemType: 'fullVideo',
          planId: plan.id,
          sceneCount: Number(full?.sceneCount) || 150,
          title: full.title,
          hook: full.hook,
          angle: full.angle,
          angleCategory: 'full-video',
          strategicNotes: planData?.strategicNotes,
          scriptStyleId: fullScriptStyleId,
          scriptStyleName: fullScriptStyle?.name || full?.scriptStyleName,
          editorialObjectiveId: fullEditorialObjectiveId,
          editorialObjectiveName: fullEditorialObjective?.name || full?.editorialObjectiveName,
        } as any
      }
    })

    // ── TEASERS (SHORTS) ──────────────────────────────────────────
    const teaserOutputs = []
    for (let i = 0; i < teasers.length; i++) {
      const t = teasers[i]
      const teaserScriptStyleId = resolveScriptStyleId(t?.scriptStyleId)
      const teaserScriptStyle = getScriptStyleById(teaserScriptStyleId)
      const teaserEditorialObjectiveId = (t?.editorialObjectiveId && getEditorialObjectiveById(t.editorialObjectiveId)) ? t.editorialObjectiveId : 'viral-hook'
      const teaserEditorialObjective = getEditorialObjectiveById(teaserEditorialObjectiveId)
      const teaserVisualStyleId = resolvedPlanVisualStyleId || teaserScriptStyle?.defaultVisualStyleId || 'noir-cinematic'

      const resolvedTeaserDuration = t?.narrativeRole === 'hook-only' ? 20 : teaserDuration

      const created = await tx.output.create({
        data: {
          dossierId,
          outputType: 'VIDEO_TEASER',
          format: 'teaser-youtube-shorts',
          platform: 'YouTube Shorts',
          aspectRatio: '9:16',
          duration: resolvedTeaserDuration,
          title: t.title || undefined,
          language: 'pt-BR',
          narrationLanguage: 'pt-BR',
          objective: teaserEditorialObjective?.instruction || 'Otimize para RETENÇÃO e COMPARTILHAMENTO. Comece com um gancho nos primeiros 3 segundos que torna impossível sair.',
          scriptStyleId: teaserScriptStyleId,
          visualStyleId: teaserVisualStyleId,
          seedId,
          status: 'PENDING',
          monetizationContext: {
            itemType: 'teaser',
            planId: plan.id,
            teaserIndex: i,
            sceneCount: Number(t?.sceneCount) || (t?.narrativeRole === 'gateway' ? 5 : t?.narrativeRole === 'hook-only' ? 4 : 6),
            title: t.title,
            hook: t.hook,
            angle: t.angle,
            angleCategory: t.angleCategory,
            narrativeRole: t.narrativeRole,
            shortFormatType: t.shortFormatType,
            microBriefV1: t.microBriefV1,
            scriptOutline: t.scriptOutline,
            cta: t.cta,
            strategicNotes: planData?.strategicNotes,
            scriptStyleId: teaserScriptStyleId,
            scriptStyleName: teaserScriptStyle?.name || t?.scriptStyleName,
            editorialObjectiveId: teaserEditorialObjectiveId,
            editorialObjectiveName: teaserEditorialObjective?.name || t?.editorialObjectiveName,
            avoidPatterns: Array.isArray(t.avoidPatterns) ? t.avoidPatterns : undefined
          } as any
        }
      })
      teaserOutputs.push(created)
    }

    // ── RELAÇÕES ──────────────────────────────────────────────────
    const relationsData = teaserOutputs.flatMap((teaser: any) => ([
      {
        mainOutputId: teaser.id,
        relatedOutputId: fullOutput.id,
        relationType: 'teaser_to_full'
      },
      {
        mainOutputId: fullOutput.id,
        relatedOutputId: teaser.id,
        relationType: 'full_to_teaser'
      }
    ]))

    await tx.outputRelation.createMany({ data: relationsData as any })

    // Persistir mapping plano → outputs do pacote
    const safePlanData = (planData && typeof planData === 'object') ? planData : {}
    await tx.monetizationPlan.update({
      where: { id: plan.id },
      data: {
        planData: {
          ...(safePlanData as any),
          _youtubePackage: {
            fullOutputId: fullOutput.id,
            teaserOutputIds: teaserOutputs.map((o: any) => o.id),
            createdAt: new Date().toISOString()
          }
        } as any
      }
    })

    return {
      fullOutputId: fullOutput.id,
      teaserOutputIds: teaserOutputs.map((o: any) => o.id),
      relationCount: relationsData.length
    }
  })

  return {
    success: true,
    planId: plan.id,
    fullOutputId: result.fullOutputId,
    teaserOutputIds: result.teaserOutputIds,
    relationCount: result.relationCount
  }
})

