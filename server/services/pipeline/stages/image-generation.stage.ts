/**
 * Image Generation Stage
 * Generates scene images with visual continuity, custom scene refs, and character refs.
 *
 * Extracted from output-pipeline.service.ts generateImages() for isolation,
 * testability, and reuse (e.g. regenerate-images endpoint).
 *
 * Flow:
 *  1. Build style anchor from visual style tags
 *  2. Load custom scene reference images + creator image prompts
 *  3. Load character reference images (DossierPerson.referenceImage)
 *  4. Sequential scene processing with visual continuity
 *     - Priority: customRef > characterRef > previousSceneRef
 *  5. Generate end images when endVisualDescription exists
 *  6. Handle content-restricted and filtered errors gracefully
 *  7. Mark scene imageStatus and log costs
 */

import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../providers'
import { costLogService } from '../../cost-log.service'
import { validateMediaPricing } from '../../../constants/pricing'
import { buildStyleAnchorParts, type VisualStyleLike } from './_shared/build-production-context'
import { createPipelineLogger } from '../../../utils/pipeline-logger'
import type { ImageGenerationRequest } from '../../../types/ai-providers'

const LOG = '[ImageStage]'

// ─── INTERFACES ──────────────────────────────────────────────────────

export interface ImageStageInput {
  outputId: string
  aspectRatio?: string | null
  seed?: number | null
  visualStyle?: (VisualStyleLike & { negativeTags?: string }) | null
  /** storyOutline from output — used to read _customScenes */
  storyOutline?: any
}

// ─── STAGE ───────────────────────────────────────────────────────────

class ImageGenerationStage {

  async execute(input: ImageStageInput): Promise<void> {
    const { outputId } = input
    const log = createPipelineLogger({ stage: 'Images', outputId })

    try {
      const imageProvider = providerManager.getImageProvider()
      log.info(`Image provider: ${imageProvider.getName()}.`)

      // Validate pricing before spending money
      const imageModel = (imageProvider as any).model || 'luma/photon-flash'
      validateMediaPricing(imageModel, imageProvider.getName())

      const scenes = await prisma.scene.findMany({
        where: { outputId },
        orderBy: { order: 'asc' },
      })

      log.info(`${scenes.length} scenes to generate images for.`)

      let restrictedCount = 0
      let successCount = 0
      let errorCount = 0

      // ─── Visual Style Anchor ─────────────────────────────────────
      // Lightweight prefix that stabilizes the image generation model.
      // Semantic visual continuity between scenes is handled by the
      // filmmaker director during script generation.
      const styleAnchor = this.buildStyleAnchor(input.visualStyle)
      const styleNegativePrompt = input.visualStyle?.negativeTags || undefined

      if (styleAnchor) {
        log.info(`Style Anchor: ${styleAnchor.slice(0, 100)}...`)
      }

      // ─── Custom Scenes: load reference images for image-to-image ──
      const { customSceneImageMap, customScenePromptMap } =
        await this.loadCustomSceneReferences(input.storyOutline, log)

      // ─── Character References: load person images for visual consistency ──
      const characterRefMap = await this.loadCharacterReferences(scenes, log)

      // ─── Sequential processing with visual continuity ────────────
      // Scenes are processed one by one so the generated image from the
      // previous scene can serve as imageReference for the next one
      // (when they share the same environment).
      // Priority: customRef > characterRef > previousSceneRef
      const generatedImageMap = new Map<number, Buffer>()

      for (let idx = 0; idx < scenes.length; idx++) {
        const scene = scenes[idx]!
        try {
          log.step(`Scene ${idx + 1}/${scenes.length}`, `sceneId=${scene.id}`)

          const { width, height } = this.resolveImageDimensions(input.aspectRatio)

          // Build visual prompt: Style Anchor + Visual Continuity + visualDescription
          const prevScene = idx > 0 ? scenes[idx - 1] : undefined
          const isSameEnv = this.isSameEnvironment(scene, prevScene)

          let visualPrompt = this.buildVisualPrompt(
            scene.visualDescription, styleAnchor, isSameEnv, prevScene, scene.sceneEnvironment, idx, log,
          )

          // Inject creator's image prompt if available
          const sceneOrder = idx + 1
          const creatorImagePrompt = customScenePromptMap.get(sceneOrder)
          if (creatorImagePrompt) {
            visualPrompt = `${visualPrompt}\n\n[CREATOR IMAGE PROMPT REFERENCE: ${creatorImagePrompt}]`
          }

          log.step(`Scene ${idx + 1}/${scenes.length}`, `prompt: ${visualPrompt.slice(0, 80)}...`)

          // Resolve image reference with priority: customRef > characterRef > previousSceneRef
          const imageRefConfig = this.resolveImageReference(
            sceneOrder, idx, scene, customSceneImageMap, characterRefMap, generatedImageMap, isSameEnv, log,
          )

          const imageRequest: ImageGenerationRequest = {
            prompt: visualPrompt,
            negativePrompt: styleNegativePrompt,
            width,
            height,
            aspectRatio: input.aspectRatio || '16:9',
            seed: input.seed ?? undefined,
            numVariants: 1,
            ...(imageRefConfig || {}),
          }

          const imageResponse = await imageProvider.generate(imageRequest)
          const generatedImage = imageResponse.images[0]

          if (generatedImage) {
            // Store image buffer for next scene's visual continuity
            generatedImageMap.set(idx, Buffer.from(generatedImage.buffer))

            await this.persistStartImage(scene.id, imageProvider.getName(), scene.visualDescription, generatedImage)

            costLogService.log({
              outputId,
              resource: 'image',
              action: 'create',
              provider: imageResponse.costInfo.provider,
              model: imageResponse.costInfo.model,
              cost: imageResponse.costInfo.cost,
              metadata: imageResponse.costInfo.metadata,
              detail: `Scene ${idx + 1} - image generation`,
            }).catch(() => {})

            // ─── End image (last_image keyframe) ────────────────
            if (scene.endVisualDescription) {
              await this.generateEndImage(
                scene, generatedImage, styleAnchor, input, imageProvider, outputId, idx, log,
              )
            }
          }

          successCount++
        } catch (error: any) {
          await this.handleSceneError(error, scene, idx, log)

          if (this.isContentRestricted(error)) {
            restrictedCount++
          } else {
            errorCount++
          }
        }
      }

      // Mark successfully generated scenes
      await this.markGeneratedScenes(outputId, scenes)

      log.info(`Image generation complete: ${successCount} OK, ${restrictedCount} restricted, ${errorCount} errors.`)

      if (restrictedCount > 0) {
        log.warn(`${restrictedCount} scene(s) blocked by content filter. User can review and regenerate in the review screen.`)
      }
    } catch (error) {
      log.error('Failed to generate images.', error)
      throw error
    }
  }

