import { prisma } from '../../../utils/prisma'

/**
 * POST /api/outputs/[id]/reset-to-plan
 *
 * Volta o output para o estado inicial do pipeline (etapa Plano),
 * preservando configurações base do output (voz, WPM, idioma, estilos, etc.).
 *
 * Limpa apenas artefatos/estados de pipeline:
 * - StageGates + product tables
 * - script + cenas + mídias geradas
 * - status de execução
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Output ID é obrigatório' })

  const output = await prisma.output.findUnique({
    where: { id },
    select: { id: true }
  })

  if (!output) {
    throw createError({ statusCode: 404, message: 'Output não encontrado' })
  }

  await prisma.$transaction(async (tx) => {
    // 1) Limpar trilhas de áudio do output (narração + bgm)
    await tx.audioTrack.deleteMany({
      where: { outputId: id }
    })

    // 2) Limpar script (tracks de bgm em cascata) e cenas (imagens/videos em cascata)
    await tx.script.deleteMany({
      where: { outputId: id }
    })

    await tx.scene.deleteMany({
      where: { outputId: id }
    })

    // 3) Limpar product tables
    await tx.stageGate.deleteMany({ where: { outputId: id } })
    await tx.storyOutlineProduct.deleteMany({ where: { outputId: id } })
    await tx.retentionQAProduct.deleteMany({ where: { outputId: id } })
    await tx.monetizationProduct.deleteMany({ where: { outputId: id } })
    await tx.socialKitProduct.deleteMany({ where: { outputId: id } })
    await tx.thumbnailProduct.deleteMany({ where: { outputId: id } })
    await tx.renderProduct.deleteMany({ where: { outputId: id } })

    // 4) Resetar output para início do pipeline
    await tx.output.update({
      where: { id },
      data: {
        status: 'DRAFT',
        completedAt: null,
        errorMessage: null
      }
    })
  }, { timeout: 30000 })

  return {
    success: true,
    message: 'Output resetado para a etapa Plano. Gere o Story Architect novamente.'
  }
})
