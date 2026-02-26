import { ref } from 'vue'
import type { PricingError } from '~/types/output'
import { useNotification } from '~/utils/useNotification'

export function useApiErrorHandler() {
  const pricingError = ref<PricingError | null>(null)
  const { error: notifyError } = useNotification()

  function handleApiError(error: unknown, fallbackMessage: string) {
    const err = error as Record<string, any> | undefined
    const data = err?.data?.data || err?.data
    if (data?.code === 'PRICING_NOT_CONFIGURED') {
      pricingError.value = {
        model: data.model,
        provider: data.provider,
        configUrl: data.configUrl,
      }
      return
    }
    notifyError(fallbackMessage)
  }

  return { pricingError, handleApiError }
}
