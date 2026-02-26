import { ref, computed, type Ref } from 'vue'
import type { OutputData } from '~/types/output'
import { useNotification } from '~/utils/useNotification'

type OpenRenderModalFn = (
  action: 'master' | 'again',
  options?: { beforeRender?: () => Promise<void> },
) => Promise<void>

/**
 * Correction mode: post-render image/motion editing and re-render flow.
 */
export function useCorrectionMode(
  outputId: string,
  output: Ref<OutputData | null>,
  loadOutput: () => Promise<void>,
  loadCosts: () => Promise<void>,
  handleApiError: (error: unknown, fallback: string) => void,
  rendering: Ref<boolean>,
  openRenderOptionsModal: OpenRenderModalFn,
  /** Shared with pipeline composable — both use the same ref */
  regeneratingSceneId: Ref<string | null>,
) {
  const { warning: notifyWarning, error: notifyError } = useNotification()

  // ---------------------------------------------------------------------------
  // Core correction state
  // ---------------------------------------------------------------------------
  const correctionMode = computed(() => {
    if (!output.value) return false
    const gates = output.value.stageGates || []
    const scriptGate = gates.find(g => g.stage === 'SCRIPT')
    const imagesGate = gates.find(g => g.stage === 'IMAGES')
    const hasVideo = output.value.status === 'COMPLETED' || output.value.status === 'RENDERED' || !!output.value.renderProduct
    return (
      hasVideo &&
      output.value.status === 'DRAFT' &&
      scriptGate?.status === 'APPROVED' &&
      imagesGate?.status !== 'APPROVED'
    )
  })

  const enteringCorrections = ref(false)
  const regeneratingMotionSceneIds = ref<Set<string>>(new Set())
  const correctedScenes = ref<Set<string>>(new Set())
  const motionRegeneratedScenes = ref<Set<string>>(new Set())
  const imageVersions = ref<Record<string, number>>({})
  const motionVersions = ref<Record<string, number>>({})

  const pendingMotionScenes = computed(() => {
    return [...correctedScenes.value].filter((id) => !motionRegeneratedScenes.value.has(id))
  })

  // ---------------------------------------------------------------------------
  // Visual prompt editing
  // ---------------------------------------------------------------------------
  const editingPromptSceneId = ref<string | null>(null)
  const editingPromptText = ref('')

  function startEditPrompt(scene: any) {
    editingPromptSceneId.value = scene.id
    editingPromptText.value = scene.visualDescription
  }

  function cancelEditPrompt(_scene: any) {
    editingPromptSceneId.value = null
    editingPromptText.value = ''
  }

  async function saveEditPrompt(scene: any) {
    if (!editingPromptText.value.trim()) return
    try {
      const payload: any = { visualDescription: editingPromptText.value.trim() }
      await $fetch(`/api/scenes/${scene.id}/update`, {
        method: 'PATCH',
        body: payload,
      })
      scene.visualDescription = payload.visualDescription
    } catch {
      notifyError('Erro ao salvar o prompt visual.')
    }
    editingPromptSceneId.value = null
    editingPromptText.value = ''
  }

  // ---------------------------------------------------------------------------
  // Sanitization (shared with scene viewer)
  // regeneratingSceneId is external (shared with pipeline composable)
  // ---------------------------------------------------------------------------
  const expandedPromptScenes = ref<Set<string>>(new Set())
  const restrictedPromptEdits = ref<Record<string, string>>({})
  const sanitizingSceneId = ref<string | null>(null)
  const sanitizingLevel = ref<string | null>(null)
  const lastSanitizeLevel = ref<Record<string, string>>({})

  async function callSanitizeApi(sceneId: string, level: 'moderate' | 'safe'): Promise<string | null> {
    if (sanitizingSceneId.value) return null
    sanitizingSceneId.value = sceneId
    sanitizingLevel.value = level
    try {
      const result = (await $fetch(`/api/scenes/${sceneId}/sanitize-prompt`, {
        method: 'POST',
        body: { level },
      })) as any
      return result.sanitizedPrompt as string
    } catch {
      notifyError('Erro ao reescrever o prompt. Tente novamente.')
      return null
    } finally {
      sanitizingSceneId.value = null
      sanitizingLevel.value = null
    }
  }

  async function sanitizeAndFillEdit(scene: any, level: 'intense' | 'moderate' | 'safe') {
    if (level === 'intense') {
      editingPromptText.value = scene.visualDescription
      return
    }
    const sanitized = await callSanitizeApi(scene.id, level)
    if (sanitized !== null) editingPromptText.value = sanitized
  }

  async function sanitizeRestrictedPrompt(scene: any, level: 'intense' | 'moderate' | 'safe') {
    if (level === 'intense') {
      restrictedPromptEdits.value = { ...restrictedPromptEdits.value, [scene.id]: scene.visualDescription }
      delete lastSanitizeLevel.value[scene.id]
      return
    }
    const sanitized = await callSanitizeApi(scene.id, level)
    if (sanitized !== null) {
      restrictedPromptEdits.value = { ...restrictedPromptEdits.value, [scene.id]: sanitized }
      lastSanitizeLevel.value = { ...lastSanitizeLevel.value, [scene.id]: level }
    }
  }

  async function retryRestrictedImage(scene: any, mode: 'same' | 'edited') {
    if (regeneratingSceneId.value) return
    regeneratingSceneId.value = scene.id

    const prompt =
      mode === 'edited' && restrictedPromptEdits.value[scene.id]
        ? restrictedPromptEdits.value[scene.id]
        : scene.visualDescription

    try {
      await $fetch(`/api/scenes/${scene.id}/regenerate-image`, {
        method: 'POST',
        body: { prompt },
      })
      delete restrictedPromptEdits.value[scene.id]
      correctedScenes.value = new Set([...correctedScenes.value, scene.id])
      await loadOutput()
      imageVersions.value = { ...imageVersions.value, [scene.id]: Date.now() }
    } catch (error: any) {
      if (error?.data?.data?.code === 'CONTENT_RESTRICTED') {
        notifyWarning('O prompt ainda foi rejeitado pelo filtro de conteúdo. Tente editar o prompt para usar termos mais abstratos.')
      } else {
        handleApiError(error, 'Erro ao regenerar imagem.')
      }
    } finally {
      regeneratingSceneId.value = null
    }
  }

  // ---------------------------------------------------------------------------
  // Save + regenerate (combined)
  // ---------------------------------------------------------------------------
  async function saveAndRegenerateImage(scene: any) {
    if (regeneratingSceneId.value) return
    if (!editingPromptText.value.trim()) return
    regeneratingSceneId.value = scene.id
    try {
      const newPrompt = editingPromptText.value.trim()
      await $fetch(`/api/scenes/${scene.id}/update`, {
        method: 'PATCH',
        body: { visualDescription: newPrompt },
      })
      scene.visualDescription = newPrompt
      await $fetch(`/api/scenes/${scene.id}/regenerate-image`, {
        method: 'POST',
        body: { prompt: newPrompt },
      })
      editingPromptSceneId.value = null
      editingPromptText.value = ''
      correctedScenes.value = new Set([...correctedScenes.value, scene.id])
      await loadOutput()
      imageVersions.value = { ...imageVersions.value, [scene.id]: Date.now() }
    } catch (error: any) {
      if (error?.data?.data?.code === 'CONTENT_RESTRICTED') {
        notifyWarning('O prompt ainda foi rejeitado pelo filtro de conteúdo. Tente um nível mais seguro (Moderado ou Seguro).')
      } else {
        handleApiError(error, 'Erro ao salvar e regenerar imagem.')
      }
    } finally {
      regeneratingSceneId.value = null
    }
  }

  // ---------------------------------------------------------------------------
  // Enter / exit correction mode
  // ---------------------------------------------------------------------------
  async function enterCorrectionMode() {
    if (enteringCorrections.value) return
    enteringCorrections.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/enter-corrections`, { method: 'PATCH' })
      output.value!.status = 'DRAFT'
      // Reset gates locally
      const gates = output.value!.stageGates || []
      for (const g of gates) {
        if (g.stage === 'IMAGES' || g.stage === 'MOTION' || g.stage === 'RENDER') {
          g.status = 'NOT_STARTED'
        }
      }
      correctedScenes.value = new Set()
      motionRegeneratedScenes.value = new Set()
      await loadOutput()
    } catch (error: any) {
      notifyError(error?.data?.message || 'Erro ao ativar modo correção.')
    } finally {
      enteringCorrections.value = false
    }
  }

  async function exitCorrectionMode() {
    if (rendering.value) return
    await openRenderOptionsModal('again', {
      beforeRender: async () => {
        await $fetch(`/api/outputs/${outputId}/approve-stage`, {
          method: 'PATCH',
          body: { stage: 'IMAGES', approved: true },
        })
        await $fetch(`/api/outputs/${outputId}/approve-stage`, {
          method: 'PATCH',
          body: { stage: 'MOTION', approved: true },
        })
        correctedScenes.value = new Set()
        motionRegeneratedScenes.value = new Set()
      },
    })
  }

  const finishCorrectionsAndRender = exitCorrectionMode

  // ---------------------------------------------------------------------------
  // Scene image & motion regeneration
  // ---------------------------------------------------------------------------
  async function regenerateSceneImages(scene: any, role?: 'start' | 'end') {
    if (regeneratingSceneId.value) return
    regeneratingSceneId.value = role ? `${scene.id}-${role}` : scene.id
    try {
      const body: any = {}
      if (role) body.role = role
      await $fetch(`/api/scenes/${scene.id}/regenerate-image`, {
        method: 'POST',
        body,
      })
      correctedScenes.value = new Set([...correctedScenes.value, scene.id])
      await loadOutput()
      imageVersions.value = { ...imageVersions.value, [scene.id]: Date.now() }
    } catch (error: unknown) {
      handleApiError(error, 'Erro ao regenerar imagem.')
    } finally {
      regeneratingSceneId.value = null
    }
  }

  async function regenerateMotionCorrection(scene: any) {
    if (regeneratingMotionSceneIds.value.has(scene.id)) return
    regeneratingMotionSceneIds.value = new Set([...regeneratingMotionSceneIds.value, scene.id])
    try {
      await $fetch(`/api/scenes/${scene.id}/regenerate-motion`, { method: 'POST' })
      const freshData = (await $fetch(`/api/outputs/${outputId}`)) as any
      const freshScene = freshData.scenes?.find((s: any) => s.id === scene.id)
      if (freshScene) scene.videos = freshScene.videos
      motionRegeneratedScenes.value = new Set([...motionRegeneratedScenes.value, scene.id])
      motionVersions.value = { ...motionVersions.value, [scene.id]: Date.now() }
      loadCosts()
    } catch (error: unknown) {
      handleApiError(error, 'Erro ao regenerar motion.')
    } finally {
      const next = new Set(regeneratingMotionSceneIds.value)
      next.delete(scene.id)
      regeneratingMotionSceneIds.value = next
    }
  }

  return {
    correctionMode,
    enteringCorrections,
    correctedScenes,
    motionRegeneratedScenes,
    imageVersions,
    motionVersions,
    pendingMotionScenes,
    editingPromptSceneId,
    editingPromptText,
    regeneratingSceneId,
    expandedPromptScenes,
    sanitizingSceneId,
    sanitizingLevel,
    restrictedPromptEdits,
    lastSanitizeLevel,
    enterCorrectionMode,
    exitCorrectionMode,
    finishCorrectionsAndRender,
    regenerateSceneImages,
    regenerateMotionCorrection,
    startEditPrompt,
    cancelEditPrompt,
    saveEditPrompt,
    sanitizeAndFillEdit,
    saveAndRegenerateImage,
    sanitizeRestrictedPrompt,
    retryRestrictedImage,
    regeneratingMotionSceneIds,
  }
}
