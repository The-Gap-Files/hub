<template>
  <div class="container mx-auto p-6 max-w-6xl">
    <div v-if="loading" class="text-center py-12">
      <p>Carregando dossier...</p>
    </div>

    <div v-else-if="dossier" class="space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-3xl font-bold">{{ dossier.title }}</h1>
          <p class="text-gray-600 mt-2">{{ dossier.theme }}</p>
          <div class="flex gap-2 mt-2">
            <span
              v-for="tag in dossier.tags"
              :key="tag"
              class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        <NuxtLink to="/dossiers" class="btn btn-secondary">
          ← Voltar
        </NuxtLink>
      </div>

      <!-- Tabs -->
      <div class="border-b">
        <nav class="flex gap-4">
          <button
            @click="activeTab = 'content'"
            :class="[
              'px-4 py-2 border-b-2 font-medium',
              activeTab === 'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            ]"
          >
            Conteúdo
          </button>
          <button
            @click="activeTab = 'outputs'"
            :class="[
              'px-4 py-2 border-b-2 font-medium',
              activeTab === 'outputs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            ]"
          >
            Outputs ({{ dossier.outputsCount || 0 }})
          </button>
        </nav>
      </div>

      <!-- Tab: Conteúdo -->
      <div v-if="activeTab === 'content'" class="space-y-6">
        <!-- Texto Principal -->
        <div class="border rounded-lg p-6">
          <h3 class="font-semibold text-lg mb-4">Texto Principal</h3>
          <div class="bg-gray-50 p-4 rounded max-h-96 overflow-y-auto">
            <pre class="whitespace-pre-wrap text-sm">{{ dossier.sourceText }}</pre>
          </div>
        </div>

        <!-- Fontes Secundárias -->
        <div class="border rounded-lg p-6">
          <h3 class="font-semibold text-lg mb-4">
            Fontes Secundárias ({{ dossier.sources?.length || 0 }})
          </h3>
          <div v-if="dossier.sources && dossier.sources.length > 0" class="space-y-3">
            <div
              v-for="source in dossier.sources"
              :key="source.id"
              class="border-l-4 border-blue-500 pl-4"
            >
              <p class="font-medium">{{ source.title }}</p>
              <p class="text-sm text-gray-600">{{ source.sourceType }}</p>
              <p v-if="source.author" class="text-sm text-gray-500">Por: {{ source.author }}</p>
            </div>
          </div>
          <p v-else class="text-gray-500 text-sm">Nenhuma fonte secundária adicionada.</p>
        </div>

        <!-- Imagens de Referência -->
        <div class="border rounded-lg p-6">
          <h3 class="font-semibold text-lg mb-4">
            Imagens de Referência ({{ dossier.images?.length || 0 }})
          </h3>
          <div v-if="dossier.images && dossier.images.length > 0" class="grid grid-cols-2 gap-4">
            <div
              v-for="image in dossier.images"
              :key="image.id"
              class="border rounded p-3"
            >
              <p class="text-sm">{{ image.description }}</p>
            </div>
          </div>
          <p v-else class="text-gray-500 text-sm">Nenhuma imagem adicionada.</p>
        </div>

        <!-- Notas de Research -->
        <div class="border rounded-lg p-6">
          <h3 class="font-semibold text-lg mb-4">
            Notas de Research ({{ dossier.notes?.length || 0 }})
          </h3>
          <div v-if="dossier.notes && dossier.notes.length > 0" class="space-y-2">
            <div
              v-for="note in dossier.notes"
              :key="note.id"
              class="bg-yellow-50 border-l-4 border-yellow-400 p-3"
            >
              <p class="text-sm">{{ note.content }}</p>
              <span v-if="note.noteType" class="text-xs text-gray-500">{{ note.noteType }}</span>
            </div>
          </div>
          <p v-else class="text-gray-500 text-sm">Nenhuma nota adicionada.</p>
        </div>
      </div>

      <!-- Tab: Outputs -->
      <div v-if="activeTab === 'outputs'" class="space-y-6">
        <div class="flex justify-end">
          <button @click="showOutputGenerator = true" class="btn btn-primary">
            + Gerar Outputs
          </button>
        </div>

        <!-- TODO: Listar outputs existentes -->
        <div class="text-center py-12 text-gray-500">
          <p>Lista de outputs será implementada aqui</p>
          <p class="text-sm mt-2">Outputs gerados aparecerão nesta aba</p>
        </div>
      </div>

      <!-- Modal: Output Generator -->
      <div
        v-if="showOutputGenerator"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        @click.self="showOutputGenerator = false"
      >
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-bold mb-4">Gerar Outputs</h2>
          
          <div class="space-y-4">
            <!-- Teaser TikTok -->
            <label class="flex items-start gap-3 p-4 border rounded hover:bg-gray-50">
              <input type="checkbox" v-model="selectedOutputs" value="teaser-tiktok" class="mt-1" />
              <div>
                <p class="font-medium">Teaser TikTok</p>
                <p class="text-sm text-gray-600">60s, 9:16, Mystery Style, Cliffhanger</p>
              </div>
            </label>

            <!-- Teaser Shorts -->
            <label class="flex items-start gap-3 p-4 border rounded hover:bg-gray-50">
              <input type="checkbox" v-model="selectedOutputs" value="teaser-shorts" class="mt-1" />
              <div>
                <p class="font-medium">Teaser YouTube Shorts</p>
                <p class="text-sm text-gray-600">60s, 9:16, Mystery Style, Cliffhanger</p>
              </div>
            </label>

            <!-- Full YouTube -->
            <label class="flex items-start gap-3 p-4 border rounded hover:bg-gray-50">
              <input type="checkbox" v-model="selectedOutputs" value="full-youtube" class="mt-1" />
              <div>
                <p class="font-medium">Full Video YouTube</p>
                <p class="text-sm text-gray-600">10-15min, 16:9, Documentary Style, Completo</p>
              </div>
            </label>
          </div>

          <div class="flex gap-4 mt-6">
            <button
              type="button"
              @click="generateOutputs"
              :disabled="selectedOutputs.length === 0 || generatingOutputs"
              class="btn btn-primary flex-1"
            >
              {{ generatingOutputs ? 'Gerando...' : `Gerar ${selectedOutputs.length} Output(s)` }}
            </button>
            <button
              type="button"
              @click="showOutputGenerator = false"
              class="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const dossierId = route.params.id as string