  // ─── PRIVATE: Style Anchor ───────────────────────────────────────

  private buildStyleAnchor(visualStyle: ImageStageInput['visualStyle']): string {
    const parts = buildStyleAnchorParts(visualStyle)
    return parts.length > 0
      ? `[VISUAL STYLE ANCHOR -- ${parts.join(', ')}]`
      : ''
  }

  // ─── PRIVATE: Custom Scene References ────────────────────────────

  private async loadCustomSceneReferences(
    storyOutline: any,
    log: ReturnType<typeof createPipelineLogger>,
  ): Promise<{
    customSceneImageMap: Map<number, Buffer>
    customScenePromptMap: Map<number, string>
  }> {
    const customSceneImageMap = new Map<number, Buffer>()
    const customScenePromptMap = new Map<number, string>()

    const customScenes = storyOutline?._customScenes as
      | Array<{ order: number; narration: string; referenceImageId?: string | null; imagePrompt?: string | null }>
      | undefined

    if (!customScenes || customScenes.length === 0) {
      return { customSceneImageMap, customScenePromptMap }
    }

    // Collect creator's image prompts (available even without reference image)
    for (const s of customScenes) {
      if (s.imagePrompt) customScenePromptMap.set(s.order, s.imagePrompt)
    }

    const imageIds = customScenes
      .filter(s => s.referenceImageId)
      .map(s => ({ sceneOrder: s.order, imageId: s.referenceImageId! }))

    if (imageIds.length > 0) {
      const refImages = await prisma.dossierImage.findMany({
        where: { id: { in: imageIds.map(i => i.imageId) } },
        select: { id: true, imageData: true },
      })

      for (const { sceneOrder, imageId } of imageIds) {
        const img = refImages.find(i => i.id === imageId)
        if (img?.imageData) {
          customSceneImageMap.set(sceneOrder, Buffer.from(img.imageData))
        }
      }

      if (customSceneImageMap.size > 0) {
        log.info(`${customSceneImageMap.size} custom scene reference image(s) loaded.`)
      }
    }

    if (customScenePromptMap.size > 0) {
      log.info(`${customScenePromptMap.size} creator image prompt(s) loaded.`)
    }

    return { customSceneImageMap, customScenePromptMap }
  }

  // ─── PRIVATE: Character References ───────────────────────────────

