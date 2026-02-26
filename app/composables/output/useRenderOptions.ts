import { ref, computed, type Ref } from 'vue'
import type { OutputData } from '~/types/output'
import { useNotification } from '~/utils/useNotification'

type DoStartRenderFn = (opts?: {
  includeLogo: boolean
  includeCaptions: boolean
  includeStingers: boolean
  captionStyleId: string | null
  volumeOverride?: { global?: number; perTrack?: Record<number, number> }
}) => Promise<void>

/**
 * Render options modal: caption styles, volume controls, logo/captions toggles.
 */
export function useRenderOptions(
  outputId: string,
  output: Ref<OutputData | null>,
  rendering: Ref<boolean>,
  hasMusicEvents: Ref<boolean>,
  doStartRender: DoStartRenderFn,
) {
  const { error: notifyError } = useNotification()

  // ---------------------------------------------------------------------------
  // Modal state
  // ---------------------------------------------------------------------------
  const showRenderOptionsModal = ref(false)
  const renderAction = ref<'master' | 'again'>('master')
  const pendingBeforeRender = ref<(() => Promise<void>) | null>(null)

  // ---------------------------------------------------------------------------
  // Render options
  // ---------------------------------------------------------------------------
  const renderIncludeLogo = ref(true)
  const renderIncludeCaptions = ref(false)
  const renderIncludeStingers = ref(true)

  // ---------------------------------------------------------------------------
  // Caption styles (lazy-loaded when modal opens)
  // ---------------------------------------------------------------------------
  const captionStyles = ref<any[]>([])
  const renderCaptionStyleId = ref<string | null>(null)

  // ---------------------------------------------------------------------------
  // Volume controls
  // ---------------------------------------------------------------------------
  const renderAdjustVolume = ref(false)
  const renderBgmVolumeGlobal = ref(-18)
  const renderBgmVolumePerTrack = ref<Record<number, number>>({})

  const hasBgmData = computed(() => {
    if (!output.value?.script) return false
    return !!(output.value.script.backgroundMusicPrompt || output.value.script.backgroundMusicTracks?.length)
  })

  function getTrackVolumeOverride(idx: number): number {
    return renderBgmVolumePerTrack.value[idx] ?? output.value?.script?.backgroundMusicTracks?.[idx]?.volume ?? -18
  }

  function setTrackVolumeOverride(idx: number, value: number) {
    renderBgmVolumePerTrack.value = { ...renderBgmVolumePerTrack.value, [idx]: value }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function openRenderOptionsModal(
    action: 'master' | 'again',
    options?: { beforeRender?: () => Promise<void> },
  ) {
    renderAction.value = action
    pendingBeforeRender.value = options?.beforeRender ?? null
    try {
      const stylesData = await $fetch(`/api/outputs/${outputId}/caption-styles`)
      captionStyles.value = stylesData.styles
      renderCaptionStyleId.value = stylesData.recommendedStyleId
    } catch {
      captionStyles.value = []
      renderCaptionStyleId.value = null
    }
    // Initialize toggles from current output state
    renderAdjustVolume.value = false
    renderIncludeStingers.value = hasMusicEvents.value
    renderBgmVolumeGlobal.value = output.value?.script?.backgroundMusicVolume ?? -18
    const perTrack: Record<number, number> = {}
    if (output.value?.script?.backgroundMusicTracks?.length) {
      for (const [idx, track] of output.value.script.backgroundMusicTracks.entries()) {
        perTrack[idx] = track.volume ?? -18
      }
    }
    renderBgmVolumePerTrack.value = perTrack
    showRenderOptionsModal.value = true
  }

  async function confirmRenderWithOptions() {
    if (rendering.value) return
    if (renderIncludeCaptions.value && !renderCaptionStyleId.value) return

    const opts = {
      includeLogo: renderIncludeLogo.value,
      includeCaptions: renderIncludeCaptions.value,
      includeStingers: renderIncludeStingers.value,
      captionStyleId: renderIncludeCaptions.value ? renderCaptionStyleId.value : null,
      ...(renderAdjustVolume.value && hasBgmData.value
        ? {
            volumeOverride: output.value?.script?.backgroundMusicTracks?.length
              ? { perTrack: { ...renderBgmVolumePerTrack.value } }
              : { global: renderBgmVolumeGlobal.value },
          }
        : {}),
    }
    const beforeRender = pendingBeforeRender.value
    pendingBeforeRender.value = null
    showRenderOptionsModal.value = false

    if (beforeRender) {
      try {
        await beforeRender()
      } catch (e: any) {
        notifyError(e?.data?.message || e?.message || 'Erro ao preparar renderização.')
        return
      }
    }
    await doStartRender(opts)
  }

  return {
    // Modal state
    showRenderOptionsModal,
    renderAction,
    pendingBeforeRender,

    // Render options
    renderIncludeLogo,
    renderIncludeCaptions,
    renderIncludeStingers,

    // Caption styles
    captionStyles,
    renderCaptionStyleId,

    // Volume controls
    renderAdjustVolume,
    renderBgmVolumeGlobal,
    renderBgmVolumePerTrack,
    hasBgmData,
    getTrackVolumeOverride,
    setTrackVolumeOverride,

    // Actions
    openRenderOptionsModal,
    confirmRenderWithOptions,
  }
}
