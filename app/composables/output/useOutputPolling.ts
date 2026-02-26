import { ref, type Ref } from 'vue'
import type { OutputData } from '~/types/output'
import { useNotification } from '~/utils/useNotification'

/**
 * Polling and stale-render detection for the output page.
 *
 * Caller is responsible for lifecycle (onMounted/onUnmounted).
 */
export function useOutputPolling(
  outputId: string,
  output: Ref<OutputData | null>,
  loadOutput: () => Promise<void>,
  loadCosts: () => Promise<void>,
  rendering: Ref<boolean>,
  generatingStage: Ref<string | null>,
) {
  const { error: notifyError } = useNotification()
  const renderStale = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let staleCheckTimer: ReturnType<typeof setTimeout> | null = null

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(async () => {
      if (!output.value) return
      const statusNeedsPolling =
        output.value.status === 'IN_PROGRESS' ||
        output.value.status === 'DRAFT'
      const generationInProgress = !!generatingStage.value
      if (statusNeedsPolling || generationInProgress) {
        await loadOutput()
        loadCosts()
      }
    }, 3000)
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  function startStaleDetection() {
    if (staleCheckTimer) clearTimeout(staleCheckTimer)
    if (output.value?.status === 'IN_PROGRESS' && !rendering.value) {
      staleCheckTimer = setTimeout(() => {
        if (output.value?.status === 'IN_PROGRESS' && !rendering.value) {
          renderStale.value = true
        }
      }, 60000)
    }
  }

  function stopStaleDetection() {
    if (staleCheckTimer) clearTimeout(staleCheckTimer)
    staleCheckTimer = null
  }

  async function cancelStaleRender() {
    try {
      await $fetch(`/api/outputs/${outputId}/cancel`, { method: 'POST' })
      renderStale.value = false
      await loadOutput()
    } catch (e: any) {
      notifyError('Erro ao cancelar: ' + (e?.data?.message || e?.message))
    }
  }

  return {
    renderStale,
    startPolling,
    stopPolling,
    startStaleDetection,
    stopStaleDetection,
    cancelStaleRender,
  }
}
