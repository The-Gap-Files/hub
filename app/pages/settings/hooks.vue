<script setup lang="ts">
import {
  Zap, Plus, Trash2, Edit, X, Search, Film, Book, Tv, TrendingUp
} from 'lucide-vue-next'

interface NarrativeHook {
  id: string
  type: string
  sourceType: string
  sourceTitle: string
  genres: string[]
  hookText: string
  duration: string
  emotionalTemperature: string
  tags: string[]
  structuralPattern?: string
  structuralElements: string[]
  pacing?: string
  whyItWorks?: string
  usageCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const { data: hooksData, refresh: refreshHooks } = await useFetch<{ success: boolean; data: NarrativeHook[] }>('/api/narrative-hooks')

const searchQuery = ref('')
const filterType = ref('')
const filterTemperature = ref('')

const filteredHooks = computed(() => {
  let hooks = hooksData.value?.data || []

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    hooks = hooks.filter(h =>
      h.sourceTitle.toLowerCase().includes(query) ||
      h.hookText.toLowerCase().includes(query) ||
      h.tags.some(t => t.toLowerCase().includes(query))
    )
  }

  if (filterType.value) {
    hooks = hooks.filter(h => h.type === filterType.value)
  }

  if (filterTemperature.value) {
    hooks = hooks.filter(h => h.emotionalTemperature === filterTemperature.value)
  }

  return hooks
})

const showModal = ref(false)
const isSubmitting = ref(false)
const editingHook = ref<NarrativeHook | null>(null)

const hookTypes = [
  'action_opening',
  'mystery_hook',
  'intriguing_dialogue',
  'emotional_impact',
  'world_building',
  'tension_opening'
]

const sourceTypes = [
  'movie',
  'series',
  'book',
  'viral_short',
  'other'
]

const durations = ['curto', 'médio', 'longo']
const temperatures = ['explosivo', 'tenso', 'melancólico', 'intrigante', 'contemplativo']
const pacings = ['rápido', 'moderado', 'lento']

const formData = ref({
  type: 'action_opening',
  sourceType: 'movie',
  sourceTitle: '',
  genres: [] as string[],
  hookText: '',
  duration: 'curto',
  emotionalTemperature: 'intrigante',
  tags: [] as string[],
  structuralPattern: '',
  structuralElements: [] as string[],
  pacing: 'moderado',
  whyItWorks: ''
})

const genreInput = ref('')
const tagInput = ref('')
const elementInput = ref('')

function openCreateModal() {
  editingHook.value = null
  formData.value = {
    type: 'action_opening',
    sourceType: 'movie',
    sourceTitle: '',
    genres: [],
    hookText: '',
    duration: 'curto',
    emotionalTemperature: 'intrigante',
    tags: [],
    structuralPattern: '',
    structuralElements: [],
    pacing: 'moderado',
    whyItWorks: ''
  }
  showModal.value = true
}

function openEditModal(hook: NarrativeHook) {
  editingHook.value = hook
  formData.value = {
    type: hook.type,
    sourceType: hook.sourceType,
    sourceTitle: hook.sourceTitle,
    genres: [...hook.genres],
    hookText: hook.hookText,
    duration: hook.duration,
    emotionalTemperature: hook.emotionalTemperature,
    tags: [...hook.tags],
    structuralPattern: hook.structuralPattern || '',
    structuralElements: [...hook.structuralElements],
    pacing: hook.pacing || 'moderado',
    whyItWorks: hook.whyItWorks || ''
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingHook.value = null
}

function addGenre() {
  if (genreInput.value && !formData.value.genres.includes(genreInput.value)) {
    formData.value.genres.push(genreInput.value)
    genreInput.value = ''
  }
}

function removeGenre(genre: string) {
  formData.value.genres = formData.value.genres.filter(g => g !== genre)
}

function addTag() {
  if (tagInput.value && !formData.value.tags.includes(tagInput.value)) {
    formData.value.tags.push(tagInput.value)
    tagInput.value = ''
  }
}

function removeTag(tag: string) {
  formData.value.tags = formData.value.tags.filter(t => t !== tag)
}

function addElement() {
  if (elementInput.value && !formData.value.structuralElements.includes(elementInput.value)) {
    formData.value.structuralElements.push(elementInput.value)
    elementInput.value = ''
  }
}

function removeElement(element: string) {
  formData.value.structuralElements = formData.value.structuralElements.filter(e => e !== element)
}

async function handleSubmit() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    if (editingHook.value) {
      await $fetch(`/api/narrative-hooks/${editingHook.value.id}`, {
        method: 'PATCH',
        body: formData.value
      })
    } else {
      await $fetch('/api/narrative-hooks', {
        method: 'POST',
        body: formData.value
      })
    }
    await refreshHooks()
    closeModal()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao salvar hook')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(hook: NarrativeHook) {
  if (!confirm(`Remover hook "${hook.sourceTitle}"?`)) return
  try {
    await $fetch(`/api/narrative-hooks/${hook.id}`, { method: 'DELETE' })
    await refreshHooks()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao deletar hook')
  }
}

