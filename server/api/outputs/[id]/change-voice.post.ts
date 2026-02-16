import { prisma } from '../../../utils/prisma'
import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

/**
 * POST /api/outputs/[id]/change-voice
 * 
 * Configura/troca o narrador (voz) do output.
 * 
 * - Se o output já tem cenas, regenera toda a narração (mantém script/imagens).
 * - Se o output ainda NÃO tem cenas, apenas salva as configurações (pré-requisito do Story Architect).
 * 
 * Body:
 *   - voiceId: string (obrigatório) — ID da nova voz do ElevenLabs
 *   - targetWPM?: number (legado, opcional) — mantido apenas para backward-compat
 * 
 * Fluxo:
 *   1. Valida que o output existe
 *   2. Atualiza voiceId (+ targetWPM se enviado) + speechConfiguredAt
 *   3. Se tiver cenas: regenera áudio em background
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Output ID é obrigatório' })
  }

  const body = await readBody(event)

  if (!body?.voiceId || typeof body.voiceId !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'voiceId é obrigatório. Selecione uma voz do ElevenLabs.'
    })
  }

  // targetWPM é legado/compat. Se vier, validar; caso contrário, manter valor atual do output.
  const targetWPM = body?.targetWPM === undefined ? undefined : Number(body.targetWPM)
  if (targetWPM !== undefined && (!Number.isFinite(targetWPM) || isNaN(targetWPM) || targetWPM < 100 || targetWPM > 200)) {
    throw createError({
      statusCode: 400,
      message: 'targetWPM deve ser um número entre 100 e 200.'
    })
  }

  // Buscar output
  const output = await prisma.output.findUnique({
    where: { id },
    select: {
      id: true,
      voiceId: true,
      targetWPM: true,
      scriptApproved: true,
      imagesApproved: true,
      status: true,
      _count: { select: { scenes: true } }
    }
  })

  if (!output) {
    throw createError({ statusCode: 404, message: 'Output não encontrado' })
  }

  // Verificar se algo mudou (voz OU WPM legado)
  const sameVoice = output.voiceId === body.voiceId
  const sameWPM = targetWPM === undefined ? true : (output.targetWPM === targetWPM)
  if (sameVoice && sameWPM) {
    throw createError({
      statusCode: 409,
      message: 'Nenhuma alteração detectada. A voz é a mesma do output atual.'
    })
  }

  const previousVoiceId = output.voiceId

  console.log(`[ChangeVoice] Output ${id}: configurando voz de "${previousVoiceId}" para "${body.voiceId}"${targetWPM !== undefined ? ` (WPM: ${targetWPM})` : ''}`)

  // Atualizar configurações no banco (pré-requisito do Story Architect)
  await prisma.output.update({
    where: { id },
    data: {
      voiceId: body.voiceId,
      ...(targetWPM !== undefined ? { targetWPM } : {}),
      speechConfiguredAt: new Date()
    }
  })

  // Se ainda não existem cenas, só configurar (sem regenerar áudio)
  if (output._count.scenes === 0) {
    return {
      success: true,
      message: 'Voz configurada. O áudio será gerado quando o roteiro existir.',
      previousVoiceId,
      newVoiceId: body.voiceId,
      scenesCount: 0,
      targetWPM: targetWPM ?? output.targetWPM
    }
  }

  // Fire-and-forget: regenerar áudio em background (mantém script/imagens)
  outputPipelineService.regenerateAudioWithVoice(id, body.voiceId).catch(err => {
    console.error(`[ChangeVoice] Erro ao regenerar áudio para output ${id}:`, err)
  })

  return {
    success: true,
    message: 'Troca de narrador iniciada. A narração está sendo regenerada.',
    previousVoiceId,
    newVoiceId: body.voiceId,
    scenesCount: output._count.scenes,
    targetWPM: targetWPM ?? output.targetWPM
  }
})
