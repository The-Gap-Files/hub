import { ref, computed, type Ref } from 'vue'
import type { OutputData } from '~/types/output'
import { normalizeSeoTags } from '~/utils/output/normalizeSeoTags'

/**
 * Social Media Kit: generation, tab navigation, copy, export.
 */
export function useSocialKit(
  outputId: string,
  output: Ref<OutputData | null>,
  loadOutput: () => Promise<void>,
  loadCosts: () => Promise<void>,
  handleApiError: (error: unknown, fallback: string) => void,
) {
  const generatingSocialKit = ref(false)
  const activeSocialTab = ref('youtube')

  const socialKitTabs = [
    { key: 'youtube', label: 'YouTube' },
    { key: 'youtubeShorts', label: 'Shorts' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'instagram', label: 'Instagram' },
  ]

  const activeSocialContent = computed(() => {
    const kit = output.value?.socialKitData?.kitData as any
    if (!kit) return null
    return kit[activeSocialTab.value] || null
  })

  const seoTagsNormalized = computed(() => {
    const kit = output.value?.socialKitData?.kitData as any
    return normalizeSeoTags(kit?.seoTags)
  })

  const seoTagsForYoutubeCopy = computed(() => seoTagsNormalized.value.join(', '))

  async function generateSocialKit() {
    if (generatingSocialKit.value) return
    generatingSocialKit.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/generate-social-kit`, { method: 'POST' })
      await loadOutput()
      loadCosts()
    } catch (e: unknown) {
      handleApiError(e, 'Erro ao gerar Social Media Kit.')
    } finally {
      generatingSocialKit.value = false
    }
  }

  function copySocialField(text: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
  }

  function exportScenesJson() {
    if (!output.value?.scenes?.length) return
    const scenes = output.value.scenes.map((scene: any) => ({
      id: scene.id,
      outputId: scene.outputId,
      order: scene.order,
      narration: scene.narration,
      visualDescription: scene.visualDescription,
      audioDescription: scene.audioDescription || null,
      startTime: scene.startTime || null,
      endTime: scene.endTime || null,
      estimatedDuration: scene.estimatedDuration,
      imageRestrictionReason: scene.imageRestrictionReason || null,
      imageStatus: scene.imageStatus,
      sceneEnvironment: scene.sceneEnvironment || null,
      motionDescription: scene.motionDescription || null,
    }))
    const exportData = {
      outputId: output.value.id,
      title: output.value.title || output.value.dossier?.theme || 'untitled',
      totalScenes: scenes.length,
      totalDuration: scenes.length * 5,
      exportedAt: new Date().toISOString(),
      scenes,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scenes-${output.value.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    generatingSocialKit,
    activeSocialTab,
    socialKitTabs,
    activeSocialContent,
    seoTagsNormalized,
    seoTagsForYoutubeCopy,
    generateSocialKit,
    copySocialField,
    exportScenesJson,
  }
}
