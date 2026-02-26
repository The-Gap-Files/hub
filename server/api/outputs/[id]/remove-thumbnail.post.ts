/**
 * Remove a thumbnail selecionada e limpa candidatas.
 * Permite ao usuário gerar novas opções e escolher outra.
 */

import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const output = await prisma.output.findUnique({
    where: { id },
    select: { id: true }
  })

  if (!output) throw createError({ statusCode: 404, message: 'Output não encontrado' })

  await prisma.thumbnailProduct.deleteMany({
    where: { outputId: id }
  })

  return { success: true, message: 'Thumbnail removida. Você pode gerar novas opções.' }
})
