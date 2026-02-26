import { ref, type Ref, type ComputedRef } from 'vue'
import type { OutputData, CustomSceneEntry } from '~/types/output'
import { useNotification } from '~/utils/useNotification'

/**
 * Story outline: expand/collapse, regeneration, approval, hook level selection.
 *
 * Cross-composable dependencies:
 *   - needsSpeechConfig, generatingOutline, approving — from useOutputPipeline
 *   - customScenes — from useCustomScenes
 *   - selectedMonetizationItem — from useMonetizationPlan
 *   - openChangeVoiceModal — from useVoiceChange
 */
export function useStoryOutline(
  outputId: string,
  output: Ref<OutputData | null>,
  loadOutput: () => Promise<void>,
  needsSpeechConfig: ComputedRef<boolean>,
  generatingOutline: Ref<boolean>,
  approving: Ref<boolean>,
  customScenes: Ref<CustomSceneEntry[]>,
  selectedMonetizationItem: Ref<any>,
  openChangeVoiceModal: () => void,
) {
  const notify = useNotification()

  // ---------------------------------------------------------------------------
  // Outline UI state
  // ---------------------------------------------------------------------------
  const outlineExpanded = ref(true)
  const showOutlineFeedbackModal = ref(false)
  const outlineFeedback = ref('')
  const outlineSuggestions = ref('')
  const regeneratingOutline = ref(false)
  const selectedHookLevel = ref('moderate')
  const customHookText = ref('')

  // ---------------------------------------------------------------------------
  // Regenerate outline (from feedback modal)
  // ---------------------------------------------------------------------------
  async function confirmRegenerateOutline() {
    if (needsSpeechConfig.value) {
      openChangeVoiceModal()
      notify.warning('Antes de gerar o plano narrativo, selecione o narrador (voz) e a velocidade da fala (WPM).')
      return
    }
    regeneratingOutline.value = true
    try {
      const result = await $fetch(`/api/outputs/${outputId}/generate-outline`, {
        method: 'POST',
        body: { feedback: outlineFeedback.value.trim() || undefined },
      })

      // Optimistic update: storyOutlineData + gate reset
      if (output.value!.storyOutlineData) {
        output.value!.storyOutlineData.outlineData = (result as any).outline
      }
      const gates = output.value!.stageGates || []
      const outlineGate = gates.find(g => g.stage === 'STORY_OUTLINE')
      if (outlineGate) outlineGate.status = 'PENDING_REVIEW'
      else gates.push({ stage: 'STORY_OUTLINE', status: 'PENDING_REVIEW' })
      showOutlineFeedbackModal.value = false
      outlineFeedback.value = ''
      outlineExpanded.value = true
      selectedHookLevel.value = 'moderate'
      customHookText.value = ''
      customScenes.value = []

      await loadOutput()
    } catch (error: any) {
      notify.error(error?.data?.message || 'Erro ao gerar novo plano narrativo.')
    } finally {
      regeneratingOutline.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // Generate outline (first time / from PLANO stage)
  // ---------------------------------------------------------------------------
  async function generateOutlineThenReload() {
    if (needsSpeechConfig.value) {
      openChangeVoiceModal()
      notify.warning('Antes de gerar o plano narrativo, selecione o narrador (voz) e a velocidade da fala (WPM).')
      return
    }
    generatingOutline.value = true
    try {
      const body: any = {}
      if (outlineSuggestions.value.trim()) {
        body.feedback = outlineSuggestions.value.trim()
      }
      if (selectedMonetizationItem.value) {
        body.monetizationContext = selectedMonetizationItem.value
      }
      await $fetch(`/api/outputs/${outputId}/generate-outline`, {
        method: 'POST',
        body,
      })
      outlineSuggestions.value = ''
      selectedMonetizationItem.value = null
      await loadOutput()
    } catch (e: any) {
      notify.error(e?.data?.message || 'Erro ao gerar plano narrativo.')
    } finally {
      generatingOutline.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // Approve outline
  // ---------------------------------------------------------------------------
  async function approveStoryOutline() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: {
          stage: 'STORY_OUTLINE',
          approved: true,
          selectedHookLevel: selectedHookLevel.value,
          ...(selectedHookLevel.value === 'custom' && customHookText.value ? { customHook: customHookText.value } : {}),
          ...(customScenes.value.length > 0
            ? {
                customScenes: customScenes.value
                  .filter(s => s.narration.trim())
                  .map((s, i) => ({
                    order: i + 1,
                    narration: s.narration.trim(),
                    referenceImageId: s.referenceImageId || null,
                    imagePrompt: s.imagePrompt?.trim() || null,
                  })),
              }
            : {}),
        },
      })
      const gates2 = output.value!.stageGates || []
      const outlineGate2 = gates2.find(g => g.stage === 'STORY_OUTLINE')
      if (outlineGate2) outlineGate2.status = 'APPROVED'
      else gates2.push({ stage: 'STORY_OUTLINE', status: 'APPROVED' })
      await loadOutput()
    } catch {
      notify.error('Erro ao aprovar plano.')
    } finally {
      approving.value = false
    }
  }

  return {
    // UI state
    outlineExpanded,
    showOutlineFeedbackModal,
    outlineFeedback,
    outlineSuggestions,
    regeneratingOutline,
    selectedHookLevel,
    customHookText,

    // Actions
    confirmRegenerateOutline,
    generateOutlineThenReload,
    approveStoryOutline,
  }
}
