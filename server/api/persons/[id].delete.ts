/**
 * DELETE /api/persons/[id]
 * 
 * Remove uma pessoa-chave do dossiê.
 */

import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Person ID is required'
    })
  }

  const person = await prisma.dossierPerson.findUnique({
    where: { id }
  })

  if (!person) {
    throw createError({
      statusCode: 404,
      message: 'Person not found'
    })
  }

  await prisma.dossierPerson.delete({
    where: { id }
  })

  return { success: true, id }
})
