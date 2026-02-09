/**
 * PATCH /api/persons/[id]
 * 
 * Atualiza parcialmente uma pessoa-chave do dossiê.
 */

import { z } from 'zod'
import { prisma } from '../../utils/prisma'

const UpdatePersonSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  visualDescription: z.string().nullable().optional(),
  aliases: z.array(z.string()).optional(),
  relevance: z.enum(['primary', 'secondary', 'mentioned']).optional(),
  order: z.number().int().min(0).optional()
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Person ID is required'
    })
  }

  const existing = await prisma.dossierPerson.findUnique({
    where: { id }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Person not found'
    })
  }

  const body = await readBody(event)
  const data = UpdatePersonSchema.parse(body)

  const person = await prisma.dossierPerson.update({
    where: { id },
    data
  })

  return person
})
