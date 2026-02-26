import { ref, type Ref } from 'vue'
import type { OutputData } from '~/types/output'
import { useNotification } from '~/utils/useNotification'

/**
 * Voice change modal and logic: open modal, confirm voice change, trigger audio re-generation.
 */
export function useVoiceChange(
  outputId: string,
  output: Ref<OutputData | null>,
  generatingStage: Ref<string | null>,
  generationStartedAt: Ref<number>,
  startPolling: () => void,
) {
  const { error: notifyError, warning: notifyWarning } = useNotification()

  const showChangeVoiceModal = ref(false)
  const newVoiceId = ref<string | null>(null)
  const changingVoice = ref(false)

  function openChangeVoiceModal() {
    showChangeVoiceModal.value = true
  }

  async function confirmChangeVoice() {
    const sameVoice = newVoiceId.value === output.value?.voiceId
    if (!newVoiceId.value || sameVoice) return

    showChangeVoiceModal.value = false
    changingVoice.value = true
    generatingStage.value = 'AUDIO'
    generationStartedAt.value = Date.now()

    try {
      await $fetch(`/api/outputs/${outputId}/change-voice`, {
        method: 'POST',
        body: { voiceId: newVoiceId.value },
      })

      output.value!.voiceId = newVoiceId.value
      output.value!.speechConfiguredAt = new Date().toISOString()

      startPolling()
    } catch (error: any) {
      generatingStage.value = null
      generationStartedAt.value = 0
      const msg = error?.data?.message || error?.message || 'Erro desconhecido'
      notifyError(`Erro ao trocar narrador: ${msg}`)
    } finally {
      changingVoice.value = false
      newVoiceId.value = null
    }
  }

  return {
    showChangeVoiceModal,
    newVoiceId,
    changingVoice,
    openChangeVoiceModal,
    confirmChangeVoice,
  }
}