const dossier = ref<any>(null)
const loading = ref(true)
const activeTab = ref<'content' | 'outputs'>('content')
const showOutputGenerator = ref(false)
const selectedOutputs = ref<string[]>([])
const generatingOutputs = ref(false)

async function loadDossier() {
  loading.value = true
  try {
    dossier.value = await $fetch(`/api/dossiers/${dossierId}`)
  } catch (error) {
    console.error('Erro ao carregar dossier:', error)
  } finally {
    loading.value = false
  }
}

async function generateOutputs() {
  if (selectedOutputs.value.length === 0) return

  generatingOutputs.value = true
  try {
    // Mapear seleções para configurações de output
    const outputConfigs = selectedOutputs.value.map((type) => {
      if (type === 'teaser-tiktok') {
        return {
          outputType: 'VIDEO_TEASER',
          format: 'teaser',
          duration: 60,
          aspectRatio: '9:16',
          platform: 'tiktok',
          scriptStyleId: 'mystery', // ID do Mystery style
          visualStyleId: 'cyberpunk' // Ajustar conforme seus IDs
        }
      }
      if (type === 'teaser-shorts') {
        return {
          outputType: 'VIDEO_TEASER',
          format: 'teaser',
          duration: 60,
          aspectRatio: '9:16',
          platform: 'youtube-shorts',
          scriptStyleId: 'mystery',
          visualStyleId: 'cyberpunk'
        }
      }
      if (type === 'full-youtube') {
        return {
          outputType: 'VIDEO_FULL',
          format: 'full',
          duration: 600,
          aspectRatio: '16:9',
          platform: 'youtube',
          scriptStyleId: 'documentary', // ID do Documentary style
          visualStyleId: 'photorealistic'
        }
      }
    })

    // Criar outputs
    const response = await $fetch(`/api/dossiers/${dossierId}/outputs`, {
      method: 'POST',
      body: { outputs: outputConfigs }
    })

    // Fechar modal
    showOutputGenerator.value = false
    selectedOutputs.value = []

    // Mudar para tab de outputs
    activeTab.value = 'outputs'

    // Recarregar dossier
    await loadDossier()

    alert(`${response.total} output(s) criado(s) com sucesso!`)
  } catch (error: any) {
    console.error('Erro ao gerar outputs:', error)
    alert(error.data?.message || 'Erro ao gerar outputs')
  } finally {
    generatingOutputs.value = false
  }
}

onMounted(() => {
  loadDossier()
})
</script>
