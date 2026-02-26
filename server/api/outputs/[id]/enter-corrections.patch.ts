import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'ID do Output é obrigatório' })

  console.log(`[API] 🔧 Entering correction mode for Output: ${id}`)

  try {
    const output = await outputPipelineService.enterCorrectionMode(id)

    return {
      success: true,
      message: 'Modo correção ativado. Imagens e motion desbloqueados para edição.',
      output: {
        id: output.id,
        status: output.status,
      }
    }
  } catch (err: any) {
    console.error(`[API] Erro ao entrar em modo correção para ${id}:`, err)
    throw createError({
      statusCode: err.message?.includes('Somente outputs') ? 422 : 500,
      message: err.message || 'Erro interno ao entrar em modo correção'
    })
  }
})
