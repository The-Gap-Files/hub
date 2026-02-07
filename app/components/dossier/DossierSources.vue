<template>
  <div class="glass-card overflow-hidden">
    <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <LinkIcon :size="20" />
        </div>
        <h3 class="text-sm font-black uppercase tracking-[0.2em] text-white">Fontes Secundárias</h3>
      </div>
      <button 
        v-if="!showForm" 
        @click="showForm = true" 
        class="btn-secondary !py-1.5 !px-4 text-[10px] uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/10"
      >
        + Expandir Pesquisa
      </button>
    </div>

    <!-- Form para Adicionar (Cyberpunk Style) -->
    <div v-if="showForm" class="p-8 border-b border-white/5 bg-primary/[0.02] animate-in slide-in-from-top-4 duration-500">
      <div class="flex justify-between items-center mb-8">
        <p class="mono-label text-primary">Injetar Novo Vetor de Inteligência</p>
        <button @click="resetForm" class="text-white/30 hover:text-white transition-colors">
          <X :size="20" />
        </button>
      </div>

      <form @submit.prevent="addSource" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="mono-label !text-[9px]">{{ titleLabel }}</label>
            <input 
              v-model="form.title" 
              type="text" 
              :placeholder="titlePlaceholder" 
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all"
              required
            />
          </div>
          <div class="space-y-2">
            <label class="mono-label !text-[9px]">Protocolo de Origem</label>
            <div class="relative" ref="vDropdownRef">
              <button 
                type="button"
                @click="isVDropdownOpen = !isVDropdownOpen"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all flex items-center justify-between group/select"
                :class="{ 'border-primary': isVDropdownOpen }"
              >
                <div class="flex items-center gap-2">
                  <component :is="selectedTypeIcon" :size="14" class="text-primary/70" />
                  <span class="uppercase text-[10px] font-black tracking-widest">{{ selectedTypeLabel }}</span>
                </div>
                <ChevronDown :size="16" class="text-zinc-600 transition-transform" :class="{ 'rotate-180 text-primary': isVDropdownOpen }" />
              </button>

              <!-- Custom Dropdown Menu -->
              <div v-if="isVDropdownOpen" class="absolute z-50 top-full left-0 right-0 mt-2 p-1.5 bg-[#0D0D12] border border-white/10 rounded-xl shadow-2xl backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200">
                <button
                  v-for="type in sourceTypes"
                  :key="type.id"
                  type="button"
                  @click="selectType(type.id)"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-all text-left group/opt"
                  :class="{ 'bg-primary/10 text-primary': form.sourceType === type.id }"
                >
                  <component :is="type.icon" :size="14" class="text-zinc-500 group-hover/opt:text-primary transition-colors" :class="{ 'text-primary': form.sourceType === type.id }" />
                  <span class="text-[9px] font-black uppercase tracking-widest">{{ type.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex justify-between items-end">
             <label class="mono-label !text-[9px]">{{ contentLabel }}</label>
             <span class="text-[8px] text-zinc-500 uppercase tracking-tighter opacity-60">*Necessário para processamento Neural</span>
          </div>
          <textarea 
            v-model="form.content" 
            rows="4" 
            :placeholder="contentPlaceholder" 
            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all resize-none custom-scrollbar"
            required
          ></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="mono-label !text-[9px] flex items-center gap-2">
              Endereço Digital (URL)
              <span v-if="form.sourceType === 'url'" class="text-primary text-[8px] ml-auto font-bold uppercase tracking-wider">Obrigatório</span>
            </label>
            <div class="flex gap-2">
              <input 
                v-model="form.url" 
                type="url" 
                :required="form.sourceType === 'url'"
                placeholder="https://gap.files/source" 
                class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all"
              />
              <button 
                v-if="form.sourceType === 'url'"
                type="button"
                @click="extractContent"
                :disabled="!form.url || isExtracting"
                class="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed group/magic"
                title="Extração Neural Automática"
              >
                <Sparkles v-if="!isExtracting" :size="18" class="group-hover/magic:animate-pulse" />
                <Loader2 v-else :size="18" class="animate-spin" />
              </button>
            </div>
          </div>
          <div class="space-y-2">
            <label class="mono-label !text-[9px]">Agente/Autor</label>
            <input 
              v-model="form.author" 
              type="text" 
              placeholder="Nome do informante ou veículo" 
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <button 
          type="submit" 
          :disabled="submitting"
          class="btn-primary w-full py-4 tracking-[0.3em] !text-xs"
        >
          <span v-if="!submitting" class="flex items-center justify-center gap-2">
            <Database :size="16" />
            CONFIRMAR INJEÇÃO
          </span>
          <span v-else class="flex items-center justify-center gap-2">
            <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            PROCESSANDO...
          </span>
        </button>
      </form>
    </div>

    <!-- Lista de Fontes -->
    <div class="p-8">
      <div v-if="sources.length > 0" class="space-y-4">
        <div 
          v-for="source in sources" 
          :key="source.id"
          class="group relative flex gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-500"
        >
          <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-primary group-hover:border-primary/20 transition-all">
            <Globe v-if="source.sourceType === 'url'" :size="20" />
            <FileText v-else :size="20" />
          </div>
          
          <div class="flex-1 min-w-0 space-y-2">
            <div class="flex justify-between items-start">
              <h4 class="text-md font-bold text-white group-hover:text-primary transition-colors leading-tight">
                {{ source.title }}
              </h4>
              <span class="mono-label !text-[8px] opacity-40 group-hover:opacity-100">{{ source.sourceType }}</span>
            </div>
            
            <p class="text-xs text-muted-foreground leading-relaxed italic group-hover:text-white/60 line-clamp-2">
              "{{ source.content }}"
            </p>
            
            <div class="flex items-center gap-4 pt-1">
              <div v-if="source.author" class="flex items-center gap-1.5">
                <div class="w-1 h-1 rounded-full bg-primary/40"></div>
                <span class="mono-label !text-[8px] !lowercase text-muted-foreground">{{ source.author }}</span>
              </div>
              <a v-if="source.url" :href="source.url" target="_blank" class="flex items-center gap-1 text-[9px] font-black uppercase text-blue-400/50 hover:text-blue-400 transition-colors tracking-tighter">
                <ExternalLink :size="10" />
                Datalink Original
              </a>
            </div>
          </div>

          <button @click="deleteSource(source.id)" 
                  class="opacity-0 group-hover:opacity-100 absolute top-4 right-4 text-red-500/30 hover:text-red-500 p-2 transition-all">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
      
      <div v-else class="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
        <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/10">
          <Database :size="32" />
        </div>
        <p class="mono-label opacity-30 italic">Aguardando injeção de fontes secundárias...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  Link as LinkIcon, X, Database, Globe, 
  FileText, ExternalLink, Trash2,
  ChevronDown, Sparkles, Loader2
} from 'lucide-vue-next'

const props = defineProps<{
  dossierId: string
  initialSources: any[]
}>()

const emit = defineEmits(['updated'])

const sources = ref([...props.initialSources])
const showForm = ref(false)
const submitting = ref(false)
const isExtracting = ref(false)
const isVDropdownOpen = ref(false)
const vDropdownRef = ref<HTMLElement | null>(null)

const form = ref({
  title: '',
  sourceType: 'url',
  content: '',
  url: '',
  author: ''
})

async function extractContent() {
  if (!form.value.url) return
  
  isExtracting.value = true
  try {
    const response = await $fetch<{ success: boolean, data: { title: string, content: string, author?: string } }>('/api/tools/extract-url', {
      method: 'POST',
      body: { url: form.value.url }
    })
    
    if (response.success && response.data) {
      // Preenchimento inteligente: só sobrescreve se estiver vazio ou se o usuário não tiver digitado muito
      if (!form.value.title || form.value.title.length < 5) {
        form.value.title = response.data.title
      }
      
      form.value.content = response.data.content
      
      if (response.data.author && !form.value.author) {
        form.value.author = response.data.author
      }
    }
  } catch (error: any) {
    console.error('Erro na extração:', error)
    alert(error.data?.message || 'Não foi possível ler o conteúdo deste link. Tente copiar manualmente.')
  } finally {
    isExtracting.value = false
  }
}

const sourceTypes = [
  { id: 'url', label: 'HTTP (Web)', icon: Globe },
  { id: 'text', label: 'Textos Diversos', icon: FileText },
]

const selectedTypeLabel = computed(() => {
  return sourceTypes.find(t => t.id === form.value.sourceType)?.label
})

const selectedTypeIcon = computed(() => {
  return sourceTypes.find(t => t.id === form.value.sourceType)?.icon
})

function selectType(id: string) {
  form.value.sourceType = id
  isVDropdownOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (vDropdownRef.value && !vDropdownRef.value.contains(event.target as Node)) {
    isVDropdownOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})

function resetForm() {
  form.value = {
    title: '',
    sourceType: 'url',
    content: '',
    url: '',
    author: ''
  }
  showForm.value = false
  isVDropdownOpen.value = false
}

const titleLabel = computed(() => {
  switch (form.value.sourceType) {
    case 'url': return 'Título da Página/Matéria'
    case 'text': return 'Título do Texto'
    default: return 'Identificação da Fonte'
  }
})

const titlePlaceholder = computed(() => {
  switch (form.value.sourceType) {
    case 'url': return 'Ex: Notícia sobre o caso...'
    case 'text': return 'Ex: Documento de referência, anotação, trecho...'
    default: return 'Ex: Fonte de dados...'
  }
})

const contentLabel = computed(() => {
  switch (form.value.sourceType) {
    case 'url': return 'Resumo do Conteúdo da Página'
    case 'text': return 'Conteúdo do Texto'
    default: return 'Dados Extraídos'
  }
})

const contentPlaceholder = computed(() => {
  switch (form.value.sourceType) {
    case 'url': return 'Descreva brevemente o conteúdo do link ou cole o texto principal da matéria...'
    case 'text': return 'Cole aqui o texto, trecho, anotação ou qualquer conteúdo de referência...'
    default: return 'Insira os dados para o pipeline...'
  }
})

async function addSource() {
  submitting.value = true
  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/sources`, {
      method: 'POST',
      body: form.value
    })
    sources.value.unshift(data)
    emit('updated')
    resetForm()
  } catch (error: any) {
    console.error('Erro ao adicionar fonte:', error)
    alert(error.data?.message || 'Erro ao adicionar fonte')
  } finally {
    submitting.value = false
  }
}

async function deleteSource(id: string) {
  if (!confirm('Tem certeza que deseja remover esta fonte?')) return
  try {
    sources.value = sources.value.filter(s => s.id !== id)
    emit('updated')
  } catch (error) {
    console.error('Erro ao deletar fonte:', error)
  }
}

watch(() => props.initialSources, (newVal) => {
  sources.value = [...newVal]
})
</script>
