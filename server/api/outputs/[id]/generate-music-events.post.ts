import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  // Music Events — fire-and-forget
  outputPipelineService.generateMusicEvents(id).catch(err => {
    console.error('[API] Erro ao gerar Music Events:', err)
  })

  return { success: true, message: 'Geração de Music Events iniciada' }
})
