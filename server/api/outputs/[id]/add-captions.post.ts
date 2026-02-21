import { prisma } from '../../../utils/prisma'
import { createPipelineLogger } from '../../../utils/pipeline-logger'
import { CaptionService, type SceneCaptionData } from '../../../services/caption.service'
import { getRecommendedStyle, CAPTION_STYLES, type CaptionStyleId } from '../../../constants/cinematography/caption-styles'

/**
 * POST /api/outputs/[id]/add-captions
 * 
 * Adiciona legendas ao vídeo renderizado usando os dados das cenas.
 * 
 * NOVO FLUXO (sem Whisper):
 *   O texto vem do campo `narration` de cada cena.
 *   O timing vem da duração real do áudio (AudioTrack.duration / ffprobe).
 *   Eliminamos transcrição redundante → mais rápido, mais preciso, zero dependências externas.
 * 
 * Body (opcional):
 *   - styleId: CaptionStyleId  → Estilo da legenda (default: recomendado por aspect ratio)
 *   - force: boolean           → Reprocessar mesmo se já tem legendas
 *   - logoOnly: boolean        → Apenas overlay da logo (sem legendas); ignora cenas
 *   - replaceMaster: boolean   → Se true, substitui outputData pelo vídeo com legendas/logo (vídeo “normal” vira a versão final)
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID é obrigatório'
    })
  }

  const body = await readBody(event).catch(() => ({}))
  const logoOnly = !!body?.logoOnly

  const output = await prisma.output.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      outputData: true,
      captionedVideoData: true,
      aspectRatio: true,
      platform: true,
      scenes: logoOnly ? undefined : {
        orderBy: { order: 'asc' },
        select: {
          id: true,
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

  if (!output) {
    throw createError({
      statusCode: 404,
      message: 'Output não encontrado'
    })
  }

  if ((output.status !== 'COMPLETED' && output.status !== 'RENDERED') || !output.outputData) {
    throw createError({
      statusCode: 400,
      message: 'O vídeo precisa estar renderizado (outputData no banco) antes de adicionar legendas ou logo.'
    })
  }
  const videoData = output.outputData

  if (!logoOnly && output.captionedVideoData && !body?.force) {
    throw createError({
      statusCode: 409,
      message: 'Este vídeo já possui legendas. Use force=true para reprocessar.'
    })
  }

  const replaceMaster = !!body?.replaceMaster

  const log = createPipelineLogger({ stage: 'AddCaptions', outputId: id })

  // Modo apenas logo: overlay da logo no vídeo master
  if (logoOnly) {
    try {
      const captionService = new CaptionService()
      const videoBuffer = Buffer.from(videoData)
      const resultBuffer = await captionService.applyLogoOnly(videoBuffer)
      const captionedUint8Array = new Uint8Array(resultBuffer)
      await prisma.output.update({
        where: { id },
        data: {
          captionedVideoData: captionedUint8Array,
          captionedVideoSize: captionedUint8Array.length,
          ...(replaceMaster && {
            outputData: captionedUint8Array,
            outputSize: captionedUint8Array.length
          })
        }
      })
      const sizeMB = (resultBuffer.length / 1024 / 1024).toFixed(2)
      log.info(`Logo aplicada (logoOnly): ${sizeMB} MB. ${replaceMaster ? 'Master substituído.' : ''}`)
      return {
        success: true,
        message: 'Logo aplicada com sucesso',
        logoOnly: true,
        size: resultBuffer.length,
        sizeInMB: parseFloat(sizeMB)
      }
    } catch (error) {
      log.error('Erro ao aplicar logo.', error)
      throw createError({
        statusCode: 500,
        message: `Erro ao aplicar logo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      })
    }
  }

  if (!output.scenes || output.scenes.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Output não possui cenas. Gere o script primeiro.'
    })
  }

  try {
    log.info('Iniciando processo de legendas.')

    // Determinar estilo
    const recommendedStyle = getRecommendedStyle(
      output.aspectRatio || '16:9',
      output.platform || undefined
    )

    const styleId: CaptionStyleId = body?.styleId && body.styleId in CAPTION_STYLES
      ? body.styleId as CaptionStyleId
      : recommendedStyle

    const style = CAPTION_STYLES[styleId]
    log.info('Config', {
      aspectRatio: output.aspectRatio,
      platform: output.platform || 'não definida',
      recommendedStyle,
      styleId,
      styleName: style.name,
      effect: style.effect,
      force: !!body?.force
    })

    // Construir dados das cenas para o serviço de legendas
    // Prioridade de timing: wordTimings (ElevenLabs) > ffprobe (duração real) > estimativa
    type SceneWithTracks = { order: number; narration: string; audioTracks: Array<{ duration: number; fileData: Buffer | null; alignment: unknown }> }
    const scenesWithTracks = output.scenes as unknown as SceneWithTracks[]
    const sceneCaptionData: SceneCaptionData[] = scenesWithTracks
      .filter(scene => scene.narration && scene.audioTracks[0])
      .map(scene => {
        const track = scene.audioTracks[0]!

        // Word timings do ElevenLabs /with-timestamps (precisão perfeita)
        const wordTimings = Array.isArray(track.alignment)
          ? (track.alignment as { word: string; startTime: number; endTime: number }[])
          : undefined

        if (wordTimings) {
          log.step(`Cena ${scene.order + 1}`, `${wordTimings.length} word timings (ElevenLabs)`)
        }

        return {
          narration: scene.narration,
          audioDuration: track.duration || 5,
          audioFileData: track.fileData
            ? Buffer.from(track.fileData)
            : undefined,
          wordTimings,
          order: scene.order
        }
      })

    if (sceneCaptionData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Nenhuma cena possui narração e áudio. Gere o script e o áudio primeiro.'
      })
    }

    log.info(`${sceneCaptionData.length} cenas com narração + áudio.`)

    // Carregar vídeo do banco
    const videoBuffer = Buffer.from(videoData)
    log.info(`Vídeo carregado: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB.`)

    // Gerar legendas (sem Whisper!)
    const captionService = new CaptionService()
    const result = await captionService.addCaptionsFromScenes(
      videoBuffer,
      sceneCaptionData,
      { styleId }
    )

    // Salvar no banco
    const captionedUint8Array = new Uint8Array(result.captionedBuffer)
    log.info('Salvando vídeo legendado no banco.')

    await prisma.output.update({
      where: { id },
      data: {
        captionedVideoData: captionedUint8Array,
        captionedVideoSize: captionedUint8Array.length,
        ...(replaceMaster && {
          outputData: captionedUint8Array,
          outputSize: captionedUint8Array.length
        })
      }
    })

    const sizeMB = (result.captionedBuffer.length / 1024 / 1024).toFixed(2)
    log.info(`Legendas adicionadas: ${sizeMB} MB. ${replaceMaster ? 'Master substituído.' : ''}`)

    return {
      success: true,
      message: 'Legendas adicionadas com sucesso',
      style: {
        id: styleId,
        name: style.name,
        effect: style.effect,
        platform: style.platform
      },
      scenesProcessed: result.scenesProcessed,
      size: result.captionedBuffer.length,
      sizeInMB: parseFloat(sizeMB)
    }
  } catch (error) {
    log.error('Erro ao processar legendas.', error)

    // Se for um createError, re-throw sem embrulhar
    if ((error as any).statusCode) throw error

    throw createError({
      statusCode: 500,
      message: `Erro ao adicionar legendas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})
