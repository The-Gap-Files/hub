import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  // SFX (ElevenLabs Sound Effects) — fire-and-forget
  outputPipelineService.generateSFX(id).catch(err => {
    console.error('[API] Erro ao gerar SFX:', err)
  })

  return { success: true, message: 'Geração de SFX Iniciada' }
})
