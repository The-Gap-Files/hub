import { prisma } from '../../../utils/prisma'
import { getScriptStyleById } from '../../../constants/script-styles'
import { getVisualStyleById } from '../../../constants/visual-styles'
import { getEditorialObjectiveById } from '../../../constants/editorial-objectives'

type Body = {
  scriptStyleId?: string | null
  visualStyleId?: string | null
  editorialObjectiveId?: string | null
  objective?: string | null
  mustInclude?: string | null
  mustExclude?: string | null
  language?: string | null
  narrationLanguage?: string | null
  seedValue?: number | null
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Output ID is required' })

  const body = (await readBody(event).catch(() => ({}))) as Body

  const existing = await prisma.output.findUnique({
    where: { id },
    select: { id: true, seedId: true, monetizationContext: true }
  })
  if (!existing) throw createError({ statusCode: 404, message: 'Output not found' })

  const data: any = {}
  const currentMonetizationContext = (existing.monetizationContext && typeof existing.monetizationContext === 'object')
    ? (existing.monetizationContext as any)
    : {}
  let nextMonetizationContext: any | null = null

  // ── Constantes (validadas contra catálogo) ─────────────────────
  if (body.scriptStyleId !== undefined) {
    if (body.scriptStyleId === null || body.scriptStyleId === '') {
      data.scriptStyleId = null
    } else if (!getScriptStyleById(body.scriptStyleId)) {
      throw createError({ statusCode: 400, message: `scriptStyleId inválido: ${body.scriptStyleId}` })
    } else {
      data.scriptStyleId = body.scriptStyleId
    }
  }

  if (body.visualStyleId !== undefined) {
    if (body.visualStyleId === null || body.visualStyleId === '') {
      data.visualStyleId = null
    } else if (!getVisualStyleById(body.visualStyleId)) {
      throw createError({ statusCode: 400, message: `visualStyleId inválido: ${body.visualStyleId}` })
    } else {
      data.visualStyleId = body.visualStyleId
    }
  }

  // ── Objective: pode vir do preset OU texto livre ───────────────
  if (body.objective !== undefined) {
    data.objective = body.objective === null ? null : String(body.objective)
  }

  // editorialObjectiveId: persistir no output (via monetizationContext) + opcionalmente preencher objective
  if (body.editorialObjectiveId !== undefined) {
    if (body.editorialObjectiveId === null || body.editorialObjectiveId === '') {
      nextMonetizationContext = { ...currentMonetizationContext }
      delete nextMonetizationContext.editorialObjectiveId
      delete nextMonetizationContext.editorialObjectiveName
    } else {
      const preset = getEditorialObjectiveById(body.editorialObjectiveId)
      if (!preset) throw createError({ statusCode: 400, message: `editorialObjectiveId inválido: ${body.editorialObjectiveId}` })

      nextMonetizationContext = {
        ...currentMonetizationContext,
        editorialObjectiveId: preset.id,
        editorialObjectiveName: preset.name
      }

      // Se objective não veio explícito, usar instruction do preset
      if (body.objective === undefined) {
        data.objective = preset.instruction
      }
    }
  }

  if (body.mustInclude !== undefined) data.mustInclude = body.mustInclude === null ? null : String(body.mustInclude)
  if (body.mustExclude !== undefined) data.mustExclude = body.mustExclude === null ? null : String(body.mustExclude)

  if (body.language !== undefined) data.language = body.language === null ? null : String(body.language)
  if (body.narrationLanguage !== undefined) data.narrationLanguage = body.narrationLanguage === null ? null : String(body.narrationLanguage)

  // ── Seed: recebe value (int), resolve para seedId (uuid) ───────
  if (body.seedValue !== undefined) {
    if (body.seedValue === null) {
      data.seedId = null
    } else if (!Number.isFinite(body.seedValue)) {
      throw createError({ statusCode: 400, message: 'seedValue inválido (precisa ser number)' })
    } else {
      const value = Math.floor(body.seedValue)
      const seed = await prisma.seed.upsert({
        where: { value },
        update: { usageCount: { increment: 1 } },
        create: { value, usageCount: 1 },
        select: { id: true }
      })
      data.seedId = seed.id
    }
  }

  if (nextMonetizationContext) {
    data.monetizationContext = nextMonetizationContext
  }

  const updated = await prisma.output.update({
    where: { id },
    data
  })

  return { success: true, data: updated }
})

