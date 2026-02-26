import { ref } from 'vue'
import type { OutputCosts } from '~/types/output'

/**
 * Output cost loading and formatting helpers.
 */
export function useOutputCosts(outputId: string) {
  const costs = ref<OutputCosts | null>(null)

  async function loadCosts() {
    try {
      const url: string = `/api/outputs/${outputId}/costs`
      costs.value = await $fetch<OutputCosts>(url)
    } catch {
      // Silent — costs are informational
    }
  }

  function formatCost(value: number): string {
    if (!value || value === 0) return '$0.00'
    if (value < 0.01) return `$${value.toFixed(4)}`
    return `$${value.toFixed(2)}`
  }

  function getStepCost(resource: string): number {
    if (!costs.value?.breakdown) return 0
    return costs.value.breakdown[resource] || 0
  }

  function isEstimatedCost(resource: string): boolean {
    if (!costs.value?.costAccuracy) return false
    return costs.value.costAccuracy[resource] === 'estimated'
  }

  function getExtraCost(key: 'thumbnail' | 'social_kit'): number {
    if (!costs.value?.logs) return 0
    if (key === 'thumbnail') {
      return costs.value.logs
        .filter((l) => l.resource === 'thumbnail')
        .reduce((sum, l) => sum + l.cost, 0)
    }
    if (key === 'social_kit') {
      return costs.value.logs
        .filter((l) => l.resource === 'script' && (l.metadata as any)?.step === 'social_kit')
        .reduce((sum, l) => sum + l.cost, 0)
    }
    return 0
  }

  return {
    costs,
    loadCosts,
    formatCost,
    getStepCost,
    isEstimatedCost,
    getExtraCost,
  }
}
