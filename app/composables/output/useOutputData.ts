import { ref } from 'vue'
import type { OutputData } from '~/types/output'

type AfterLoadHook = (data: OutputData) => void

/**
 * Core output state and data loading.
 *
 * Side-effects (e.g. restoring hook level, clearing generation stage)
 * should be registered via `onAfterLoad()` in the consuming component.
 */
export function useOutputData(outputId: string) {
  const output = ref<OutputData | null>(null)
  const loading = ref(true)
  const afterLoadHooks: AfterLoadHook[] = []

  function onAfterLoad(fn: AfterLoadHook) {
    afterLoadHooks.push(fn)
  }

  async function loadOutput() {
    try {
      const data = await $fetch<OutputData>(`/api/outputs/${outputId}`)
      output.value = data
      for (const fn of afterLoadHooks) fn(data)
    } catch {
      // Fail silently — output will show loading state
    } finally {
      loading.value = false
    }
  }

  return { output, loading, loadOutput, onAfterLoad }
}
