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

  // Construir lista de gerações necessárias
  const requestedRole = body.role as 'start' | 'end' | undefined
  const generationsNeeded: Array<{ prompt: string; role: 'start' | 'end' }> = []

  if (!requestedRole || requestedRole === 'start') {
    generationsNeeded.push({ prompt: body.prompt ?? scene.visualDescription, role: 'start' })
  }

  if ((!requestedRole || requestedRole === 'end') && scene.endVisualDescription) {
    generationsNeeded.push({ prompt: body.endPrompt ?? scene.endVisualDescription, role: 'end' })
  }

  // 4. Executar Gerações
  const results: any[] = []

  for (const gen of generationsNeeded) {
    // Aplicar Style Anchor + Continuity Engine para cada prompt
    let promptToUse = gen.prompt

    if (styleAnchor) {
      if (isSameEnvironment && prevScene) {
        // Mesmo ambiente → Anchor + Continuity
        // NOTA: Para o keyframe de fim, a continuidade é com o início da própria cena ou com a cena anterior?
        // Geralmente continuidade visual é entre cenas. Manteremos a lógica atual.
        const continuityContext = prevScene.visualDescription.slice(0, 300)
        promptToUse = `${styleAnchor}\n[VISUAL CONTINUITY — same environment "${scene.sceneEnvironment}": ${continuityContext}]\n\n${promptToUse}`
      } else {
        // Novo ambiente → Só Anchor
        promptToUse = `${styleAnchor}\n\n${promptToUse}`
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

    // === IMAGE REFERENCE para END images ===
    // Se estamos gerando a END image, buscar a START image existente como referência
    if (gen.role === 'end') {
      const startImage = await prisma.sceneImage.findFirst({
        where: { sceneId, role: 'start', isSelected: true },
        select: { fileData: true }
      })

      if (startImage?.fileData) {
        request.imageReference = Buffer.from(startImage.fileData as any)
        request.imageReferenceWeight = scene.endImageReferenceWeight ?? 0.5
        console.log(`[API] 🔗 Using START image as reference for END (weight: ${request.imageReferenceWeight})`)
      }
    }

    console.log(`[API] 🖼️ Regenerando ${gen.role} para Scene ${sceneId}`)

    try {
      const response = await imageProvider.generate(request)
      const generated = response.images[0]
      if (!generated) continue

      // Salvar no Banco — desmarcar anteriores do MESMO role como selecionadas
      // Se for regeneração de 'start', também desmarca imagens sem role (legado)
      if (gen.role === 'start') {
        await prisma.sceneImage.updateMany({
          where: {
            sceneId,
            NOT: { role: 'end' }
          },
          data: { isSelected: false }
        })
      } else {
        await prisma.sceneImage.updateMany({
          where: { sceneId, role: 'end' },
          data: { isSelected: false }
        })
      }

      const newImage = await prisma.sceneImage.create({
        data: {
          sceneId,
          role: gen.role,
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

      results.push(newImage)

      // Registrar custo
      const imgModel = response.model || 'luma/photon-flash'
      const imgCost = calculateReplicateOutputCost(imgModel, 1) ?? 0

      costLogService.log({
        outputId: output.id,
        resource: 'image',
        action: 'recreate',
        provider: 'REPLICATE',
        model: imgModel,
        cost: imgCost,
        metadata: { num_images: 1, cost_per_image: imgCost, role: gen.role },
        detail: `Scene image regeneration (${gen.role})`
      }).catch(() => { })

    } catch (err: any) {
      if (err instanceof ContentRestrictedError) {
        await prisma.scene.update({
          where: { id: sceneId },
          data: { imageStatus: 'restricted', imageRestrictionReason: err.message }
        })
        throw createError({
          statusCode: 422,
          data: { code: 'CONTENT_RESTRICTED', role: gen.role, reason: err.message },
          message: `O prompt (${gen.role}) foi rejeitado pelo filtro de conteúdo.`
        })
      }
      throw err
    }
  }

  // 6. Limpar status de restrição da cena
  await prisma.scene.update({
    where: { id: sceneId },
    data: { imageStatus: 'generated', imageRestrictionReason: null }
  })

  return results.length === 1 ? results[0] : results
})
