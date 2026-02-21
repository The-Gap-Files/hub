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
    select: {
      id: true, dossierId: true, name: true, role: true,
      description: true, visualDescription: true, aliases: true,
      relevance: true, order: true, createdAt: true, updatedAt: true
      // referenceImage omitido — Buffer pesado, não enviar na listagem
    },
    orderBy: [
      { relevance: 'asc' }, // primary first
      { order: 'asc' }
    ]
  })

  // Verificar quais pessoas têm imagem de referência (query leve)
  const personsWithImage = await prisma.dossierPerson.findMany({
    where: { dossierId, referenceImage: { not: null } },
    select: { id: true }
  })
  const imageSet = new Set(personsWithImage.map(p => p.id))

  return {
    data: persons.map(p => ({ ...p, hasReferenceImage: imageSet.has(p.id) }))
  }
})
