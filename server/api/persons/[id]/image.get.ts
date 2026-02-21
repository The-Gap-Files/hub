/**
 * GET /api/persons/:id/image
 *
 * Serve a imagem de referência do personagem como binary PNG.
 */

import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Person ID is required' })
  }

  const person = await prisma.dossierPerson.findUnique({
    where: { id },
    select: { referenceImage: true }
  })

  if (!person?.referenceImage) {
    throw createError({ statusCode: 404, statusMessage: 'No reference image available' })
  }

  setResponseHeaders(event, {
    'Content-Type': 'image/png',
    'Cache-Control': 'private, max-age=3600',
    'Content-Length': String(person.referenceImage.length)
  })

  return person.referenceImage
})
