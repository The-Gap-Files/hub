/**
 * PATCH /api/scenes/:id/update
 * 
 * Atualiza campos editáveis de uma cena (visualDescription, narration, audioDescription, audioDescriptionVolume).
 * Usado no modo correção para ajustar o prompt visual antes de regenerar a imagem.
 */

import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const sceneId = getRouterParam(event, 'id')
  if (!sceneId) throw createError({ statusCode: 400, message: 'Scene ID required' })

  const body = await readBody(event)

  // Campos permitidos para edição
  const updateData: Record<string, any> = {}
  if (body.visualDescription !== undefined) updateData.visualDescription = body.visualDescription
  if (body.narration !== undefined) updateData.narration = body.narration
  if (body.audioDescription !== undefined) updateData.audioDescription = body.audioDescription
  if (body.audioDescriptionVolume !== undefined) updateData.audioDescriptionVolume = body.audioDescriptionVolume

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  const scene = await prisma.scene.update({
    where: { id: sceneId },
    data: updateData,
    select: { id: true, visualDescription: true, narration: true, audioDescription: true, audioDescriptionVolume: true }
  })

  return scene
})
