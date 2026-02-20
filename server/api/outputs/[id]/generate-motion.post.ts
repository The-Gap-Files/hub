import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'
import { providerManager } from '../../../services/providers'
import { validateMediaPricing, PricingNotConfiguredError } from '../../../constants/pricing'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  // Validar pricing ANTES de disparar background
  try {
    const motionProvider = providerManager.getMotionProvider()
    const motionModel = (motionProvider as any).model || 'wan-video/wan-2.2-i2v-fast'
    const providerName = motionProvider.getName()
    validateMediaPricing(motionModel, providerName)
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
  outputPipelineService.generateMotion(id).catch(err => {
    console.error('[API] Erro ao gerar motion:', err)
  })

  return { success: true, message: 'Geração de Motion Iniciada' }
})