  private async loadCharacterReferences(
    scenes: Array<{ characterRef: string | null }>,
    log: ReturnType<typeof createPipelineLogger>,
  ): Promise<Map<string, Buffer>> {
    const characterRefMap = new Map<string, Buffer>()

    const characterRefIds = [...new Set(
      scenes.filter(s => s.characterRef).map(s => s.characterRef!),
    )]

    if (characterRefIds.length === 0) return characterRefMap

    const refPersons = await prisma.dossierPerson.findMany({
      where: { id: { in: characterRefIds }, referenceImage: { not: null } },
      select: { id: true, referenceImage: true },
    })

    for (const p of refPersons) {
      if (p.referenceImage) {
        characterRefMap.set(p.id, Buffer.from(p.referenceImage))
      }
    }

    log.info(`${characterRefMap.size}/${characterRefIds.length} character reference(s) loaded.`)
    return characterRefMap
  }

  // ─── PRIVATE: Image Dimensions ───────────────────────────────────

  private resolveImageDimensions(aspectRatio?: string | null): { width: number; height: number } {
    const isPortrait = aspectRatio === '9:16'
    return {
      width: isPortrait ? 768 : 1344,
      height: isPortrait ? 1344 : 768,
    }
  }

  // ─── PRIVATE: Environment Continuity Check ───────────────────────

  private isSameEnvironment(
    current: { sceneEnvironment: string | null },
    previous?: { sceneEnvironment: string | null },
  ): boolean {
    return !!(
      previous
      && current.sceneEnvironment
      && previous.sceneEnvironment
      && current.sceneEnvironment === previous.sceneEnvironment
    )
  }

  // ─── PRIVATE: Visual Prompt Builder ──────────────────────────────

  private buildVisualPrompt(
    visualDescription: string,
    styleAnchor: string,
    isSameEnv: boolean,
    prevScene: { visualDescription: string } | undefined,
    sceneEnvironment: string | null,
    idx: number,
    log: ReturnType<typeof createPipelineLogger>,
  ): string {
    let visualPrompt = visualDescription

    if (!styleAnchor) return visualPrompt

    if (isSameEnv && prevScene) {
      const continuityContext = prevScene.visualDescription.slice(0, 300)
      visualPrompt = `${styleAnchor}\n[VISUAL CONTINUITY -- same environment "${sceneEnvironment}": ${continuityContext}]\n\n${visualPrompt}`
      log.step(`Scene ${idx + 1}`, `Continuity tag injected (env: ${sceneEnvironment})`)
    } else {
      visualPrompt = `${styleAnchor}\n\n${visualPrompt}`
    }

    log.step(`Scene ${idx + 1}`, `Anchor applied${sceneEnvironment ? ` (env: ${sceneEnvironment})` : ''}`)
    return visualPrompt
  }

  // ─── PRIVATE: Image Reference Priority ───────────────────────────

  private resolveImageReference(
    sceneOrder: number,
    idx: number,
    scene: { characterRef: string | null; sceneEnvironment: string | null },
    customSceneImageMap: Map<number, Buffer>,
    characterRefMap: Map<string, Buffer>,
    generatedImageMap: Map<number, Buffer>,
    isSameEnv: boolean,
    log: ReturnType<typeof createPipelineLogger>,
  ): { imageReference: Buffer; imageReferenceWeight: number } | undefined {
    // Custom scene reference image (creator upload)
    const customRefBuffer = customSceneImageMap.get(sceneOrder)
    if (customRefBuffer) {
      log.step(`Scene ${idx + 1}`, `Creator visual reference applied (weight: 0.5)`)
      return { imageReference: customRefBuffer, imageReferenceWeight: 0.5 }
    }

    // Character reference image (DossierPerson)
    const charRefBuffer = scene.characterRef
      ? characterRefMap.get(scene.characterRef)
      : undefined
    if (charRefBuffer) {
      log.step(`Scene ${idx + 1}`, `Character reference applied (weight: 0.5, ref: ${scene.characterRef})`)
      return { imageReference: charRefBuffer, imageReferenceWeight: 0.5 }
    }

    // Previous scene image (visual continuity within same environment)
    const prevSceneImageBuffer = isSameEnv ? generatedImageMap.get(idx - 1) : undefined
    if (prevSceneImageBuffer) {
      log.step(`Scene ${idx + 1}`, `Previous scene reference applied (weight: 0.4, env: ${scene.sceneEnvironment})`)
      return { imageReference: prevSceneImageBuffer, imageReferenceWeight: 0.4 }
    }

    return undefined
  }

  // ─── PRIVATE: Persist Start Image ────────────────────────────────

  private async persistStartImage(
    sceneId: string,
    providerName: string,
    promptUsed: string,
    generatedImage: { buffer: Buffer; width: number; height: number },
  ): Promise<void> {
    await prisma.sceneImage.create({
      data: {
        sceneId,
        role: 'start',
        provider: providerName as any,
        promptUsed,
        fileData: Buffer.from(generatedImage.buffer) as any,
        mimeType: 'image/png',
        originalSize: generatedImage.buffer.length,
        width: generatedImage.width,
        height: generatedImage.height,
        isSelected: true,
        variantIndex: 0,
      },
    })
  }

