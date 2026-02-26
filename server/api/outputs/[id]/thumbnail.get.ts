/**
 * Retorna a thumbnail selecionada do output (PNG).
 */

import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const product = await prisma.thumbnailProduct.findUnique({
    where: { outputId: id },
    select: { selectedData: true }
  })

  if (!product || !product.selectedData) {
    throw createError({ statusCode: 404, message: 'Thumbnail não encontrada' })
  }

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'no-cache, must-revalidate')

  return product.selectedData
})
