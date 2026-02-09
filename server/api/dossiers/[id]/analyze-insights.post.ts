/**
 * POST /api/dossiers/[id]/analyze-insights
 * 
 * Analisa o dossiê via IA e gera automaticamente insights e curiosidades,
 * salvando-os como notas no dossiê.
 */

import { prisma } from '../../../utils/prisma'
import { analyzeInsights } from '../../../services/analyze-insights.service'
import { costLogService } from '../../../services/cost-log.service'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

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

  // Obter config do provider de script
  const config = useRuntimeConfig()
  const scriptConfig = config.providers?.script

  if (!scriptConfig?.apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Script AI provider not configured. Check your .env file.'
    })
  }

  try {
    // Chamar o service de análise
    const result = await analyzeInsights(
      {
        theme: dossier.theme,
        sources: dossier.sources.map(s => ({
          title: s.title,
          content: s.content,
          sourceType: s.sourceType,
          weight: s.weight
        })),
        existingNotes: dossier.notes.map(n => ({
          content: n.content,
          noteType: n.noteType || 'insight'
        })),
        images: dossier.images.map(i => ({
          description: i.description
        })),
        existingPersons: dossier.persons.map(p => ({
          name: p.name
        }))
      },
      {
        name: scriptConfig.name,
        apiKey: scriptConfig.apiKey,
        model: scriptConfig.model
      }
    )

    // Obter a próxima ordem disponível para notas
    const maxNoteOrder = dossier.notes.reduce((max, n) => Math.max(max, n.order), -1)

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
      const maxPersonOrder = dossier.persons.reduce((max, p) => Math.max(max, p.order), -1)

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
    costLogService.logInsightsGeneration({
      dossierId,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      detail: 'Análise neural – insights, curiosidades e pessoas-chave'
    }).catch(err => console.error('[AnalyzeInsights] CostLog:', err))

    return {
      success: true,
      notes: createdNotes,
      persons: createdPersons,
      count: createdNotes.length,
      personsCount: createdPersons.length,
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