  // ─── PRIVATE: End Image Generation ───────────────────────────────

  private async generateEndImage(
    scene: { id: string; endVisualDescription: string | null; endImageReferenceWeight: number | null },
    startImage: { buffer: Buffer },
    styleAnchor: string,
    input: ImageStageInput,
    imageProvider: ReturnType<typeof providerManager.getImageProvider>,
    outputId: string,
    idx: number,
    log: ReturnType<typeof createPipelineLogger>,
  ): Promise<void> {
    if (!scene.endVisualDescription) return

    try {
      let endVisualPrompt = scene.endVisualDescription
      if (styleAnchor) {
        endVisualPrompt = `${styleAnchor}\n\n${endVisualPrompt}`
      }

      const { width, height } = this.resolveImageDimensions(input.aspectRatio)

      const endImageRequest: ImageGenerationRequest = {
        prompt: endVisualPrompt,
        width,
        height,
        aspectRatio: input.aspectRatio || '16:9',
        seed: input.seed ?? undefined,
        numVariants: 1,
        imageReference: Buffer.from(startImage.buffer),
        imageReferenceWeight: scene.endImageReferenceWeight ?? 0.7,
      }

      const endImageResponse = await imageProvider.generate(endImageRequest)
      const endGenerated = endImageResponse.images[0]

      if (endGenerated) {
        await prisma.sceneImage.create({
          data: {
            sceneId: scene.id,
            role: 'end',
            provider: imageProvider.getName() as any,
            promptUsed: scene.endVisualDescription,
            fileData: Buffer.from(endGenerated.buffer) as any,
            mimeType: 'image/png',
            originalSize: endGenerated.buffer.length,
            width: endGenerated.width,
            height: endGenerated.height,
            isSelected: true,
            variantIndex: 0,
          },
        })

        costLogService.log({
          outputId,
          resource: 'image',
          action: 'create',
          provider: endImageResponse.costInfo.provider,
          model: endImageResponse.costInfo.model,
          cost: endImageResponse.costInfo.cost,
          metadata: endImageResponse.costInfo.metadata,
          detail: `Scene ${idx + 1} - end image (last_image keyframe)`,
        }).catch(() => {})

        log.step(`Scene ${idx + 1}`, `End image generated (ref weight: ${scene.endImageReferenceWeight ?? 0.7})`)
      }
    } catch (endErr: any) {
      log.warn(`Scene ${idx + 1} end image failed (non-blocking): ${endErr?.message?.slice(0, 100)}`)
    }
  }

  // ─── PRIVATE: Content Restriction Detection ──────────────────────

  private isContentRestricted(error: any): boolean {
    // Check by constructor name since errors are dynamically imported
    const name = error?.constructor?.name
    return name === 'ContentRestrictedError' || name === 'GeminiContentFilteredError'
  }

  // ─── PRIVATE: Scene Error Handler ────────────────────────────────

  private async handleSceneError(
    error: any,
    scene: { id: string },
    idx: number,
    log: ReturnType<typeof createPipelineLogger>,
  ): Promise<void> {
    const { ContentRestrictedError } = await import('../../providers/image/replicate-image.provider')
    const { GeminiContentFilteredError } = await import('../../providers/image/gemini-image.provider')

    if (error instanceof ContentRestrictedError || error instanceof GeminiContentFilteredError) {
      log.warn(`Scene ${idx + 1} RESTRICTED by content filter: ${error.message.slice(0, 100)}`)

      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          imageStatus: 'restricted',
          imageRestrictionReason: error.message,
        },
      })
    } else {
      log.error(`Scene ${idx + 1} failed (non-safety error): ${error?.message?.slice(0, 100) || error}`)

      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          imageStatus: 'error',
          imageRestrictionReason: error?.message?.slice(0, 500) || 'Unknown error',
        },
      })
    }
  }

  // ─── PRIVATE: Mark Generated Scenes ──────────────────────────────

  private async markGeneratedScenes(
    outputId: string,
    scenes: Array<{ id: string; imageStatus: string | null }>,
  ): Promise<void> {
    const generatedSceneIds = await prisma.sceneImage.findMany({
      where: { scene: { outputId } },
      select: { sceneId: true },
    })

    const generatedIds = new Set(generatedSceneIds.map(s => s.sceneId))

    for (const scene of scenes) {
      if (generatedIds.has(scene.id) && !['restricted', 'error'].includes(scene.imageStatus || '')) {
        await prisma.scene.update({
          where: { id: scene.id },
          data: { imageStatus: 'generated' },
        })
      }
    }
  }
}

export const imageGenerationStage = new ImageGenerationStage()
