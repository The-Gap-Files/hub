import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  // Áudio (ElevenLabs) usa pricing por caractere com default seguro - não precisa validar modelo
  outputPipelineService.generateAudio(id).catch(err => {
    console.error('[API] Erro ao gerar áudio:', err)
  })

  return { success: true, message: 'Geração de Áudio Iniciada' }
})
