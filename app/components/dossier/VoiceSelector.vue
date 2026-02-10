<template>
  <div class="space-y-2 relative" ref="containerRef">
    <label class="mono-label !text-xs text-zinc-500 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Mic :size="14" />
        {{ label || 'Voz do Narrador (IA)' }}
      </div>
      <div v-if="manualMode" class="text-xs text-primary font-bold uppercase tracking-widest animate-pulse">
        MODO MANUAL
      </div>
    </label>

    <!-- Trigger Button -->
    <!-- Trigger Button -->
    <div class="space-y-2">
      <button 
        @click="toggleDropdown"
        class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between text-sm outline-none hover:border-primary/50 transition-all shadow-inner group"
        :class="{ 'border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]': isOpen, 'opacity-50 pointer-events-none': manualMode }"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
            <Mic :size="14" />
          </div>
          <span v-if="selectedVoice" class="text-white font-medium">{{ selectedVoice.name }}</span>
          <span v-else class="text-zinc-500 italic">Padrão do Sistema ou Manual...</span>
        </div>
        <ChevronDown :size="16" class="text-zinc-500 transition-transform duration-300" :class="{ 'rotate-180': isOpen }" />
      </button>

      <!-- Manual Voice ID Input -->
      <div v-if="!selectedVoice" class="relative group animate-in fade-in slide-in-from-top-1">
        <div class="absolute inset-0 bg-primary/5 blur-lg rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <input 
          v-model="customVoiceId" 
          @input="onCustomIdInput"
          type="text" 
          placeholder="Ou cole um ID de Voz da ElevenLabs aqui..."
          class="w-full bg-black/40 border border-white/10 border-dashed rounded-xl px-4 py-3 text-xs text-primary font-mono placeholder-zinc-600 outline-none focus:border-primary focus:bg-black/80 transition-all relative z-10"
        />
      </div>
    </div>

    <!-- Dropdown Menu -->
    <div v-show="isOpen" 
         class="absolute z-50 top-full left-0 right-0 mt-2 bg-[#0A0A0F] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-top">
      
      <!-- Search Header -->
      <div class="p-3 border-b border-white/5 bg-white/[0.02]">
        <div class="relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar voz..." 
            class="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50 transition-colors"
          >
        </div>
      </div>

      <!-- Voices List -->
      <div class="max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1" ref="listRef">
        <!-- Default Option -->
        <button 
          @click="selectVoice(null)"
          class="w-full px-3 py-3 rounded-lg flex items-center gap-3 hover:bg-white/5 transition-colors group/item"
          :class="{ 'bg-primary/20': !modelValue }"
        >
          <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
            <Mic :size="16" />
          </div>
          <div class="text-left flex-1">
             <p class="text-sm font-bold text-white group-hover/item:text-primary transition-colors">Padrão do Sistema</p>
             <p class="text-xs text-zinc-500">Rachel (ElevenLabs)</p>
          </div>
        </button>

        <div v-if="filteredVoices.length === 0 && !loading" class="p-4 text-center text-zinc-600 text-sm italic">
          Nenhuma voz encontrada.
        </div>

        <button 
          v-for="voice in filteredVoices" 
          :key="voice.id"
          class="w-full px-3 py-2 rounded-lg flex items-center gap-3 hover:bg-white/5 transition-colors group/item relative"
          :class="{ 'bg-primary/10 border border-primary/20': modelValue === voice.id }"
        >
          <!-- Selection Area -->
          <div class="flex-1 flex items-center gap-3 cursor-pointer" @click="selectVoice(voice)">
             <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors text-white font-bold text-xs"
                  :class="modelValue === voice.id ? 'bg-primary shadow-glow' : 'bg-white/10 text-zinc-400'">
                {{ voice.name.charAt(0) }}
             </div>
             <div class="text-left overflow-hidden">
                <p class="text-sm font-bold text-white truncate group-hover/item:text-primary transition-colors">
                  {{ voice.name }}
                </p>
                <div class="flex items-center gap-2">
                   <p class="text-xs text-zinc-500 truncate">{{ voice.labels?.accent || 'EN' }} • {{ voice.labels?.description || 'General' }}</p>
                </div>
             </div>
          </div>

          <!-- Preview Button -->
          <button 
            v-if="voice.preview_url"
            @click.stop="togglePreview(voice.preview_url)"
            class="p-2 rounded-full hover:bg-white/10 text-zinc-500 hover:text-primary transition-colors shrink-0 z-10"
          >
             <div v-if="currentPreviewUrl === voice.preview_url && isPlaying" class="flex gap-0.5 items-end h-3">
                <span class="w-0.5 bg-current animate-[soundwave_0.5s_ease-in-out_infinite] h-2"></span>
                <span class="w-0.5 bg-current animate-[soundwave_0.7s_ease-in-out_infinite] h-3"></span>
                <span class="w-0.5 bg-current animate-[soundwave_0.4s_ease-in-out_infinite] h-1.5"></span>
             </div>
             <Play v-else :size="12" class="fill-current" />
          </button>
        </button>
        
        <!-- Loading Indicator / Intersection Trigger -->
        <div ref="observerRef" class="py-4 flex justify-center w-full" v-if="hasMore || loading">
           <div v-if="loading" class="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
           <button v-else-if="hasMore" @click="loadMore" class="text-xs text-primary hover:underline">Carregar mais...</button>
        </div>
      </div>
    </div>
    
    <!-- Backdrop para fechar ao clicar fora -->
    <div v-if="isOpen" class="fixed inset-0 z-40" @click="isOpen = false"></div>
  </div>
