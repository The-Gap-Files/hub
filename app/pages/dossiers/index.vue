<template>
  <div class="container mx-auto p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Dossiers</h1>
      <NuxtLink to="/Dossiers/new" class="btn btn-primary">
        + Novo Dossier
      </NuxtLink>
    </div>

    <div v-if="loading" class="text-center py-12">
      <p>Carregando Dossiers...</p>
    </div>

    <div v-else-if="Dossiers.length === 0" class="text-center py-12">
      <p class="text-gray-500">Nenhum Dossier criado ainda.</p>
      <NuxtLink to="/Dossiers/new" class="btn btn-primary mt-4">
        Criar Primeiro Dossier
      </NuxtLink>
    </div>

    <div v-else class="grid gap-4">
      <div
        v-for="doc in Dossiers"
        :key="doc.id"
        class="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
        @click="navigateTo(`/Dossiers/${doc.id}`)"
      >
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="text-xl font-semibold mb-2">{{ doc.title }}</h3>
            <p class="text-gray-600 mb-2 line-clamp-2">{{ doc.theme }}</p>
            
            <div class="flex gap-4 text-sm text-gray-500">
              <span>📄 {{ doc.sourcesCount || 0 }} fontes</span>
              <span>🖼️ {{ doc.imagesCount || 0 }} imagens</span>
              <span>📝 {{ doc.notesCount || 0 }} notas</span>
              <span>🎬 {{ doc.outputsCount || 0 }} outputs</span>
            </div>

            <div v-if="doc.tags && doc.tags.length > 0" class="flex gap-2 mt-3">
              <span
                v-for="tag in doc.tags"
                :key="tag"
                class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <div class="text-right text-sm text-gray-500">
            <p>{{ new Date(doc.createdAt).toLocaleDateString('pt-BR') }}</p>
            <span
              v-if="doc.category"
              class="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
            >
              {{ doc.category }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Paginação -->
    <div v-if="total > pageSize" class="flex justify-center gap-2 mt-6">
      <button
        @click="changePage(page - 1)"
        :disabled="page === 1"
        class="btn btn-sm"
      >
        Anterior
      </button>
      <span class="py-2 px-4">
        Página {{ page }} de {{ Math.ceil(total / pageSize) }}
      </span>
      <button
        @click="changePage(page + 1)"
        :disabled="page >= Math.ceil(total / pageSize)"
        class="btn btn-sm"
      >
        Próxima
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const Dossiers = ref<any[]>([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

async function loadDossiers() {
  loading.value = true
  try {
    const response = await $fetch('/api/Dossiers', {
      query: { page: page.value, pageSize: pageSize.value }
    })
    Dossiers.value = response.Dossiers
    total.value = response.total
  } catch (error) {
    console.error('Erro ao carregar Dossiers:', error)
  } finally {
    loading.value = false
  }
}

function changePage(newPage: number) {
  page.value = newPage
  loadDossiers()
}

onMounted(() => {
  loadDossiers()
})
</script>

