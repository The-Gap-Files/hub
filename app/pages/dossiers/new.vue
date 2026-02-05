<template>
  <div class="container mx-auto p-6 max-w-4xl">
    <h1 class="text-3xl font-bold mb-6">Novo Dossier</h1>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Título -->
      <div>
        <label class="block font-medium mb-2">Título *</label>
        <input
          v-model="formData.title"
          type="text"
          required
          class="w-full p-3 border rounded"
          placeholder="Ex: O Caso da Beatificação de Simão de Trento"
        />
      </div>

      <!-- Tema -->
      <div>
        <label class="block font-medium mb-2">Tema *</label>
        <input
          v-model="formData.theme"
          type="text"
          required
          class="w-full p-3 border rounded"
          placeholder="Ex: Injustiça histórica + libelo de sangue"
        />
      </div>

      <!-- Categoria -->
      <div>
        <label class="block font-medium mb-2">Categoria</label>
        <select v-model="formData.category" class="w-full p-3 border rounded">
          <option value="">Selecione...</option>
          <option value="true-crime">True Crime</option>
          <option value="história">História</option>
          <option value="ciência">Ciência</option>
          <option value="biografia">Biografia</option>
          <option value="investigação">Investigação</option>
          <option value="mistério">Mistério</option>
          <option value="conspiração">Conspiração</option>
        </select>
      </div>

      <!-- Tags -->
      <div>
        <label class="block font-medium mb-2">Tags (separadas por vírgula)</label>
        <input
          v-model="tagsInput"
          type="text"
          class="w-full p-3 border rounded"
          placeholder="Ex: idade-média, injustiça, religião, judeus"
        />
        <div v-if="formData.tags.length > 0" class="flex gap-2 mt-2">
          <span
            v-for="tag in formData.tags"
            :key="tag"
            class="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <!-- Texto Principal -->
      <div>
        <label class="block font-medium mb-2">Texto Principal (Fonte) *</label>
        <textarea
          v-model="formData.sourceText"
          required
          rows="15"
          class="w-full p-3 border rounded font-mono text-sm"
          placeholder="Cole aqui o texto principal do Dossiero (artigo, história, etc.)"
        ></textarea>
        <p class="text-sm text-gray-500 mt-1">
          {{ formData.sourceText.length }} caracteres
        </p>
      </div>

      <!-- Botões -->
      <div class="flex gap-4">
        <button
          type="submit"
          :disabled="submitting"
          class="btn btn-primary flex-1"
        >
          {{ submitting ? 'Criando...' : 'Criar Dossier' }}
        </button>
        <NuxtLink to="/Dossiers" class="btn btn-secondary">
          Cancelar
        </NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
const formData = ref({
  title: '',
  theme: '',
  category: '',
  tags: [] as string[],
  sourceText: ''
})

const tagsInput = ref('')
const submitting = ref(false)

// Atualizar tags quando input mudar
watch(tagsInput, (value) => {
  formData.value.tags = value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)
})

async function handleSubmit() {
  if (submitting.value) return

  submitting.value = true
  try {
    const dossier = await $fetch('/api/dossiers', {
      method: 'POST',
      body: {
        title: formData.value.title,
        theme: formData.value.theme,
        sourceText: formData.value.sourceText,
        tags: formData.value.tags,
        category: formData.value.category || undefined
      }
    })

    // Redirecionar para página do dossier
    await navigateTo(`/dossiers/${dossier.id}`)
  } catch (error: any) {
    console.error('Erro ao criar dossier:', error)
    alert(error.data?.message || 'Erro ao criar dossier')
  } finally {
    submitting.value = false
  }
}
</script>

