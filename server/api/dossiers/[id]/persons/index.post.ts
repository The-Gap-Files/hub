/**
 * POST /api/dossiers/[id]/persons
 * 
 * Adiciona manualmente uma pessoa-chave ao dossiê.
 */

import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'

const CreatePersonSchema = z.object({
  name: z.string().min(1).max(255),
  role: z.string().max(100).optional(),
  description: z.string().optional(),
  visualDescription: z.string().optional(),
  aliases: z.array(z.string()).optional().default([]),
  relevance: z.enum(['primary', 'secondary', 'mentioned']).optional().default('secondary'),
  order: z.number().int().min(0).optional()
})

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { id: true }
  })

  if (!dossier) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  const body = await readBody(event)
  const data = CreatePersonSchema.parse(body)

  // Auto-calcular order se não fornecido
  let order = data.order
  if (order === undefined) {
    const maxOrder = await prisma.dossierPerson.aggregate({
      where: { dossierId },
      _max: { order: true }
    })
    order = (maxOrder._max.order ?? -1) + 1
  }

  const person = await prisma.dossierPerson.create({
    data: {
      dossierId,
      name: data.name,
      role: data.role || null,
      description: data.description || null,
      visualDescription: data.visualDescription || null,
      aliases: data.aliases,
      relevance: data.relevance,
      order
    }
  })

  return person
})