async function toggleActive(hook: NarrativeHook) {
  try {
    await $fetch(`/api/narrative-hooks/${hook.id}`, {
      method: 'PATCH',
      body: { isActive: !hook.isActive }
    })
    await refreshHooks()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao atualizar status')
  }
}

const sourceIcon = (type: string) => {
  switch(type) {
    case 'movie': return Film
    case 'series': return Tv
    case 'book': return Book
    case 'viral_short': return TrendingUp
    default: return Zap
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-100 p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold flex items-center gap-3">
            <Zap class="w-8 h-8 text-amber-500" />
            Base de Hooks Narrativos
          </h1>
          <p class="text-neutral-400 mt-2">Aberturas poderosas para inspirar o Story Architect</p>
        </div>
        <button
          @click="openCreateModal"
          class="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus class="w-5 h-5" />
          Adicionar Hook
        </button>
      </div>

      <!-- Filters -->
      <div class="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar hooks..."
            class="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <select
          v-model="filterType"
          class="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Todos os tipos</option>
          <option v-for="type in hookTypes" :key="type" :value="type">
            {{ type.replace('_', ' ') }}
          </option>
        </select>
        <select
          v-model="filterTemperature"
          class="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Todas temperaturas</option>
          <option v-for="temp in temperatures" :key="temp" :value="temp">
            {{ temp }}
          </option>
        </select>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p class="text-neutral-400 text-sm">Total de Hooks</p>
          <p class="text-2xl font-bold">{{ hooksData?.data?.length || 0 }}</p>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p class="text-neutral-400 text-sm">Mais Usado</p>
          <p class="text-2xl font-bold">{{ Math.max(...(hooksData?.data?.map(h => h.usageCount) || [0])) }}</p>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p class="text-neutral-400 text-sm">Tipos Únicos</p>
          <p class="text-2xl font-bold">{{ new Set(hooksData?.data?.map(h => h.type)).size || 0 }}</p>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p class="text-neutral-400 text-sm">Ativos</p>
          <p class="text-2xl font-bold">{{ hooksData?.data?.filter(h => h.isActive).length || 0 }}</p>
        </div>
      </div>

      <!-- Hooks List -->
      <div class="space-y-4">
        <div
          v-for="hook in filteredHooks"
          :key="hook.id"
          class="bg-neutral-900 border border-neutral-800 rounded-lg p-6"
          :class="{ 'opacity-50': !hook.isActive }"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-start gap-4 flex-1">
              <component :is="sourceIcon(hook.sourceType)" class="w-6 h-6 text-amber-500 mt-1" />
              <div class="flex-1">
                <h3 class="text-xl font-bold mb-1">{{ hook.sourceTitle }}</h3>
                <div class="flex flex-wrap gap-2 mb-3">
                  <span class="px-2 py-1 bg-amber-600/20 text-amber-400 text-xs rounded">
                    {{ hook.type.replace('_', ' ') }}
                  </span>
                  <span class="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                    {{ hook.emotionalTemperature }}
                  </span>
                  <span class="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded">
                    {{ hook.duration }}
                  </span>
                  <span class="px-2 py-1 bg-neutral-700 text-neutral-300 text-xs rounded">
                    {{ hook.usageCount }} usos
                  </span>
                </div>
                <p class="text-neutral-300 mb-3 italic">"{{ hook.hookText }}"</p>
                <div class="flex flex-wrap gap-2 mb-2">
                  <span
                    v-for="genre in hook.genres"
                    :key="genre"
                    class="px-2 py-1 bg-neutral-800 text-neutral-400 text-xs rounded"
                  >
                    {{ genre }}
                  </span>
                </div>
                <div v-if="hook.structuralPattern" class="text-sm text-neutral-400 mb-2">
                  <strong>Padrão:</strong> {{ hook.structuralPattern }}
                </div>
                <div v-if="hook.whyItWorks" class="text-sm text-neutral-400">
                  <strong>Por que funciona:</strong> {{ hook.whyItWorks }}
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                @click="toggleActive(hook)"
                :class="hook.isActive ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700 hover:bg-neutral-600'"
                class="px-3 py-1 rounded text-sm transition-colors"
              >
                {{ hook.isActive ? 'Ativo' : 'Inativo' }}
              </button>
              <button
                @click="openEditModal(hook)"
                class="p-2 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
              >
                <Edit class="w-4 h-4" />
              </button>
              <button
                @click="handleDelete(hook)"
                class="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="filteredHooks.length === 0"
        class="text-center py-16 text-neutral-500"
      >
        <Zap class="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Nenhum hook encontrado</p>
      </div>
    </div>

    <!-- Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto"
      @click.self="closeModal"
    >
      <div class="bg-neutral-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex items-center justify-between">
          <h2 class="text-2xl font-bold">{{ editingHook ? 'Editar Hook' : 'Novo Hook' }}</h2>
          <button @click="closeModal" class="p-2 hover:bg-neutral-800 rounded transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Tipo de Hook</label>
              <select
                v-model="formData.type"
                required
                class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option v-for="type in hookTypes" :key="type" :value="type">
                  {{ type.replace('_', ' ') }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Fonte</label>
              <select
                v-model="formData.sourceType"
                required
                class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option v-for="type in sourceTypes" :key="type" :value="type">
                  {{ type }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Título da Fonte</label>
            <input
              v-model="formData.sourceTitle"
              type="text"
              required
              placeholder="Ex: The Dark Knight"
              class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Texto do Hook</label>
            <textarea
              v-model="formData.hookText"
              required
              rows="4"
              placeholder="Descreva o hook narrativo..."
              class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
            ></textarea>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Duração</label>
              <select
                v-model="formData.duration"
                required
                class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option v-for="dur in durations" :key="dur" :value="dur">{{ dur }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Temperatura Emocional</label>
              <select
                v-model="formData.emotionalTemperature"
                required
                class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option v-for="temp in temperatures" :key="temp" :value="temp">{{ temp }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Ritmo</label>
              <select
                v-model="formData.pacing"
                class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option v-for="pace in pacings" :key="pace" :value="pace">{{ pace }}</option>
              </select>
            </div>
          </div>

          <!-- Genres -->
          <div>
            <label class="block text-sm font-medium mb-2">Gêneros</label>
            <div class="flex gap-2 mb-2">
              <input
                v-model="genreInput"
                type="text"
                placeholder="Adicionar gênero..."
                @keyup.enter="addGenre"
                class="flex-1 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                @click="addGenre"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                <Plus class="w-5 h-5" />
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="genre in formData.genres"
                :key="genre"
                class="px-3 py-1 bg-neutral-800 rounded-full flex items-center gap-2"
              >
                {{ genre }}
                <button type="button" @click="removeGenre(genre)" class="hover:text-red-400">
                  <X class="w-4 h-4" />
                </button>
              </span>
            </div>
          </div>

          <!-- Tags -->
          <div>
            <label class="block text-sm font-medium mb-2">Tags</label>
            <div class="flex gap-2 mb-2">
              <input
                v-model="tagInput"
                type="text"
                placeholder="Adicionar tag..."
                @keyup.enter="addTag"
                class="flex-1 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                @click="addTag"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                <Plus class="w-5 h-5" />
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="tag in formData.tags"
                :key="tag"
                class="px-3 py-1 bg-neutral-800 rounded-full flex items-center gap-2"
              >
                {{ tag }}
                <button type="button" @click="removeTag(tag)" class="hover:text-red-400">
                  <X class="w-4 h-4" />
                </button>
              </span>
            </div>
          </div>

          <!-- Structural Pattern -->
          <div>
            <label class="block text-sm font-medium mb-2">Padrão Estrutural (opcional)</label>
            <input
              v-model="formData.structuralPattern"
              type="text"
              placeholder="Ex: Imagem + Som + Ação imediata"
              class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <!-- Structural Elements -->
          <div>
            <label class="block text-sm font-medium mb-2">Elementos Estruturais</label>
            <div class="flex gap-2 mb-2">
              <input
                v-model="elementInput"
                type="text"
                placeholder="Adicionar elemento..."
                @keyup.enter="addElement"
                class="flex-1 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                @click="addElement"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                <Plus class="w-5 h-5" />
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="element in formData.structuralElements"
                :key="element"
                class="px-3 py-1 bg-neutral-800 rounded-full flex items-center gap-2"
              >
                {{ element }}
                <button type="button" @click="removeElement(element)" class="hover:text-red-400">
                  <X class="w-4 h-4" />
                </button>
              </span>
            </div>
          </div>

          <!-- Why It Works -->
          <div>
            <label class="block text-sm font-medium mb-2">Por que funciona? (opcional)</label>
            <textarea
              v-model="formData.whyItWorks"
              rows="3"
              placeholder="Análise breve do porquê este hook funciona..."
              class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-amber-500"
            ></textarea>
          </div>

          <div class="flex gap-4 pt-4 border-t border-neutral-800">
            <button
              type="button"
              @click="closeModal"
              class="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {{ isSubmitting ? 'Salvando...' : (editingHook ? 'Salvar' : 'Criar') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
