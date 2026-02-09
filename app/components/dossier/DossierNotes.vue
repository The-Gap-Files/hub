<template>
  <div class="glass-card flex flex-col max-h-[420px] bg-oled-black">
    <div class="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
          <Brain :size="20" />
        </div>
        <h3 class="text-xs font-black uppercase tracking-[0.2em] text-white">Neural Insights</h3>
      </div>
      <div class="flex items-center gap-3">
        <button 
          v-if="!showForm"
          @click="runAnalysis"
          :disabled="isAnalyzing"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border"
          :class="isAnalyzing 
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 cursor-wait' 
            : 'bg-purple-500/5 border-purple-500/20 text-purple-400/70 hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30'"
        >
          <Loader2 v-if="isAnalyzing" :size="12" class="animate-spin" />
          <Sparkles v-else :size="12" />
          <span>{{ isAnalyzing ? 'Analisando...' : 'Análise Neural' }}</span>
        </button>
        <button 
          v-if="!showForm" 
          @click="showForm = true" 
          class="text-amber-500/50 hover:text-amber-500 text-[10px] font-black uppercase tracking-widest transition-all"
        >
          + Add Log
        </button>
      </div>
    </div>

    <!-- Banner de resultado da análise -->
    <div v-if="analysisResult" class="px-6 py-3 bg-purple-500/5 border-b border-purple-500/10 flex justify-between items-center animate-in fade-in duration-500">
      <span class="text-[9px] font-black uppercase tracking-widest text-purple-400/80">
        {{ analysisResult.count }} insights gerados via {{ analysisResult.provider }}
      </span>
      <button @click="analysisResult = null" class="text-purple-400/30 hover:text-purple-400 transition-colors">
        <X :size="14" />
      </button>
    </div>

    <!-- Lista de Notas (Mural Digital Style) -->
    <div v-if="notes.length > 0" class="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
      <div 
        v-for="note in notes" 
        :key="note.id"
        class="relative group bg-white/[0.03] border border-white/5 rounded-2xl p-4 hover:border-amber-500/30 transition-all duration-500"
      >
        <div class="absolute top-4 right-4 flex items-center gap-2">
           <span 
            v-if="note.noteType" 
            :class="getNoteTypeClass(note.noteType)"
            class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter"
          >
            {{ note.noteType }}
          </span>
        </div>
        
        <p class="text-sm text-zinc-400 leading-relaxed font-medium group-hover:text-white transition-colors pr-8">
          {{ note.content }}
        </p>
        
        <div class="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
          <span class="text-[9px] font-mono text-zinc-600 uppercase">{{ formatDate(note.createdAt) }}</span>
          <button @click="deleteNote(note.id)" class="opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 transition-all">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>
    
    <div v-else-if="!showForm" class="flex-1 flex flex-col items-center justify-center py-10 text-center px-10">
      <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/10">
        <Edit3 :size="24" />
      </div>
      <p class="mono-label opacity-30 italic leading-relaxed text-xs">Nenhum insight neural registrado.</p>
      <button @click="showForm = true" class="mt-4 btn-secondary !text-[10px] py-1.5 px-6">
        Iniciar Registro
      </button>
    </div>

    <!-- Form de Entrada (Cyberpunk Interface) -->
    <div v-if="showForm" class="p-6 bg-white/[0.05] border-t border-amber-500/20 animate-in slide-in-from-bottom-4 duration-500">
      <div class="flex justify-between items-center mb-4">
        <span class="mono-label text-amber-500">Captura de Brainstorm</span>
        <button @click="showForm = false" class="text-white/20 hover:text-white transition-colors">
          <X :size="16" />
        </button>
      </div>
      
      <textarea 
        v-model="newNote.content" 
        rows="3" 
        placeholder="Documente o insight..." 
        class="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none transition-all resize-none shadow-inner"
        required
      ></textarea>
      
      <div class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mt-6 gap-4">
        <!-- Custom Dropdown para Tipo de Nota -->
        <div class="relative" ref="typeDropdownRef">
          <button 
            type="button"
            @click="isTypeDropdownOpen = !isTypeDropdownOpen"
            class="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-[9px] font-black text-amber-500 uppercase tracking-widest outline-none transition-all flex items-center gap-3 hover:border-amber-500/30"
            :class="{ 'border-amber-500': isTypeDropdownOpen }"
          >
            <div class="w-1.5 h-1.5 rounded-full" :class="getNoteTypeBulletClass(newNote.noteType)"></div>
            <span>{{ selectedTypeLabel }}</span>
            <ChevronDown :size="12" class="transition-transform" :class="{ 'rotate-180': isTypeDropdownOpen }" />
          </button>

          <!-- Dropdown Menu -->
          <div v-if="isTypeDropdownOpen" class="absolute z-50 bottom-full left-0 mb-2 p-1.5 bg-[#0D0D12] border border-white/10 rounded-xl shadow-2xl backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-2 duration-200 min-w-[140px]">
             <button
                v-for="type in noteTypes"
                :key="type.id"
                type="button"
                @click="selectType(type.id)"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-all text-left group/opt"
                :class="{ 'bg-amber-500/10 text-amber-500': newNote.noteType === type.id }"
             >
                <div class="w-1.5 h-1.5 rounded-full" :class="type.bullet"></div>
                <span class="text-[9px] font-black uppercase tracking-widest">{{ type.label }}</span>
             </button>
          </div>
        </div>

        <button 
          @click="addNote" 
          :disabled="!newNote.content || submitting" 
          class="btn-primary !px-6 !py-2 !text-[10px] !bg-amber-600 hover:!bg-amber-500 shadow-none border-none disabled:opacity-30"
        >
          {{ submitting ? '...' : 'REGISTRAR' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Brain, X, Trash2, Edit3, ChevronDown, Sparkles, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  dossierId: string
  initialNotes: any[]
}>()

const emit = defineEmits(['updated'])

const notes = ref([...props.initialNotes])
const showForm = ref(false)
const submitting = ref(false)
const isAnalyzing = ref(false)
const analysisResult = ref<{ count: number; provider: string } | null>(null)
const isTypeDropdownOpen = ref(false)
const typeDropdownRef = ref<HTMLElement | null>(null)

const newNote = ref({
  content: '',
  noteType: 'insight'
})

const noteTypes = [
  { id: 'insight', label: 'Insight Neural', bullet: 'bg-blue-400' },
  { id: 'curiosity', label: 'Curiosidade', bullet: 'bg-purple-400' },
  { id: 'research', label: 'Pesquisa', bullet: 'bg-cyan-400' },
  { id: 'data', label: 'Dados Brutos', bullet: 'bg-emerald-400' },
  { id: 'todo', label: 'Sub-Task', bullet: 'bg-rose-400' },
]

const selectedTypeLabel = computed(() => {
  return noteTypes.find(t => t.id === newNote.value.noteType)?.label
})

function selectType(id: string) {
  newNote.value.noteType = id
  isTypeDropdownOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (typeDropdownRef.value && !typeDropdownRef.value.contains(event.target as Node)) {
    isTypeDropdownOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})

async function addNote() {
  if (!newNote.value.content) return
  
  submitting.value = true
  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/notes`, {
      method: 'POST',
      body: newNote.value
    })
    notes.value.unshift(data)
    emit('updated')
    newNote.value.content = ''
    showForm.value = false
  } catch (error) {
    console.error('Erro ao adicionar nota:', error)
  } finally {
    submitting.value = false
  }
}

async function runAnalysis() {
  isAnalyzing.value = true
  analysisResult.value = null
  try {
    const data = await $fetch<{ success: boolean; notes: any[]; count: number; provider: string; model: string }>(`/api/dossiers/${props.dossierId}/analyze-insights`, {
      method: 'POST'
    })
    if (data.success && data.notes.length > 0) {
      // Adicionar as novas notas no topo da lista
      notes.value.unshift(...data.notes)
      analysisResult.value = { count: data.count, provider: `${data.provider} (${data.model})` }
      emit('updated')
    }
  } catch (error: any) {
    console.error('Erro na análise neural:', error)
    alert(error.data?.message || 'Erro ao executar análise neural. Verifique se o provider de IA está configurado.')
  } finally {
    isAnalyzing.value = false
  }
}

async function deleteNote(id: string) {
  if (!confirm('Eliminar este registro permanentemente?')) return
  try {
    await $fetch(`/api/notes/${id}`, { method: 'DELETE' })
    notes.value = notes.value.filter(n => n.id !== id)
    emit('updated')
  } catch (error) {
    console.error('Erro ao deletar nota:', error)
  }
}

function getNoteTypeClass(type: string) {
  switch (type) {
    case 'insight': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    case 'data': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    case 'curiosity': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
    case 'research': return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
    case 'todo': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
    default: return 'bg-white/10 text-white/50 border border-white/20'
  }
}

function getNoteTypeBulletClass(type: string) {
  switch (type) {
    case 'insight': return 'bg-blue-400 shadow-[0_0_8px_#60a5fa]'
    case 'data': return 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
    case 'curiosity': return 'bg-purple-400 shadow-[0_0_8px_#c084fc]'
    case 'research': return 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
    case 'todo': return 'bg-rose-400 shadow-[0_0_8px_#fb7185]'
    default: return 'bg-white/50 shadow-none'
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

watch(() => props.initialNotes, (newVal) => {
  notes.value = [...newVal]
})
</script>
