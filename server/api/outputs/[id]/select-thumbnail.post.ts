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

  const output = await prisma.output.findUnique({
    where: { id },
    select: { thumbnailCandidates: true }
  })

  if (!output) throw createError({ statusCode: 404, message: 'Output não encontrado' })

  const candidates = output.thumbnailCandidates as Array<{ base64: string; prompt: string }> | null
  if (!Array.isArray(candidates) || index >= candidates.length) {
    throw createError({
      statusCode: 422,
      message: `Thumbnail candidata inválida. Use index 0 a ${candidates?.length ? candidates.length - 1 : 0}.`
    })
  }

  const chosen = candidates[index]
  if (!chosen) throw createError({ statusCode: 422, message: 'Candidata inválida' })
  const thumbnailBuffer = Buffer.from(chosen.base64, 'base64')

  await prisma.output.update({
    where: { id },
    data: {
      thumbnailData: thumbnailBuffer,
      thumbnailCandidates: Prisma.DbNull
    }
  })

  return { success: true, message: 'Thumbnail selecionada com sucesso.' }
})
