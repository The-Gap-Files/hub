<script setup lang="ts">
import { 
  Database, Dna, Plus, Trash2, 
  Shuffle, X, Hash, Activity, Zap, Search,
  Eye, Image
} from 'lucide-vue-next'

interface Seed {
  id: string
  value: number
  usageCount: number
  createdAt: string
  updatedAt: string
  _count: {
    outputs: number
  }
}

const { data: seedsData, refresh: refreshSeeds } = await useFetch<{ success: boolean; data: Seed[] }>('/api/seeds')

const searchQuery = ref('')
const filteredSeeds = computed(() => {
  const seeds = seedsData.value?.data || []
  if (!searchQuery.value) return seeds
  
  const query = searchQuery.value.toLowerCase()
  return seeds.filter(s => s.value.toString().includes(query))
})

const showModal = ref(false)
const isSubmitting = ref(false)

const formData = ref({
  value: 0
})

function openCreateModal() {
  formData.value = {
    value: Math.floor(Math.random() * 2147483647)
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

function generateRandomSeed() {
  formData.value.value = Math.floor(Math.random() * 2147483647)
}

async function handleSubmit() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    await $fetch('/api/seeds', {
      method: 'POST',
      body: formData.value
    })
    await refreshSeeds()
    closeModal()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao registrar DNA')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(seed: Seed) {
  if (!confirm(`Remover DNA #${seed.value} do repositório?`)) return
  try {
    await $fetch(`/api/seeds/${seed.id}`, { method: 'DELETE' })
    await refreshSeeds()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao deletar DNA')
  }
}

// Modal de Amostras
interface SeedSample {
  id: string
  dataUrl: string
  width: number | null
  height: number | null
  createdAt: string
  promptUsed: string
  outputTitle: string | null
}

const showSamplesModal = ref(false)
const selectedSeed = ref<Seed | null>(null)
const samplesData = ref<SeedSample[]>([])
const isLoadingSamples = ref(false)
const selectedSampleIndex = ref<number | null>(null)

async function openSamplesModal(seed: Seed) {
  selectedSeed.value = seed
  showSamplesModal.value = true
  isLoadingSamples.value = true
  samplesData.value = []
  
  try {
    const response = await $fetch<{ success: boolean; data: { seed: Seed; samples: SeedSample[] } }>(`/api/seeds/${seed.id}/samples`)
    samplesData.value = response.data.samples
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao carregar amostras')
    showSamplesModal.value = false
  } finally {
    isLoadingSamples.value = false
  }
}

function closeSamplesModal() {
  showSamplesModal.value = false
  selectedSeed.value = null
  samplesData.value = []
  selectedSampleIndex.value = null
}

function openLightbox(index: number) {
  selectedSampleIndex.value = index
}

function closeLightbox() {
  selectedSampleIndex.value = null
}

function nextImage() {
  if (selectedSampleIndex.value !== null && selectedSampleIndex.value < samplesData.value.length - 1) {
    selectedSampleIndex.value++
  }
}

function prevImage() {
  if (selectedSampleIndex.value !== null && selectedSampleIndex.value > 0) {
    selectedSampleIndex.value--
  }
}

const currentSample = computed(() => {
  if (selectedSampleIndex.value !== null) {
    return samplesData.value[selectedSampleIndex.value]
  }
  return null
})


// Keyboard navigation
onMounted(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (selectedSampleIndex.value !== null) {
      if (e.key === 'ArrowRight') nextImage()
      else if (e.key === 'ArrowLeft') prevImage()
      else if (e.key === 'Escape') closeLightbox()
    }
    if (showSamplesModal.value && e.key === 'Escape' && selectedSampleIndex.value === null) {
      closeSamplesModal()
    }
  }
  
  window.addEventListener('keydown', handleKeyPress)
  
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyPress)
  })
})


</script>

