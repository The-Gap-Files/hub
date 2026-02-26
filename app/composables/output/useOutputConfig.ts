import { ref, computed, type Ref } from 'vue'
import type { OutputData } from '~/types/output'

/**
 * Output configuration modal: script style, visual style, editorial objective,
 * language, narration language, seed, must-include/exclude.
 */
export function useOutputConfig(
  outputId: string,
  output: Ref<OutputData | null>,
  loadOutput: () => Promise<void>,
) {
  // ---------------------------------------------------------------------------
  // Modal state
  // ---------------------------------------------------------------------------
  const showOutputConfigModal = ref(false)
  const savingOutputConfig = ref(false)
  const outputConfigError = ref<string | null>(null)

  // ---------------------------------------------------------------------------
  // Dropdown options (lazy-loaded)
  // ---------------------------------------------------------------------------
  const scriptStylesOptions = ref<any[]>([])
  const visualStylesOptions = ref<any[]>([])
  const editorialObjectivesOptions = ref<any[]>([])
  const seedOptions = ref<Array<{ id: string; value: number }>>([])

  // ---------------------------------------------------------------------------
  // Form fields
  // ---------------------------------------------------------------------------
  const cfgScriptStyleId = ref<string>('')
  const cfgVisualStyleId = ref<string>('')
  const cfgEditorialObjectiveId = ref<string>('')
  const cfgObjective = ref<string>('')
  const cfgLanguage = ref<string>('pt-BR')
  const cfgNarrationLanguage = ref<string>('pt-BR')
  const cfgSeedChoice = ref<string>('auto')
  const cfgMustInclude = ref<string>('')
  const cfgMustExclude = ref<string>('')

  // ---------------------------------------------------------------------------
  // Seed lock (monetization-bound outputs)
  // ---------------------------------------------------------------------------
  const isSeedLocked = computed(() => {
    const o = output.value as any
    if (!o || !o.seedId) return false
    const ctx = o.monetizationData?.contextData as any
    if (!ctx || typeof ctx !== 'object') return false
    const itemType = ctx.itemType
    if (itemType !== 'teaser' && itemType !== 'fullVideo') return false
    return o.format === 'teaser-youtube-shorts' || o.format === 'full-youtube'
  })

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function ensureOutputConfigOptionsLoaded() {
    if (
      scriptStylesOptions.value.length &&
      visualStylesOptions.value.length &&
      editorialObjectivesOptions.value.length &&
      seedOptions.value.length
    ) return

    const [scriptRes, visualRes, objRes] = await Promise.all([
      $fetch('/api/script-styles'),
      $fetch('/api/visual-styles'),
      $fetch('/api/editorial-objectives'),
    ])
    scriptStylesOptions.value = (scriptRes as any)?.data || []
    visualStylesOptions.value = (visualRes as any)?.data || []
    editorialObjectivesOptions.value = (objRes as any)?.data || []

    try {
      const seedsRes = await $fetch('/api/seeds') as any
      seedOptions.value = ((seedsRes?.data as any[]) || []).map((s: any) => ({
        id: s.id,
        value: s.value,
      }))
    } catch {
      // Seeds are optional, fail silently
    }
  }

  function applyObjectivePreset() {
    const id = cfgEditorialObjectiveId.value
    if (!id) return
    const preset = editorialObjectivesOptions.value.find((o: any) => o.id === id)
    if (preset?.instruction) cfgObjective.value = String(preset.instruction)
  }

  async function openOutputConfigModal() {
    outputConfigError.value = null
    await ensureOutputConfigOptionsLoaded()

    const o = output.value || {} as any
    cfgScriptStyleId.value = o.scriptStyleId || ''
    cfgVisualStyleId.value = o.visualStyleId || ''
    cfgEditorialObjectiveId.value = o.editorialObjectiveId || ''
    cfgObjective.value = o.objective || ''
    cfgLanguage.value = o.language || 'pt-BR'
    cfgNarrationLanguage.value = o.narrationLanguage || 'pt-BR'
    cfgMustInclude.value = o.mustInclude || ''
    cfgMustExclude.value = o.mustExclude || ''

    if (typeof o.seedValue === 'number') {
      cfgSeedChoice.value = String(o.seedValue)
    } else {
      cfgSeedChoice.value = 'auto'
    }

    showOutputConfigModal.value = true
  }

  async function saveOutputConfig() {
    if (savingOutputConfig.value) return
    savingOutputConfig.value = true
    outputConfigError.value = null
    try {
      const body: any = {
        scriptStyleId: cfgScriptStyleId.value || null,
        visualStyleId: cfgVisualStyleId.value || null,
        editorialObjectiveId: cfgEditorialObjectiveId.value || null,
        objective: cfgObjective.value?.trim() ? cfgObjective.value.trim() : null,
        mustInclude: cfgMustInclude.value?.trim() ? cfgMustInclude.value.trim() : null,
        mustExclude: cfgMustExclude.value?.trim() ? cfgMustExclude.value.trim() : null,
        language: cfgLanguage.value?.trim() ? cfgLanguage.value.trim() : null,
        narrationLanguage: cfgNarrationLanguage.value?.trim() ? cfgNarrationLanguage.value.trim() : null,
      }

      if (!isSeedLocked.value) {
        if (cfgSeedChoice.value === 'auto') {
          body.seedValue = null
        } else {
          const parsed = Number(cfgSeedChoice.value)
          body.seedValue = Number.isFinite(parsed) ? parsed : null
        }
      }

      await $fetch(`/api/outputs/${outputId}/metadata`, {
        method: 'PATCH',
        body,
      })
      await loadOutput()
      showOutputConfigModal.value = false
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || 'Erro ao salvar configurações do output.'
      outputConfigError.value = msg
    } finally {
      savingOutputConfig.value = false
    }
  }

  return {
    // Modal state
    showOutputConfigModal,
    savingOutputConfig,
    outputConfigError,

    // Options
    scriptStylesOptions,
    visualStylesOptions,
    editorialObjectivesOptions,
    seedOptions,

    // Form fields
    cfgScriptStyleId,
    cfgVisualStyleId,
    cfgEditorialObjectiveId,
    cfgObjective,
    cfgLanguage,
    cfgNarrationLanguage,
    cfgSeedChoice,
    cfgMustInclude,
    cfgMustExclude,

    // Computed
    isSeedLocked,

    // Actions
    ensureOutputConfigOptionsLoaded,
    applyObjectivePreset,
    openOutputConfigModal,
    saveOutputConfig,
  }
}
