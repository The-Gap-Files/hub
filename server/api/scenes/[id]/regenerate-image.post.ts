import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../../services/providers'
import { costLogService } from '../../../services/cost-log.service'
import { validateReplicatePricing, PricingNotConfiguredError } from '../../../constants/pricing'
import { getVisualStyleById } from '../../../constants/visual-styles'
import type { ImageGenerationRequest } from '../../../types/ai-providers'

export default defineEventHandler(async (event) => {
  const sceneId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!sceneId) throw createError({ statusCode: 400, message: 'Scene ID required' })

  // 1. Buscar a cena e o output pai para pegar configs (estilo, aspect ratio)
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: {
      output: {
        include: {
          seed: true
        }
      }
    }
  })

  if (!scene) throw createError({ statusCode: 404, message: 'Scene not found' })

  const output = scene.output

  console.log(`[API] Regenerating image for Scene ${sceneId}`)

  // 2. Configurar Provider
  // Tenta pegar o provider configurado ou fallback para replicate (como no pipeline)
  let imageProvider
  try {
    imageProvider = providerManager.getImageProvider()
  } catch (e) {
    // Fallback de emergência igual ao pipeline se não estiver init
    const key = process.env.REPLICATE_API_KEY?.replace(/"/g, '')
    if (key) {
      const { createImageProvider } = await import('../../../services/providers')
      imageProvider = createImageProvider('replicate', key)
    } else {
      throw new Error('Image Provider not configured')
    }
  }

  // 2.1 Validar pricing antes de gastar dinheiro
  const imageModel = (imageProvider as any).model || 'black-forest-labs/flux-schnell'
  try {
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

  // 3. Preparar Request
  const isPortrait = output.aspectRatio === '9:16'
  const width = isPortrait ? 768 : 1344
  const height = isPortrait ? 1344 : 768

  // Construir prompt enriquecido com tags do estilo visual
  const basePrompt = body.prompt || scene.visualDescription
  let enhancedPrompt = basePrompt
  const vs = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined

  if (vs) {
    const tags = [
      vs.lightingTags,
      vs.atmosphereTags,
      vs.compositionTags,
      vs.tags
    ].filter(t => t && t.trim().length > 0).join(', ')

    const parts = []
    // Base Style é a âncora principal
    if (vs.baseStyle) parts.push(vs.baseStyle)
    parts.push(basePrompt)
    if (tags) parts.push(tags)

    enhancedPrompt = parts.join(', ')
  }

  const request: ImageGenerationRequest = {
    prompt: enhancedPrompt,
    width,
    height,
    aspectRatio: output.aspectRatio || '16:9',
    style: vs?.baseStyle as any || 'cinematic',
    seed: body.seed || undefined, // Permite novo seed aleatório se não passar
    numVariants: 1
  }

  // 4. Gerar
  const response = await imageProvider.generate(request)
  const generated = response.images[0]

  if (!generated) throw createError({ statusCode: 500, message: 'No image generated' })

  // 5. Salvar no Banco
  // Desmarcar anteriores como selecionadas?
  await prisma.sceneImage.updateMany({
    where: { sceneId },
    data: { isSelected: false }
  })

  const newImage = await prisma.sceneImage.create({
    data: {
      sceneId,
      provider: imageProvider.getName() as any,
      promptUsed: request.prompt,
      fileData: Buffer.from(generated.buffer) as any,
      mimeType: 'image/png',
      originalSize: generated.buffer.length,
      width: generated.width,
      height: generated.height,
      isSelected: true,
      variantIndex: 0
    }
  })

  // Registrar custo da regeneração de imagem (fire-and-forget)
  costLogService.logReplicateImage({
    outputId: output.id,
    model: response.model || 'black-forest-labs/flux-schnell',
    numImages: 1,
    action: 'recreate',
    detail: `Scene image regeneration (single)`
  }).catch(() => {})

  return newImage
})
