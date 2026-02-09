/**
 * Retorna a thumbnail selecionada do output (PNG).
 */

import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const output = await prisma.output.findUnique({
    where: { id },
    select: { thumbnailData: true }
  })

  if (!output || !output.thumbnailData) {
    throw createError({ statusCode: 404, message: 'Thumbnail não encontrada' })
  }

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'no-cache, must-revalidate')

  return output.thumbnailData
})
