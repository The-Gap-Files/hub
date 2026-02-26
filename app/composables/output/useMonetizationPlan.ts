import { ref, computed, type Ref } from 'vue'
import type { OutputData } from '~/types/output'

/**
 * Monetization plan loading, item selection (teaser / full video), and hydration.
 */
export function useMonetizationPlan(
  output: Ref<OutputData | null>,
) {
  const monetizationPlan = ref<any>(null)
  const loadingMonetization = ref(false)

  const isMonetizationSelectionLocked = computed(() => {
    const o = output.value
    const ctx = o?.monetizationData?.contextData
    if (!o || !ctx || typeof ctx !== 'object') return false
    const itemType = (ctx as any).itemType
    if (itemType !== 'teaser' && itemType !== 'fullVideo') return false
    return o.format === 'teaser-youtube-shorts' || o.format === 'full-youtube'
  })

  const selectedMonetizationItem = ref<{
    itemType: 'teaser' | 'fullVideo'
    title: string
    hook: string
    angle: string
    angleCategory: string
    narrativeRole?: string
    shortFormatType?: string
    scriptOutline?: string
    cta?: string
    strategicNotes?: string
    scriptStyleId?: string
    scriptStyleName?: string
    editorialObjectiveId?: string
    editorialObjectiveName?: string
    avoidPatterns?: string[]
    sceneCount?: number
    microBriefV1?: any
    planId?: string
  } | null>(null)

  function hydrateSelectedMonetizationFromOutput() {
    if (!isMonetizationSelectionLocked.value) return
    const ctx = output.value?.monetizationData?.contextData
    if (!ctx || typeof ctx !== 'object') return
    const itemType = (ctx as any).itemType
    if (itemType !== 'teaser' && itemType !== 'fullVideo') return
    selectedMonetizationItem.value = {
      itemType,
      title: String((ctx as any).title || output.value?.title || ''),
      hook: String((ctx as any).hook || ''),
      angle: String((ctx as any).angle || ''),
      angleCategory: String((ctx as any).angleCategory || ''),
      narrativeRole: (ctx as any).narrativeRole,
      scriptOutline: (ctx as any).scriptOutline,
      cta: (ctx as any).cta,
      strategicNotes: (ctx as any).strategicNotes,
      scriptStyleId: (ctx as any).scriptStyleId,
      scriptStyleName: (ctx as any).scriptStyleName,
      editorialObjectiveId: (ctx as any).editorialObjectiveId,
      editorialObjectiveName: (ctx as any).editorialObjectiveName,
      avoidPatterns: (ctx as any).avoidPatterns,
    }
  }

  async function loadMonetizationPlan() {
    if (!output.value?.dossierId || monetizationPlan.value) return
    loadingMonetization.value = true
    try {
      const response = await $fetch(`/api/dossiers/${output.value.dossierId}/monetization-plans`) as any
      const plans = response?.data || []
      if (plans.length > 0) {
        const preferredPlanId = (output.value?.monetizationData?.contextData as any)?.planId
        monetizationPlan.value =
          (preferredPlanId ? plans.find((p: any) => p.id === preferredPlanId) : null) ||
          plans.find((p: any) => p.isActive) ||
          plans[0]
      }
    } catch {
      // Monetization is optional, fail silently
    } finally {
      loadingMonetization.value = false
    }
  }

  function selectMonetizationTeaser(teaser: any, _index: number) {
    if (isMonetizationSelectionLocked.value) return
    if (selectedMonetizationItem.value?.title === teaser.title) {
      selectedMonetizationItem.value = null
      return
    }
    selectedMonetizationItem.value = {
      itemType: 'teaser',
      title: teaser.title,
      hook: teaser.hook,
      angle: teaser.angle,
      angleCategory: teaser.angleCategory,
      narrativeRole: teaser.narrativeRole,
      shortFormatType: teaser.shortFormatType,
      scriptOutline: teaser.scriptOutline,
      cta: teaser.cta,
      strategicNotes: monetizationPlan.value?.planData?.strategicNotes || undefined,
      scriptStyleId: teaser.scriptStyleId,
      scriptStyleName: teaser.scriptStyleName,
      editorialObjectiveId: teaser.editorialObjectiveId,
      editorialObjectiveName: teaser.editorialObjectiveName,
      avoidPatterns: teaser.avoidPatterns,
      sceneCount: teaser.sceneCount,
      microBriefV1: teaser.microBriefV1,
      planId: monetizationPlan.value?.id,
    }
  }

  function selectMonetizationFullVideo(fullVideo: any) {
    if (isMonetizationSelectionLocked.value) return
    if (selectedMonetizationItem.value?.itemType === 'fullVideo') {
      selectedMonetizationItem.value = null
      return
    }
    selectedMonetizationItem.value = {
      itemType: 'fullVideo',
      title: fullVideo.title,
      hook: fullVideo.hook,
      angle: fullVideo.angle || fullVideo.scriptOutline?.split('→')[0]?.trim() || 'principal',
      angleCategory: fullVideo.angleCategory || 'cronologico',
      scriptOutline: fullVideo.scriptOutline,
      cta: fullVideo.cta,
      strategicNotes: monetizationPlan.value?.planData?.strategicNotes || undefined,
      scriptStyleId: fullVideo.scriptStyleId,
      scriptStyleName: fullVideo.scriptStyleName,
      editorialObjectiveId: fullVideo.editorialObjectiveId,
      editorialObjectiveName: fullVideo.editorialObjectiveName,
      avoidPatterns: fullVideo.avoidPatterns,
    }
  }

  function narrativeRoleBadge(role: string): { label: string; icon: string; color: string } {
    const badges: Record<string, { label: string; icon: string; color: string }> = {
      gateway: { label: 'Porta de Entrada', icon: '🚪', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
      'deep-dive': { label: 'Mergulho Direto', icon: '🔍', color: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
      'hook-only': { label: 'Gancho Puro', icon: '💥', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    }
    return badges[role] || { label: role, icon: '📋', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' }
  }

  return {
    monetizationPlan,
    loadingMonetization,
    isMonetizationSelectionLocked,
    selectedMonetizationItem,
    hydrateSelectedMonetizationFromOutput,
    loadMonetizationPlan,
    selectMonetizationTeaser,
    selectMonetizationFullVideo,
    narrativeRoleBadge,
  }
}
