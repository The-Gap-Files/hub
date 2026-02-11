/**
 * POST /api/dossiers/[id]/analyze-insights
 * 
 * Analisa o dossiê via IA e gera automaticamente insights e curiosidades,
 * salvando-os como notas no dossiê.
 */

import { prisma } from '../../../utils/prisma'
import { analyzeInsights } from '../../../services/analyze-insights.service'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({}))
  const clearExisting = body?.clearExisting === true

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Buscar dossiê com relações
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
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  try {
    // Chamar o service de análise (provider/modelo gerenciados pela LLM Factory)
    // Se clearExisting, não enviar existingNotes/existingPersons (serão apagados, IA pode gerar tudo do zero)
    const result = await analyzeInsights(
      {
        theme: dossier.theme,
        sources: dossier.sources.map(s => ({
          title: s.title,
          content: s.content,
          sourceType: s.sourceType,
          weight: s.weight
        })),
        existingNotes: clearExisting ? [] : dossier.notes.map(n => ({
          content: n.content,
          noteType: n.noteType || 'insight'
        })),
        images: dossier.images.map(i => ({
          description: i.description
        })),
        existingPersons: clearExisting ? [] : dossier.persons.map(p => ({
          name: p.name
        }))
      }
    )

    // Se clearExisting, apagar todas as notas e pessoas antes de criar as novas
    if (clearExisting) {
      const [deletedNotes, deletedPersons] = await prisma.$transaction([
        prisma.dossierNote.deleteMany({ where: { dossierId } }),
        prisma.dossierPerson.deleteMany({ where: { dossierId } })
      ])
      console.log(`[AnalyzeInsights] 🗑️ Limpeza: ${deletedNotes.count} notas + ${deletedPersons.count} pessoas removidas`)
    }

    // Obter a próxima ordem disponível para notas (se clearExisting, começa do 0)
    const maxNoteOrder = clearExisting ? -1 : dossier.notes.reduce((max, n) => Math.max(max, n.order), -1)

    // Salvar cada item como nota no dossiê
    const createdNotes = await prisma.$transaction(
      result.items.map((item, index) =>
        prisma.dossierNote.create({
          data: {
            dossierId,
            content: item.content,
            noteType: item.noteType,
            order: maxNoteOrder + 1 + index
          }
        })
      )
    )

    // Salvar pessoas extraídas como DossierPerson
    let createdPersons: any[] = []
    if (result.persons.length > 0) {
      const maxPersonOrder = clearExisting ? -1 : dossier.persons.reduce((max, p) => Math.max(max, p.order), -1)

      createdPersons = await prisma.$transaction(
        result.persons.map((person, index) =>
          prisma.dossierPerson.create({
            data: {
              dossierId,
              name: person.name,
              role: person.role || null,
              description: person.description || null,
              visualDescription: person.visualDescription || null,
              aliases: person.aliases || [],
              relevance: person.relevance || 'secondary',
              order: maxPersonOrder + 1 + index
            }
          })
        )
      )
      console.log(`[AnalyzeInsights] 👤 ${createdPersons.length} pessoas salvas no dossiê ${dossierId}`)
    }

    console.log(`[AnalyzeInsights] 💾 ${createdNotes.length} notas salvas no dossiê ${dossierId}`)

    // Registrar custo da análise neural (fire-and-forget)
    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const cost = calculateLLMCost(result.model, inputTokens, outputTokens)

    costLogService.log({
      dossierId,
      resource: 'insights',
      action: 'create',
      provider: result.provider,
      model: result.model,
      cost,
      metadata: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
      detail: 'Análise neural – insights, curiosidades e pessoas-chave'
    }).catch(err => console.error('[AnalyzeInsights] CostLog:', err))

    return {
      success: true,
      notes: createdNotes,
      persons: createdPersons,
      count: createdNotes.length,
      personsCount: createdPersons.length,
      cleared: clearExisting,
      usage: result.usage,
      provider: result.provider,
      model: result.model
    }
  } catch (error: any) {
    console.error('[AnalyzeInsights] ❌ Erro:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao analisar dossiê via IA'
    })
  }
})
