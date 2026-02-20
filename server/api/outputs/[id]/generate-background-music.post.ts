import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'
import { providerManager } from '../../../services/providers'
import { validateMediaPricing, PricingNotConfiguredError } from '../../../constants/pricing'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  // Ler body para detectar force (refazer)
  const body = await readBody(event).catch(() => ({}))
  const force = body?.force === true

  // Se force, deletar BGMs existentes antes de regenerar
  if (force) {
    const deleted = await prisma.audioTrack.deleteMany({
      where: { outputId: id, type: 'background_music' }
    })
    console.log(`[API] 🗑️ ${deleted.count} BGM tracks deletadas (force=true)`)
  }

  // Validar pricing ANTES de disparar background
  try {
    const musicProvider = providerManager.getMusicProvider()
    const musicModel = (musicProvider as any).model || 'stability-ai/stable-audio-2.5'
    const providerName = musicProvider.getName()
    validateMediaPricing(musicModel, providerName)
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
  outputPipelineService.generateBackgroundMusic(id).catch(err => {
    console.error('[API] Erro ao gerar background music:', err)
  })

  return { success: true, message: 'Geração de Background Music iniciada' }
})

