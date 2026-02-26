import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  // Retention QA (Stage 2.5) — fire-and-forget
  outputPipelineService.generateRetentionQA(id).catch(err => {
    console.error('[API] Erro ao gerar Retention QA:', err)
  })

  return { success: true, message: 'Análise de Retenção Iniciada' }
})