<template>
  <div class="min-h-screen bg-oled-black pb-20 selection:bg-emerald-500/30">
    <div class="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-1000">
      <header class="flex flex-col md:flex-row justify-between items-end gap-6 mb-16 relative group">
        <div class="absolute -inset-x-8 -top-8 h-40 bg-gradient-to-b from-emerald-500/5 to-transparent blur-3xl opacity-50"></div>
        
        <div class="relative space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Database :size="24" />
            </div>
            <span class="mono-label tracking-[0.4em] text-emerald-500/60 font-black">Genetic Registry</span>
          </div>
          <h1 class="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
            Repositório de <span class="text-emerald-500">DNA</span>
          </h1>
          <p class="text-zinc-500 font-medium max-w-md">Catálogo de constantes numéricas universais para replicação estética.</p>
        </div>

        <div class="flex items-center gap-4">
          <div class="relative group/search">
            <Search :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within/search:text-emerald-500 transition-colors" />
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="Localizar valor..." 
              class="bg-white/5 border border-white/10 rounded-xl px-12 py-4 text-white text-xs outline-none focus:border-emerald-500/50 transition-all w-64"
            />
          </div>
          <button @click="openCreateModal" class="btn-primary !bg-emerald-600 !hover:bg-emerald-500 !px-10 !py-4 shadow-[0_0_20px_rgba(16,185,129,0.3)] group/btn">
            <span class="flex items-center gap-3">
              <Dna :size="20" class="group-hover/btn:scale-125 transition-transform duration-500" />
              REGISTRAR DNA
            </span>
          </button>
        </div>
      </header>

      <!-- Grid de DNAs -->
      <div v-if="filteredSeeds.length === 0" class="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01]">
         <div class="w-20 h-20 bg-emerald-500/5 rounded-full flex items-center justify-center mb-8 text-emerald-500/20">
           <Hash :size="48" />
         </div>
         <h3 class="text-2xl font-black text-white/30 uppercase italic mb-2">Vazio</h3>
         <p class="mono-label opacity-40 italic max-w-xs text-center">Nenhuma constante numérica registrada no sistema.</p>
      </div>

      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in slide-in-from-bottom-10 duration-700">
        <div
          v-for="seed in filteredSeeds"
          :key="seed.id"
          class="glass-card group flex flex-col p-6 border-white/5 hover:border-emerald-500/50 transition-all duration-300 relative overflow-hidden"
        >
          <div class="flex justify-between items-start mb-4">
             <div class="w-8 h-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 group-hover:text-emerald-500 transition-colors">
                <Hash :size="16" />
             </div>
             <button @click="handleDelete(seed)" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500 hover:text-white border border-white/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Trash2 :size="14" />
             </button>
          </div>

          <div class="space-y-1 mb-4 text-left">
            <span class="text-2xl font-mono font-black text-white group-hover:text-emerald-400 transition-colors tracking-tight">
              {{ seed.value }}
            </span>
          </div>

          <div class="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
             <div class="flex items-center gap-2">
                <Activity :size="10" class="text-zinc-700" />
                <span class="mono-label !text-[8px] text-zinc-500">{{ seed._count.outputs }} <span class="opacity-40">USOS</span></span>
             </div>
             <button 
               @click="openSamplesModal(seed)"
               class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-500 transition-all group/view opacity-0 group-hover:opacity-100"
             >
               <Eye :size="12" class="group-hover/view:scale-110 transition-transform" />
               <span class="mono-label !text-[7px] font-black">VER</span>
             </button>
          </div>

          <!-- Scanline -->
          <div class="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
        </div>
      </div>

      <!-- Modal de Registro -->
      <Teleport to="body">
        <div v-if="showModal"
          class="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[100] p-4"
          @click.self="closeModal">
          
          <div class="glass-card max-w-sm w-full relative animate-in zoom-in-95 duration-300 border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col p-10">
            <button @click="closeModal" class="absolute top-6 right-6 text-white/30 hover:text-white transition-colors">
              <X :size="24" stroke-width="1.5" />
            </button>

            <header class="mb-8 text-left">
               <div class="flex items-center gap-2 text-emerald-500 mb-1">
                 <Zap :size="14" />
                 <span class="mono-label text-emerald-500 font-black !text-[8px]">New DNA Entry</span>
               </div>
               <h2 class="text-2xl font-black text-white uppercase italic tracking-tighter">Registrar DNA</h2>
            </header>

            <form @submit.prevent="handleSubmit" class="space-y-6 text-left">
              <div class="space-y-2">
                <label class="mono-label !text-zinc-500 !text-[9px]">Valor Matemático (Seed)</label>
                <div class="flex gap-2">
                   <div class="relative flex-1">
                      <Hash :size="16" class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input v-model.number="formData.value" type="number" required class="w-full bg-white/[0.03] border border-white/10 rounded-xl px-12 py-4 text-emerald-500 font-mono text-xs focus:border-emerald-500 outline-none transition-all" />
                   </div>
                   <button type="button" @click="generateRandomSeed" class="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-emerald-500 hover:border-emerald-500 transition-all">
                      <Shuffle :size="18" />
                   </button>
                </div>
              </div>

              <button type="submit" :disabled="isSubmitting" class="btn-primary !bg-emerald-600 !hover:bg-emerald-500 w-full py-4 shadow-[0_0_30px_rgba(16,185,129,0.2)] font-black uppercase text-xs tracking-widest mt-4">
                <span v-if="!isSubmitting">ADICIONAR DNA</span>
                <span v-else class="animate-pulse">WRITING...</span>
              </button>
            </form>
          </div>
        </div>
      </Teleport>

      <!-- Modal de Amostras -->
      <Teleport to="body">
        <div v-if="showSamplesModal"
          class="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[100] p-4 overflow-y-auto"
          @click.self="closeSamplesModal">
          
          <div class="glass-card max-w-6xl w-full relative animate-in zoom-in-95 duration-300 border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col p-8 my-8">
            <button @click="closeSamplesModal" class="absolute top-6 right-6 text-white/30 hover:text-white transition-colors z-10">
              <X :size="24" stroke-width="1.5" />
            </button>

            <header class="mb-8 text-left">
               <div class="flex items-center gap-2 text-emerald-500 mb-1">
                 <Image :size="14" />
                 <span class="mono-label text-emerald-500 font-black !text-[8px]">Visual Samples</span>
               </div>
               <h2 class="text-3xl font-black text-white uppercase italic tracking-tighter">
                 DNA #{{ selectedSeed?.value }}
               </h2>
               <p class="text-zinc-500 text-sm mt-2">Amostras de imagens geradas com este DNA</p>
            </header>

            <!-- Loading State -->
            <div v-if="isLoadingSamples" class="flex flex-col items-center justify-center py-20">
              <div class="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
              <p class="mono-label text-zinc-500">LOADING SAMPLES...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="samplesData.length === 0" class="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/5 rounded-2xl">
              <div class="w-16 h-16 bg-emerald-500/5 rounded-full flex items-center justify-center mb-4 text-emerald-500/20">
                <Image :size="32" />
              </div>
              <h3 class="text-xl font-black text-white/30 uppercase italic mb-2">Sem Amostras</h3>
              <p class="mono-label opacity-40 italic text-center max-w-xs">Nenhuma imagem foi gerada com este DNA ainda.</p>
            </div>

            <!-- Gallery Grid -->
            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div
                v-for="(sample, index) in samplesData"
                :key="sample.id"
                @click="openLightbox(index)"
                class="group relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-emerald-500/50 transition-all duration-300 cursor-pointer"
              >
                <img 
                  :src="sample.dataUrl" 
                  :alt="`Sample ${index + 1}`"
                  class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                
                <!-- Overlay -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div class="absolute bottom-0 left-0 right-0 p-3">
                    <p class="text-[8px] text-white/60 font-mono line-clamp-2">{{ sample.promptUsed }}</p>
                  </div>
                </div>

                <!-- Hover Icon -->
                <div class="absolute top-2 right-2 w-8 h-8 rounded-lg bg-emerald-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye :size="16" class="text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Lightbox -->
      <Teleport to="body">
        <div v-if="currentSample"
          class="fixed inset-0 bg-black/98 backdrop-blur-3xl flex items-center justify-center z-[110]"
          @click.self="closeLightbox">
          
          <!-- Close Button -->
          <button @click="closeLightbox" class="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-20">
            <X :size="32" stroke-width="1.5" />
          </button>

          <!-- Navigation Buttons -->
          <button 
            v-if="selectedSampleIndex !== null && selectedSampleIndex > 0"
            @click="prevImage"
            class="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all z-20"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>

          <button 
            v-if="selectedSampleIndex !== null && selectedSampleIndex < samplesData.length - 1"
            @click="nextImage"
            class="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all z-20"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>

          <!-- Image Container -->
          <div class="max-w-7xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center p-8">
            <img 
              :src="currentSample.dataUrl" 
              :alt="`Sample ${(selectedSampleIndex ?? 0) + 1}`"
              class="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(16,185,129,0.3)]"
            />
            
            <!-- Image Info -->
            <div class="mt-6 max-w-3xl w-full glass-card p-6 border-emerald-500/20">
              <div class="flex items-center justify-between mb-3">
                <span class="mono-label text-emerald-500 !text-[9px]">
                  {{ (selectedSampleIndex ?? 0) + 1 }} / {{ samplesData.length }}
                </span>
                <span class="text-[8px] text-zinc-600 font-mono">
                  {{ new Date(currentSample.createdAt).toLocaleString() }}
                </span>
              </div>
              
              <p class="text-xs text-white/80 font-mono leading-relaxed mb-2">
                {{ currentSample.promptUsed }}
              </p>
              
              <div v-if="currentSample.outputTitle" class="flex items-center gap-2 pt-3 border-t border-white/5">
                <span class="mono-label !text-[8px] text-zinc-600">OUTPUT:</span>
                <span class="text-[10px] text-emerald-500 font-medium">{{ currentSample.outputTitle }}</span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>