</template>

<script setup lang="ts">
import { Mic, ChevronDown, Search, Play, Pause, Volume2 } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string | null | undefined
  label?: string
  initialVoices?: any[]
  initialCursor?: string
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const searchQuery = ref('')
const voices = ref<any[]>(props.initialVoices || [])
const customVoiceId = ref('')
const manualMode = computed(() => !!customVoiceId.value && !selectedVoice.value)
const loading = ref(false)
const nextCursor = ref<string | undefined>(props.initialCursor)
// Se tem cursor inicial, tem mais. Se não tem cursor mas tem vozes, assumimos que acabou? 
// Se initialVoices tem items mas cursor é undefined, então acabou a lista (page total < 1 page).
const hasMore = ref(!!props.initialCursor || (!props.initialVoices?.length)) 
const containerRef = ref(null)
const observerRef = ref(null)
const listRef = ref(null)

// Audio Preview Logic
const currentPreviewUrl = ref<string | null>(null)
const isPlaying = ref(false)
let audioObj: HTMLAudioElement | null = null

// Filtragem local (apenas visual, pois a busca real seria backend)
// Mas como vamos paginar, o ideal é busca no backend. 
// Por enquanto, filtro local na lista carregada é UX "ok", mas busca backend é "Pro Max". 
// Vamos implementar busca local + load more por enquanto para simplificar, mas preparado para API.
const filteredVoices = computed(() => {
  if (!searchQuery.value) return voices.value
  const q = searchQuery.value.toLowerCase()
  return voices.value.filter(v => 
    v.name.toLowerCase().includes(q) || 
    (v.labels?.accent && v.labels.accent.toLowerCase().includes(q))
  )
})

const selectedVoice = computed(() => {
  return voices.value.find(v => v.id === props.modelValue)
})

// Initialize Custom ID if modelValue is present but not in list
watch(() => props.modelValue, (val) => {
  if (val && !voices.value.find(v => v.id === val)) {
    customVoiceId.value = val
  } else if (!val) {
    // Se modelValue foi limpo externamente, talvez limpar customId?
    // Depende da UX. Deixar por enquanto.
  }
}, { immediate: true })

function onCustomIdInput() {
  if (customVoiceId.value) {
    emit('update:modelValue', customVoiceId.value)
  } else {
    emit('update:modelValue', '')
  }
}

async function fetchVoices(reset = false) {
  if (loading.value) return
  if (!reset && !hasMore.value) return

  loading.value = true
  try {
    const params: any = { pageSize: 100 }
    if (!reset && nextCursor.value) params.cursor = nextCursor.value
    // if (searchQuery.value) params.search = searchQuery.value // Descomentar se API suportar search

    const data: any = await $fetch('/api/voices', { params })
    
    if (reset) {
      voices.value = data.voices
    } else {
      // Dedup voices just in case
      const newVoices = data.voices.filter((nv: any) => !voices.value.some(ov => ov.id === nv.id))
      voices.value = [...voices.value, ...newVoices]
    }
    
    nextCursor.value = data.nextCursor
    hasMore.value = !!data.nextCursor
  } catch (err) {
    console.error('Falha ao buscar vozes:', err)
  } finally {
    loading.value = false
  }
}

function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value && voices.value.length === 0) {
    fetchVoices(true)
  }
}

function selectVoice(voice: any) {
  if (voice) {
    customVoiceId.value = '' // Limpa manual se selecionar da lista
    emit('update:modelValue', voice.id)
  } else {
    emit('update:modelValue', '') // Selecionou "Padrão", deixa vazio (vai pro .env)
  }
  isOpen.value = false
}

function togglePreview(url: string) {
  if (currentPreviewUrl.value === url && isPlaying.value) {
    audioObj?.pause()
    isPlaying.value = false
    return
  }

  if (audioObj) {
    audioObj.pause()
  }

  currentPreviewUrl.value = url
  audioObj = new Audio(url)
  audioObj.volume = 0.5
  
  audioObj.onended = () => {
    isPlaying.value = false
  }
  
  audioObj.play().then(() => {
    isPlaying.value = true
  }).catch(e => console.error("Audio play error", e))
}

function loadMore() {
  fetchVoices(false)
}

// Observer para Infinite Scroll
let observer: IntersectionObserver | null = null

onMounted(() => {
  // Se já temos vozes iniciais, talvez precise verificar se tem mais
  if (props.initialVoices && props.initialVoices.length > 0) {
     // Assumir que se veio inicial, talvez tenha mais? Dificil saber sem o cursor inicial.
     // O ideal seria o pai passar o response completo.
     // Vamos tentar buscar a página 1 denovo se o user scrollar pro fim, ou assumir logic
  } else {
    // Buscar primeira pagina se vazio
    fetchVoices(true)
  }

  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      loadMore()
    }
  }, {
    root: listRef.value,
    threshold: 0.1
  })
  
  if (observerRef.value) observer.observe(observerRef.value)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
  if (audioObj) audioObj.pause()
})

// Re-attach observer when loading state changes or after render
watch([loading, isOpen], async () => {
  await nextTick()
  if (observerRef.value && observer) {
     observer.disconnect()
     observer.observe(observerRef.value)
  }
})

</script>

<style scoped>
@keyframes soundwave {
  0%, 100% { height: 4px; }
  50% { height: 100%; }
}
</style>
