import { prisma } from '../../../utils/prisma'
import { Prisma } from '@prisma/client'

/**
 * POST /api/outputs/[id]/reset-to-plan
 *
 * Volta o output para o estado inicial do pipeline (etapa Plano),
 * preservando configurações base do output (voz, WPM, idioma, estilos, etc.).
 *
 * Limpa apenas artefatos/estados de pipeline:
 * - storyOutline + aprovações
 * - script + cenas + mídias geradas
 * - render/thumbnails/social kit
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

    // 3) Resetar output para início do pipeline (Plano)
    await tx.output.update({
      where: { id },
      data: {
        // Volta ao Story Architect
        storyOutline: Prisma.DbNull,
        storyOutlineApproved: false,

        // Reset de aprovações de etapas
        scriptApproved: false,
        imagesApproved: false,
        audioApproved: false,
        bgmApproved: false,
        videosApproved: false,
        renderApproved: false,

        // Limpa artefatos finais/extras
        outputData: null,
        outputMimeType: null,
        outputSize: null,
        outputPath: null,
        captionedVideoData: null,
        captionedVideoSize: null,
        thumbnailPath: null,
        thumbnailData: null,
        thumbnailCandidates: Prisma.DbNull,
        socialKit: Prisma.DbNull,

        // Estado operacional
        status: 'PENDING',
        completedAt: null,
        errorMessage: null
      }
    })
  })

  return {
    success: true,
    message: 'Output resetado para a etapa Plano. Gere o Story Architect novamente.'
  }
})

