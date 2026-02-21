import { prisma } from '../../../utils/prisma'
import { getScriptStyleById } from '../../../constants/storytelling/script-styles'
import { getEditorialObjectiveById } from '../../../constants/content/editorial-objectives'
import { getVisualStyleById } from '../../../constants/cinematography/visual-styles'

type PackageCreateResponse = {
  success: true
  planId: string
  fullOutputIds: string[]
  teaserOutputIds: string[]
  relationCount: number
}

/**
 * POST /api/dossiers/[id]/create-youtube-package
 *
 * Cria um pacote YouTube-first no banco:
 * - 3 Outputs VIDEO_FULL (EP1–EP3, YouTube, 16:9, 900s)
 * - 12 Outputs VIDEO_TEASER (YouTube Shorts, 9:16, duração do plano)
 * - Relations teaser_to_full e full_to_teaser (apontando para EP1)
 * - Relations episode_next (EP1 → EP2, EP2 → EP3)
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
  const fullVideos: any[] = Array.isArray(planData?.fullVideos) ? planData.fullVideos : []
  const teasers: any[] = Array.isArray(planData?.teasers) ? planData.teasers : []
  const existingPackage = planData?._youtubePackage as undefined | { fullOutputId?: string; fullOutputIds?: string[]; teaserOutputIds?: string[] }
  const fullTitles = fullVideos.map(v => (typeof v?.title === 'string' ? v.title.trim() : '')).filter(Boolean)

  if (fullVideos.length !== 3) {
    throw createError({
      statusCode: 400,
      message: `Plano de monetização inválido: esperado fullVideos[3], encontrado ${fullVideos.length}`
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
      fullVideos?.[0]?.visualStyleId,
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
  if (!existingPackage && fullTitles.length > 0) {
    const outputs = await prisma.output.findMany({
      where: {
        dossierId,
        monetizationContext: { path: ['planId'], equals: plan.id }
      },
      select: { id: true, outputType: true, format: true, duration: true, createdAt: true, monetizationContext: true }
    })

    const fulls = outputs
      .filter(o => o.outputType === 'VIDEO_FULL' && o.format === 'full-youtube' && o.duration === 900)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    const teaserOutputs = outputs
      .filter(o => o.outputType === 'VIDEO_TEASER' && o.format === 'teaser-youtube-shorts')
      .sort((a, b) => {
        const ai = Number((a.monetizationContext as any)?.teaserIndex ?? 0)
        const bi = Number((b.monetizationContext as any)?.teaserIndex ?? 0)
        return ai - bi
      })

    if (fulls.length >= 1 && teaserOutputs.length === 12) {
      const safePlanData = (planData && typeof planData === 'object') ? planData : {}
      const fullOutputIds = fulls.slice(0, 3).map(o => o.id)
      const teaserOutputIds = teaserOutputs.map(o => o.id)

      await prisma.monetizationPlan.update({
        where: { id: plan.id },
        data: {
          planData: {
            ...(safePlanData as any),
            _youtubePackage: {
              fullOutputIds,
              teaserOutputIds,
              createdAt: new Date().toISOString()
            }
          } as any
        }
      })

      return {
        success: true,
        planId: plan.id,
        fullOutputIds,
        teaserOutputIds,
        relationCount: teaserOutputIds.length * 2
      }
    }
  }

  // Idempotência: se o pacote já foi criado para este plano, retornar (sem recriar outputs)
  const existingFullIds = Array.isArray(existingPackage?.fullOutputIds)
    ? existingPackage?.fullOutputIds
    : (existingPackage?.fullOutputId ? [existingPackage.fullOutputId] : [])

  if (existingFullIds.length > 0 && Array.isArray(existingPackage?.teaserOutputIds) && existingPackage.teaserOutputIds.length > 0) {
    const ids = [...existingFullIds, ...existingPackage.teaserOutputIds].filter(Boolean)
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
        fullOutputIds: existingFullIds,
        teaserOutputIds: existingPackage.teaserOutputIds,
        relationCount: existingPackage.teaserOutputIds.length * 2
      }
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const seedId = await resolveSeedId(tx, resolvedPlanVisualStyleId)

    // ── FULL OUTPUTS (EP1–EP3) ─────────────────────────────────────
    const fullOutputs: any[] = []
    for (let i = 0; i < fullVideos.length; i++) {
      const ep = fullVideos[i]
      const episodeNumber = Number(ep?.episodeNumber || (i + 1))
      const angleCategory = typeof ep?.angleCategory === 'string' ? ep.angleCategory : `episode-${i + 1}`

      const scriptStyleId = resolveScriptStyleId(ep?.scriptStyleId)
      const scriptStyle = getScriptStyleById(scriptStyleId)
      const editorialObjectiveId = (ep?.editorialObjectiveId && getEditorialObjectiveById(ep.editorialObjectiveId)) ? ep.editorialObjectiveId : 'hidden-truth'
      const editorialObjective = getEditorialObjectiveById(editorialObjectiveId)
      const visualStyleId = resolvedPlanVisualStyleId || scriptStyle?.defaultVisualStyleId || 'noir-cinematic'

      const title = typeof ep?.title === 'string' ? ep.title.trim() : ''

      const created = await tx.output.create({
        data: {
          dossierId,
          outputType: 'VIDEO_FULL',
          format: 'full-youtube',
          platform: 'YouTube',
          aspectRatio: '16:9',
          duration: 900,
          title: title || undefined,
          language: 'pt-BR',
          narrationLanguage: 'pt-BR',
          objective: editorialObjective?.instruction || 'Foque no que NÃO está sendo dito. Desmonte a narrativa oficial ponto a ponto, revelando as camadas ocultas.',
          scriptStyleId,
          visualStyleId,
          seedId,
          status: 'PENDING',
          monetizationContext: {
            itemType: 'fullVideo',
            planId: plan.id,
            episodeNumber,
            sceneCount: Number(ep?.sceneCount) || 150,
            title: ep?.title,
            hook: ep?.hook,
            angle: ep?.angle,
            angleCategory,
            strategicNotes: planData?.strategicNotes,
            scriptStyleId: scriptStyleId,
            scriptStyleName: scriptStyle?.name || ep?.scriptStyleName,
            editorialObjectiveId,
            editorialObjectiveName: editorialObjective?.name || ep?.editorialObjectiveName,
          } as any
        }
      })
      fullOutputs.push(created)
    }

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
            episodeNumber: t.targetEpisode || 1,
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
    const episode1Output = fullOutputs[0]
    if (!episode1Output) {
      throw new Error('Pacote inválido: EP1 não foi criado (fullOutputs[0] ausente)')
    }
    // Routing dinâmico: cada teaser aponta pro EP definido em targetEpisode
    const relationsData = teaserOutputs.flatMap((teaser: any, idx: number) => {
      const targetEp = teasers[idx]?.targetEpisode || 1
      const targetOutput = fullOutputs[targetEp - 1] || fullOutputs[0]
      return [
        {
          mainOutputId: teaser.id,
          relatedOutputId: targetOutput.id,
          relationType: 'teaser_to_full'
        },
        {
          mainOutputId: targetOutput.id,
          relatedOutputId: teaser.id,
          relationType: 'full_to_teaser'
        }
      ]
    })

    // EP1 -> EP2, EP2 -> EP3
    const episode2Output = fullOutputs[1]
    const episode3Output = fullOutputs[2]

    if (episode2Output) {
      relationsData.push({
        mainOutputId: episode1Output.id,
        relatedOutputId: episode2Output.id,
        relationType: 'episode_next'
      } as any)
    }
    if (episode2Output && episode3Output) {
      relationsData.push({
        mainOutputId: episode2Output.id,
        relatedOutputId: episode3Output.id,
        relationType: 'episode_next'
      } as any)
    }

    await tx.outputRelation.createMany({ data: relationsData as any })

    // Persistir mapping plano → outputs do pacote
    const safePlanData = (planData && typeof planData === 'object') ? planData : {}
    await tx.monetizationPlan.update({
      where: { id: plan.id },
      data: {
        planData: {
          ...(safePlanData as any),
          _youtubePackage: {
            fullOutputIds: fullOutputs.map((o: any) => o.id),
            teaserOutputIds: teaserOutputs.map((o: any) => o.id),
            createdAt: new Date().toISOString()
          }
        } as any
      }
    })

    return {
      fullOutputIds: fullOutputs.map((o: any) => o.id),
      teaserOutputIds: teaserOutputs.map((o: any) => o.id),
      relationCount: relationsData.length
    }
  })

  return {
    success: true,
    planId: plan.id,
    fullOutputIds: result.fullOutputIds,
    teaserOutputIds: result.teaserOutputIds,
    relationCount: result.relationCount
  }
})

