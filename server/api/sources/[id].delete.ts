/**
 * DELETE /api/sources/:id
 *
 * Remove permanentemente uma fonte do dossiê.
 */

import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const sourceId = getRouterParam(event, 'id')

  if (!sourceId) {
    throw createError({ statusCode: 400, message: 'Source ID is required' })
  }

  const source = await prisma.dossierSource.findUnique({
    where: { id: sourceId },
    select: { id: true }
  })

  if (!source) {
    throw createError({ statusCode: 404, message: 'Fonte não encontrada' })
  }

  await prisma.dossierSource.delete({
    where: { id: sourceId }
  })

  return { success: true }
})
