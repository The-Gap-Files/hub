import { prisma } from '../../../utils/prisma'
import { CaptionService, type SceneCaptionData } from '../../../services/caption.service'
import { getRecommendedStyle, CAPTION_STYLES, type CaptionStyleId } from '../../../constants/caption-styles'

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
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID é obrigatório'
    })
  }

  // Buscar output com cenas e áudios
  const output = await prisma.output.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      outputData: true,
      captionedVideoData: true,
      aspectRatio: true,
      platform: true,
      scenes: {
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

  // Validar se o vídeo está completo
  if (output.status !== 'COMPLETED' || !output.outputData) {
    throw createError({
      statusCode: 400,
      message: 'O vídeo precisa estar renderizado antes de adicionar legendas'
    })
  }

  // Ler body
  const body = await readBody(event)

  // Verificar se já tem legendas (permitir reprocessamento com force)
  if (output.captionedVideoData && !body?.force) {
    throw createError({
      statusCode: 409,
      message: 'Este vídeo já possui legendas. Use force=true para reprocessar.'
    })
  }

  // Validar cenas
  if (!output.scenes || output.scenes.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Output não possui cenas. Gere o script primeiro.'
    })
  }

  try {
    console.log(`[AddCaptions] Iniciando processo para output ${id}`)

    // Determinar estilo
    const recommendedStyle = getRecommendedStyle(
      output.aspectRatio || '16:9',
      output.platform || undefined
    )

    const styleId: CaptionStyleId = body?.styleId && body.styleId in CAPTION_STYLES
      ? body.styleId as CaptionStyleId
      : recommendedStyle

    const style = CAPTION_STYLES[styleId]
    console.log(`[AddCaptions] Aspect Ratio: ${output.aspectRatio}`)
    console.log(`[AddCaptions] Plataforma: ${output.platform || 'não definida'}`)
    console.log(`[AddCaptions] Estilo recomendado: ${recommendedStyle}`)
    console.log(`[AddCaptions] Estilo selecionado: ${style.name} (${styleId})`)
    console.log(`[AddCaptions] Efeito: ${style.effect}`)
    if (body?.force) console.log('[AddCaptions] Reprocessando legendas (force=true)')

    // Construir dados das cenas para o serviço de legendas
    // Prioridade de timing: wordTimings (ElevenLabs) > ffprobe (duração real) > estimativa
    const sceneCaptionData: SceneCaptionData[] = output.scenes
      .filter(scene => scene.narration && scene.audioTracks[0])
      .map(scene => {
        const track = scene.audioTracks[0]!

        // Word timings do ElevenLabs /with-timestamps (precisão perfeita)
        const wordTimings = Array.isArray(track.alignment)
          ? (track.alignment as { word: string; startTime: number; endTime: number }[])
          : undefined

        if (wordTimings) {
          console.log(`[AddCaptions] Cena ${scene.order + 1}: ${wordTimings.length} word timings do ElevenLabs`)
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

    console.log(`[AddCaptions] ${sceneCaptionData.length} cenas com narração + áudio`)

    // Carregar vídeo do banco
    const videoBuffer = Buffer.from(output.outputData)
    console.log(`[AddCaptions] Vídeo carregado: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    // Gerar legendas (sem Whisper!)
    const captionService = new CaptionService()
    const result = await captionService.addCaptionsFromScenes(
      videoBuffer,
      sceneCaptionData,
      { styleId }
    )

    // Salvar no banco
    const captionedUint8Array = new Uint8Array(result.captionedBuffer)
    console.log('[AddCaptions] Salvando vídeo legendado no banco...')

    await prisma.output.update({
      where: { id },
      data: {
        captionedVideoData: captionedUint8Array,
        captionedVideoSize: captionedUint8Array.length
      }
    })

    const sizeMB = (result.captionedBuffer.length / 1024 / 1024).toFixed(2)
    console.log(`[AddCaptions] Legendas adicionadas com sucesso! ${sizeMB} MB`)

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
    console.error('[AddCaptions] Erro ao processar legendas:', error)

    // Se for um createError, re-throw sem embrulhar
    if ((error as any).statusCode) throw error

    throw createError({
      statusCode: 500,
      message: `Erro ao adicionar legendas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    })
  }
})
