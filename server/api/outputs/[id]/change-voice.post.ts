import { prisma } from '../../../utils/prisma'
import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

/**
 * POST /api/outputs/[id]/change-voice
 * 
 * Troca o narrador (voz) de um output e regenera toda a narração.
 * Mantém o script e as imagens intactas — só reprocessa o áudio.
 * 
 * Body:
 *   - voiceId: string (obrigatório) — ID da nova voz do ElevenLabs
 * 
 * Fluxo:
 *   1. Valida que o output existe e tem script/cenas
 *   2. Atualiza o voiceId no output
 *   3. Deleta todos os áudios de narração existentes
 *   4. Gera novo áudio para todas as cenas em background
 *   5. Reseta flags de aprovação de áudio (e render se necessário)
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

  // Buscar output
  const output = await prisma.output.findUnique({
    where: { id },
    select: {
      id: true,
      voiceId: true,
      scriptApproved: true,
      imagesApproved: true,
      status: true,
      _count: { select: { scenes: true } }
    }
  })

  if (!output) {
    throw createError({ statusCode: 404, message: 'Output não encontrado' })
  }

  // Validar que tem cenas (script já foi gerado)
  if (output._count.scenes === 0) {
    throw createError({
      statusCode: 400,
      message: 'Este output não possui cenas. Gere o script primeiro.'
    })
  }

  // Verificar se é a mesma voz
  if (output.voiceId === body.voiceId) {
    throw createError({
      statusCode: 409,
      message: 'A voz selecionada já é a mesma do output atual.'
    })
  }

  const previousVoiceId = output.voiceId

  console.log(`[ChangeVoice] Output ${id}: trocando voz de "${previousVoiceId}" para "${body.voiceId}"`)

  // Fire-and-forget: regenerar áudio em background
  outputPipelineService.regenerateAudioWithVoice(id, body.voiceId).catch(err => {
    console.error(`[ChangeVoice] Erro ao regenerar áudio para output ${id}:`, err)
  })

  return {
    success: true,
    message: 'Troca de narrador iniciada. A narração está sendo regenerada.',
    previousVoiceId,
    newVoiceId: body.voiceId,
    scenesCount: output._count.scenes
  }
})
