import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    })
  }

  const note = await prisma.dossierNote.findUnique({
    where: { id }
  })

  if (!note) {
    throw createError({
      statusCode: 404,
      message: 'Note not found'
    })
  }

  await prisma.dossierNote.delete({
    where: { id }
  })

  return { success: true, id }
})
