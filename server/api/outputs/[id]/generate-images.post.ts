import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'
import { providerManager } from '../../../services/providers'
import { validateReplicatePricing, PricingNotConfiguredError } from '../../../constants/pricing'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  // Validar pricing ANTES de disparar background
  try {
    const imageProvider = providerManager.getImageProvider()
    const imageModel = (imageProvider as any).model || 'luma/photon-flash'
    validateReplicatePricing(imageModel)
  } catch (err: any) {
    if (err instanceof PricingNotConfiguredError) {
      throw createError({
        statusCode: 422,
        data: { code: 'PRICING_NOT_CONFIGURED', model: err.model, provider: err.provider, configUrl: err.configUrl },
        message: err.message
      })
    }
    throw err
  }

  // Executar em background após validação
  outputPipelineService.generateImages(id).catch(err => {
    console.error('[API] Erro ao gerar imagens:', err)
  })

  return { success: true, message: 'Geração de Imagens Iniciada' }
})
