import { ref } from 'vue'

/**
 * Thumbnail generation, selection, and removal.
 */
export function useThumbnails(
  outputId: string,
  loadOutput: () => Promise<void>,
  loadCosts: () => Promise<void>,
  handleApiError: (error: unknown, fallback: string) => void,
) {
  const generatingThumbnails = ref(false)
  const selectingThumbnail = ref(false)
  const removingThumbnail = ref(false)
  const selectedThumbnailIdx = ref<number | null>(null)
  const showSelectedThumbnail = ref(false)
  const thumbnailHookText = ref('')
  const thumbnailVersion = ref(Date.now())

  function openThumbnailPreview(idx: number) {
    selectedThumbnailIdx.value = idx
  }

  async function removeThumbnail() {
    if (removingThumbnail.value) return
    removingThumbnail.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/remove-thumbnail`, { method: 'POST' })
      await loadOutput()
    } catch (e: unknown) {
      handleApiError(e, 'Erro ao remover thumbnail.')
    } finally {
      removingThumbnail.value = false
    }
  }

  async function generateThumbnails() {
    if (generatingThumbnails.value) return
    generatingThumbnails.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/generate-thumbnails`, {
        method: 'POST',
        body: { hookText: thumbnailHookText.value || undefined },
      })
      await loadOutput()
      loadCosts()
      thumbnailHookText.value = ''
    } catch (e: unknown) {
      handleApiError(e, 'Erro ao gerar thumbnails.')
    } finally {
      generatingThumbnails.value = false
    }
  }

  async function selectThumbnail(idx: number) {
    if (selectingThumbnail.value) return
    selectingThumbnail.value = true
    selectedThumbnailIdx.value = idx
    try {
      await $fetch(`/api/outputs/${outputId}/select-thumbnail`, {
        method: 'POST',
        body: { index: idx },
      })
      await loadOutput()
      thumbnailVersion.value = Date.now()
    } catch (e: unknown) {
      handleApiError(e, 'Erro ao selecionar thumbnail.')
    } finally {
      selectingThumbnail.value = false
      selectedThumbnailIdx.value = null
    }
  }

  return {
    generatingThumbnails,
    selectingThumbnail,
    removingThumbnail,
    selectedThumbnailIdx,
    showSelectedThumbnail,
    thumbnailHookText,
    thumbnailVersion,
    generateThumbnails,
    selectThumbnail,
    removeThumbnail,
    openThumbnailPreview,
  }
}
