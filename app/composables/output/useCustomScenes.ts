import { ref, type Ref } from 'vue'
import type { OutputData, CustomSceneEntry } from '~/types/output'
import { useNotification } from '~/utils/useNotification'

/**
 * Custom creator scenes: add/remove entries, upload reference images.
 */
export function useCustomScenes(
  outputId: string,
  output: Ref<OutputData | null>,
) {
  const { error: notifyError } = useNotification()

  const customScenes = ref<CustomSceneEntry[]>([])
  const uploadingSceneImage = ref<number | null>(null)
  const maxCustomScenes = 5

  function addCustomScene() {
    if (customScenes.value.length >= maxCustomScenes) return
    customScenes.value.push({ narration: '', referenceImageId: null, referenceImagePreview: null, imagePrompt: '' })
  }

  function removeCustomScene(index: number) {
    customScenes.value.splice(index, 1)
  }

  async function uploadSceneReferenceImage(index: number, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file || !output.value?.dossierId) return

    uploadingSceneImage.value = index
    try {
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '')
        reader.readAsDataURL(file)
      })
      const base64Data = await base64Promise

      const response = await $fetch(`/api/dossiers/${output.value.dossierId}/images`, {
        method: 'POST',
        body: {
          description: `Referência visual - Cena personalizada ${index + 1}`,
          tags: `custom-scene,output-${outputId},scene-${index + 1}`,
          imageData: base64Data,
          mimeType: file.type,
        },
      }) as any

      const sceneToUpdate = customScenes.value[index]
      if (!sceneToUpdate) return
      sceneToUpdate.referenceImageId = response.id
      sceneToUpdate.referenceImagePreview = `/api/dossiers/images/${response.id}`
    } catch (error: any) {
      notifyError(error.data?.message || 'Erro ao fazer upload da imagem de referência.')
    } finally {
      uploadingSceneImage.value = null
      input.value = '' // Reset file input
    }
  }

  function removeSceneImage(index: number) {
    const scene = customScenes.value[index]
    if (!scene) return
    scene.referenceImageId = null
    scene.referenceImagePreview = null
  }

  return {
    customScenes,
    uploadingSceneImage,
    maxCustomScenes,
    addCustomScene,
    removeCustomScene,
    uploadSceneReferenceImage,
    removeSceneImage,
  }
}
