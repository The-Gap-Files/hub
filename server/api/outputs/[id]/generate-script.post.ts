import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  outputPipelineService.generateScript(id).catch(err => {
    console.error('[API] Erro ao gerar roteiro:', err)
  })

  return { success: true, message: 'Geração de Roteiro Iniciada' }
})
