import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../../services/providers'
import { costLogService } from '../../../services/cost-log.service'
import { validateReplicatePricing, PricingNotConfiguredError } from '../../../constants/pricing'
import { getVisualStyleById } from '../../../constants/visual-styles'
import type { ImageGenerationRequest } from '../../../types/ai-providers'
import { ContentRestrictedError } from '../../../services/providers/image/replicate-image.provider'

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
  let imageProvider
  try {
    imageProvider = providerManager.getImageProvider()
  } catch (e) {
    const key = process.env.REPLICATE_API_KEY?.replace(/"/g, '')
    if (key) {
      const { createImageProvider } = await import('../../../services/providers')
      imageProvider = createImageProvider('replicate', key)
    } else {
      throw new Error('Image Provider not configured')
    }
  }

  // 2.1 Validar pricing antes de gastar dinheiro
  const imageModel = (imageProvider as any).model || 'luma/photon-flash'
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

  // 3. Preparar Request — prompt completo vem do roteiro (ou override do body)
  const isPortrait = output.aspectRatio === '9:16'
  const width = isPortrait ? 768 : 1344
  const height = isPortrait ? 1344 : 768

  const vs = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined

  const promptToUse = body.prompt ?? scene.visualDescription

  const request: ImageGenerationRequest = {
    prompt: promptToUse,
    width,
    height,
    aspectRatio: output.aspectRatio || '16:9',
    style: (vs?.baseStyle as any) || 'cinematic',
    seed: body.seed || undefined,
    numVariants: 1
  }

  console.log(`[API] 🖼️ [DEBUG] Regenerar imagem — Scene ${sceneId} — prompt completo:\n${request.prompt}`)

  // 4. Gerar (com detecção de safety filter)
  let response
  try {
    response = await imageProvider.generate(request)
  } catch (err: any) {
    if (err instanceof ContentRestrictedError) {
      // Atualizar status da cena para restrita (persistir a tentativa)
      await prisma.scene.update({
        where: { id: sceneId },
        data: {
          imageStatus: 'restricted',
          imageRestrictionReason: err.message
        }
      })

      throw createError({
        statusCode: 422,
        data: {
          code: 'CONTENT_RESTRICTED',
          prompt: promptToUse,
          reason: err.message
        },
        message: `O prompt foi rejeitado pelo filtro de conteúdo do modelo de imagem. Tente editar o prompt para usar termos mais abstratos.`
      })
    }
    throw err
  }

  const generated = response.images[0]

  if (!generated) throw createError({ statusCode: 500, message: 'No image generated' })

  // 5. Salvar no Banco — desmarcar anteriores como selecionadas
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

  // 6. Limpar status de restrição da cena (regeneração com sucesso)
  await prisma.scene.update({
    where: { id: sceneId },
    data: {
      imageStatus: 'generated',
      imageRestrictionReason: null
    }
  })

  // Registrar custo da regeneração de imagem (fire-and-forget)
  costLogService.logReplicateImage({
    outputId: output.id,
    model: response.model || 'luma/photon-flash',
    numImages: 1,
    action: 'recreate',
    detail: `Scene image regeneration (single)`
  }).catch(() => { })

  return newImage
})
