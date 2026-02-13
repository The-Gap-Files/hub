/**
 * DELETE /api/dossiers/:id/images/:imageId
 *
 * Remove permanentemente um asset visual do dossiê.
 */

import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')
  const imageId = getRouterParam(event, 'imageId')

  if (!dossierId || !imageId) {
    throw createError({ statusCode: 400, message: 'dossierId e imageId são obrigatórios' })
  }

  // Verificar se a imagem pertence ao dossiê
  const image = await prisma.dossierImage.findFirst({
    where: { id: imageId, dossierId },
    select: { id: true }
  })

  if (!image) {
    throw createError({ statusCode: 404, message: 'Asset visual não encontrado neste dossiê' })
  }

  await prisma.dossierImage.delete({
    where: { id: imageId }
  })

  return { success: true }
})
