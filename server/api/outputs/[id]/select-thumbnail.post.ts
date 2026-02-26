/**
 * Seleciona uma thumbnail candidata como definitiva.
 * Body: { index: number } (0-based)
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const body = await readBody(event)
  const index = typeof body?.index === 'number' ? body.index : parseInt(body?.index, 10)

  if (isNaN(index) || index < 0) {
    throw createError({ statusCode: 400, message: 'index deve ser um número >= 0' })
  }

  const product = await prisma.thumbnailProduct.findUnique({
    where: { outputId: id },
    select: { candidates: true }
  })

  if (!product) throw createError({ statusCode: 404, message: 'Thumbnails não encontradas. Gere thumbnails primeiro.' })

  const candidates = product.candidates as Array<{ base64: string; prompt: string }> | null
  if (!Array.isArray(candidates) || index >= candidates.length) {
    throw createError({
      statusCode: 422,
      message: `Thumbnail candidata inválida. Use index 0 a ${candidates?.length ? candidates.length - 1 : 0}.`
    })
  }

  const chosen = candidates[index]
  if (!chosen) throw createError({ statusCode: 422, message: 'Candidata inválida' })
  const thumbnailBuffer = Buffer.from(chosen.base64, 'base64')

  await prisma.thumbnailProduct.update({
    where: { outputId: id },
    data: {
      selectedData: thumbnailBuffer,
      candidates: Prisma.JsonNull,
    }
  })

  return { success: true, message: 'Thumbnail selecionada com sucesso.' }
})
