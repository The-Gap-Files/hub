/**
 * GET /api/dossiers/[id]/persons
 * 
 * Lista todas as pessoas-chave de um dossiê.
 */

import { prisma } from '../../../../utils/prisma'

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

  const persons = await prisma.dossierPerson.findMany({
    where: { dossierId },
    orderBy: [
      { relevance: 'asc' }, // primary first
      { order: 'asc' }
    ]
  })

  return { data: persons }
})
