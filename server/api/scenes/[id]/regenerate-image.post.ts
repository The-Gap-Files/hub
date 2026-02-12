import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../../services/providers'
import { createImageProvider } from '../../../services/providers'
import { costLogService } from '../../../services/cost-log.service'
import { validateReplicatePricing, PricingNotConfiguredError, calculateReplicateOutputCost } from '../../../constants/pricing'
import { getVisualStyleById } from '../../../constants/visual-styles'
import type { ImageGenerationRequest } from '../../../types/ai-providers'
import { ContentRestrictedError } from '../../../services/providers/image/replicate-image.provider'
import { getMediaProviderForTask } from '../../../services/media/media-factory'

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

  // 2. Configurar Provider (via Media Factory → DB → env fallback)
  let imageProvider
  try {
    imageProvider = providerManager.getImageProvider()
  } catch {
    // Fallback: resolver via Media Factory (que lê do banco com fallback para env)
    const config = await getMediaProviderForTask('image-generation')
    if (config?.apiKey) {
      imageProvider = createImageProvider(config.providerId, config.apiKey, config.model, config.inputSchema)
    } else {
      throw new Error('Image Provider not configured. Configure via Settings → Providers.')
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

  // ─── VISUAL CONTINUITY ENGINE (MESMA LÓGICA DO PIPELINE) ───
  // Monta Style Anchor a partir dos campos de estilo visual
  let styleAnchorParts: string[] = []
  if (vs) {
    if (vs.baseStyle) styleAnchorParts.push(vs.baseStyle)
    if (vs.lightingTags) styleAnchorParts.push(vs.lightingTags)
    if (vs.atmosphereTags) styleAnchorParts.push(vs.atmosphereTags)
    if (vs.compositionTags) styleAnchorParts.push(vs.compositionTags)
    if (vs.tags) styleAnchorParts.push(vs.tags)
  }
  const styleAnchor = styleAnchorParts.length > 0
    ? `[VISUAL STYLE ANCHOR — ${styleAnchorParts.join(', ')}]`
    : ''

  // Buscar cena anterior para contexto de continuidade
  const prevScene = await prisma.scene.findFirst({
    where: {
      outputId: output.id,
      order: { lt: scene.order }
    },
    orderBy: { order: 'desc' },
    select: {
      sceneEnvironment: true,
      visualDescription: true
    }
  })

  // Determinar se é mesmo ambiente da cena anterior
  const isSameEnvironment = prevScene
    && scene.sceneEnvironment
    && prevScene.sceneEnvironment
    && scene.sceneEnvironment === prevScene.sceneEnvironment

  // Construir prompt visual com Anchor + Continuity
  let promptToUse = body.prompt ?? scene.visualDescription

  if (styleAnchor) {
    if (isSameEnvironment && prevScene) {
      // Mesmo ambiente → Anchor + Continuity
      const continuityContext = prevScene.visualDescription.slice(0, 300)
      promptToUse = `${styleAnchor}\n[VISUAL CONTINUITY — same environment "${scene.sceneEnvironment}": ${continuityContext}]\n\n${promptToUse}`
      console.log(`[API] 🔗 Regeneração com Continuity + Anchor (env: ${scene.sceneEnvironment})`)
    } else {
      // Novo ambiente → Só Anchor (transição limpa)
      promptToUse = `${styleAnchor}\n\n${promptToUse}`
      console.log(`[API] 🎨 Regeneração com Anchor only${scene.sceneEnvironment ? ` (env: ${scene.sceneEnvironment})` : ''}`)
    }
  }

  const request: ImageGenerationRequest = {
    prompt: promptToUse,
    width,
    height,
    aspectRatio: output.aspectRatio || '16:9',
    seed: body.seed || undefined,
    numVariants: 1
  }

  console.log(`[API] 🖼️ [DEBUG] Regenerar imagem — Scene ${sceneId} — prompt com anchor/continuity:\n${request.prompt}`)

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
  const imgModel = response.model || 'luma/photon-flash'
  const imgCost = calculateReplicateOutputCost(imgModel, 1) ?? 0

  costLogService.log({
    outputId: output.id,
    resource: 'image',
    action: 'recreate',
    provider: 'REPLICATE',
    model: imgModel,
    cost: imgCost,
    metadata: { num_images: 1, cost_per_image: imgCost },
    detail: `Scene image regeneration (single)`
  }).catch(() => { })

  return newImage
})
