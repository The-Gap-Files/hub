/**
 * GET /api/outputs/:id/export-subtitles?format=srt|vtt
 * 
 * Exporta legendas com timestamps precisos para upload no YouTube/Vimeo.
 * Usa word timings do ElevenLabs quando disponíveis (precisão por palavra).
 * 
 * Anti-Drift: proba a duração real do vídeo renderizado e escala todos os
 * timestamps proporcionalmente, eliminando qualquer descompasso causado por
 * frame grid, AAC padding, re-encoding, etc.
 * 
 * Query params:
 *   format: 'srt' (padrão) ou 'vtt'
 */

import { prisma } from '../../../utils/prisma'
import { CaptionService, type SceneCaptionData } from '../../../services/caption.service'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })

  const query = getQuery(event)
  const format = (query.format as string || 'srt').toLowerCase()

  if (!['srt', 'vtt'].includes(format)) {
    throw createError({ statusCode: 400, message: `Formato inválido: ${format}. Use 'srt' ou 'vtt'.` })
  }

  // Buscar output com cenas, áudios e dados do vídeo para probing
  const output = await prisma.output.findUnique({
    where: { id: outputId },
    select: {
      title: true,
      outputPath: true,
      outputData: true,
      scenes: {
        orderBy: { order: 'asc' },
        select: {
          order: true,
          narration: true,
          audioTracks: {
            where: { type: 'scene_narration' },
            select: { duration: true, fileData: true, alignment: true },
            take: 1
          }
        }
      }
    }
  })

  if (!output) throw createError({ statusCode: 404, message: 'Output not found' })
  if (!output.scenes?.length) throw createError({ statusCode: 404, message: 'No scenes found' })

  // Montar dados das cenas para o CaptionService
  type SceneWithTracks = { order: number; narration: string; audioTracks: Array<{ duration: number; fileData: Buffer | null; alignment: unknown }> }
  const scenesWithTracks = output.scenes as unknown as SceneWithTracks[]

  const sceneCaptionData: SceneCaptionData[] = scenesWithTracks
    .filter(scene => scene.narration && scene.audioTracks[0])
    .map(scene => {
      const track = scene.audioTracks[0]!
      const wordTimings = Array.isArray(track.alignment)
        ? (track.alignment as { word: string; startTime: number; endTime: number }[])
        : undefined
      return {
        narration: scene.narration,
        audioDuration: track.duration || 5,
        audioFileData: track.fileData ? Buffer.from(track.fileData) : undefined,
        wordTimings,
        order: scene.order
      }
    })

  if (sceneCaptionData.length === 0) {
    throw createError({ statusCode: 404, message: 'No narration audio found for subtitle export' })
  }

  // Probar duração real do vídeo renderizado (anti-drift)
  const captionService = new CaptionService()
  let actualVideoDuration: number | undefined

  try {
    if (output.outputPath) {
      // Vídeo em disco — proba diretamente (eficiente)
      actualVideoDuration = await captionService.probeVideoDuration({ path: output.outputPath })
    } else if (output.outputData) {
      // Vídeo no banco — proba via buffer temp
      actualVideoDuration = await captionService.probeVideoDuration({
        buffer: Buffer.from(output.outputData)
      })
    }
  } catch (err) {
    // Se falhar o probing, prossegue sem scaling (melhor que falhar tudo)
    console.warn('[export-subtitles] Falha ao probar duração do vídeo; exportando sem scaling.', err)
  }

  // Gerar legendas (com scaling se duração disponível)
  const exportOptions = { actualVideoDuration }
  const content = format === 'vtt'
    ? await captionService.exportVTT(sceneCaptionData, exportOptions)
    : await captionService.exportSRT(sceneCaptionData, exportOptions)

  // Preparar filename seguro
  const safeName = (output.title || 'output')
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60)

  const filename = `${safeName}.${format}`
  const mimeType = format === 'vtt' ? 'text/vtt' : 'application/x-subrip'

  // Retornar como download
  setResponseHeaders(event, {
    'Content-Type': `${mimeType}; charset=utf-8`,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-cache'
  })

  return content
})
