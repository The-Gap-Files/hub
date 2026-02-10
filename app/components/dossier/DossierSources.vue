<template>
  <div class="glass-card overflow-hidden">
    <div class="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <LinkIcon :size="16" />
        </div>
        <h3 class="text-xs font-bold uppercase tracking-wider text-white">Fontes do Dossiê</h3>
        <span v-if="sources.length > 0" class="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-black tabular-nums">{{ sources.length }}</span>
      </div>
      <button 
        v-if="!showForm" 
        @click="showForm = true" 
        class="btn-secondary !py-1.5 !px-3 text-xs font-medium border-primary/20 text-primary hover:bg-primary/10"
      >
        + Adicionar fonte
      </button>
    </div>

    <!-- Form para Adicionar (Cyberpunk Style) -->
    <div v-if="showForm" class="p-6 border-b border-white/5 bg-primary/[0.02] animate-in slide-in-from-top-4 duration-500">
      <div class="flex justify-between items-center mb-6">
        <p class="text-xs font-medium text-primary">Adicionar nova fonte</p>
        <button @click="resetForm" class="text-white/30 hover:text-white transition-colors">
          <X :size="18" />
        </button>
      </div>

      <form @submit.prevent="addSource" class="space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="space-y-1.5">
            <label class="field-label">{{ titleLabel }}</label>
            <input 
              v-model="form.title" 
              type="text" 
              :placeholder="titlePlaceholder" 
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all"
              required
            />
          </div>
          <div class="space-y-1.5">
            <label class="field-label">Tipo de Fonte</label>
            <div class="relative" ref="vDropdownRef">
              <button 
                type="button"
                @click="isVDropdownOpen = !isVDropdownOpen"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all flex items-center justify-between group/select"
                :class="{ 'border-primary': isVDropdownOpen }"
              >
                <div class="flex items-center gap-2">
                  <component :is="selectedTypeIcon" :size="14" class="text-primary/70" />
                  <span class="uppercase text-xs font-black tracking-widest">{{ selectedTypeLabel }}</span>
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
                  <span class="text-xs font-black uppercase tracking-widest">{{ type.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Upload PDF (apenas para Textos Diversos) -->
        <div v-if="form.sourceType === 'text'" class="space-y-1.5">
          <label class="field-label">Importar de PDF</label>
          <div 
            class="relative flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all duration-300"
            :class="pdfFile 
              ? 'border-primary/40 bg-primary/[0.04]' 
              : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'"
          >
            <input 
              ref="pdfInputRef"
              type="file" 
              accept=".pdf,application/pdf" 
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              @change="onPdfSelected"
            />
            <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors" :class="pdfFile ? 'bg-primary/10 text-primary' : 'bg-white/5 text-white/30'">
              <FileUp :size="20" />
            </div>
            <div class="flex-1 min-w-0">
              <p v-if="pdfFile" class="text-sm text-white truncate">{{ pdfFile.name }}</p>
              <p v-else class="text-xs text-zinc-500">Arraste um PDF ou clique para selecionar</p>
              <p v-if="pdfFile" class="text-xs text-zinc-500 mt-0.5">{{ (pdfFile.size / 1024).toFixed(0) }}KB</p>
            </div>
            <button 
              v-if="pdfFile"
              type="button"
              @click.stop="extractPdf"
              :disabled="isExtractingPdf"
              class="relative z-20 flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-primary text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="isExtractingPdf" :size="14" class="animate-spin" />
              <Upload v-else :size="14" />
              <span>{{ isExtractingPdf ? 'Convertendo...' : 'Converter' }}</span>
            </button>
            <button 
              v-if="pdfFile && !isExtractingPdf"
              type="button"
              @click.stop="clearPdf"
              class="relative z-20 text-white/30 hover:text-red-400 p-1 transition-colors"
              title="Remover PDF"
            >
              <X :size="16" />
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex justify-between items-end">
             <label class="field-label">{{ contentLabel }}</label>
             <span class="text-xs text-zinc-600">* Necessário</span>
          </div>
          <textarea 
            v-model="form.content" 
            rows="4" 
            :placeholder="contentPlaceholder" 
            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all resize-none custom-scrollbar"
            required
          ></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="space-y-1.5">
            <label class="field-label flex items-center gap-2">
              URL
              <span v-if="form.sourceType === 'url'" class="text-primary text-xs ml-auto font-medium">Obrigatório</span>
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
          <div class="space-y-1.5">
            <label class="field-label">Autor / Fonte</label>
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
    <div class="relative">
      <div class="p-6 max-h-[520px] overflow-y-auto custom-scrollbar">
      <div v-if="sources.length > 0" class="space-y-4">
        <div 
          v-for="source in sources" 
          :key="source.id"
          class="group relative rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-500 overflow-hidden"
        >
          <!-- Header da Fonte -->
          <div class="flex gap-6 p-6 cursor-pointer" @click="toggleEdit(source.id)">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-primary group-hover:border-primary/20 transition-all">
              <Globe v-if="source.sourceType === 'url'" :size="20" />
              <FileText v-else :size="20" />
            </div>
            
            <div class="flex-1 min-w-0 space-y-2">
              <div class="flex justify-between items-start">
                <h4 class="text-md font-bold text-white group-hover:text-primary transition-colors leading-tight">
                  {{ source.title }}
                </h4>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono text-zinc-600">
                    {{ estimateWordCount(source.content) }} palavras
                  </span>
                  <span class="text-xs font-mono text-zinc-600/40 group-hover:text-zinc-500">{{ source.sourceType }}</span>
                </div>
              </div>
              
              <p v-if="editingSourceId !== source.id" class="text-xs text-muted-foreground leading-relaxed italic group-hover:text-white/60 line-clamp-2">
                "{{ source.content }}"
              </p>
              
              <div class="flex items-center gap-4 pt-1">
                <div v-if="source.author" class="flex items-center gap-1.5">
                  <div class="w-1 h-1 rounded-full bg-primary/40"></div>
                  <span class="text-xs text-zinc-500">{{ source.author }}</span>
                </div>
                <a v-if="source.url" :href="source.url" target="_blank" @click.stop class="flex items-center gap-1 text-xs font-black uppercase text-blue-400/50 hover:text-blue-400 transition-colors tracking-tighter">
                  <ExternalLink :size="10" />
                  Datalink Original
                </a>
              </div>
            </div>

            <div class="flex items-start gap-1">
              <button 
                @click.stop="toggleEdit(source.id)" 
                class="opacity-0 group-hover:opacity-100 text-primary/30 hover:text-primary p-2 transition-all"
                :title="editingSourceId === source.id ? 'Fechar editor' : 'Editar conteúdo'"
              >
                <Pencil v-if="editingSourceId !== source.id" :size="16" />
                <ChevronUp v-else :size="16" />
              </button>
              <button @click.stop="deleteSource(source.id)" 
                      class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 p-2 transition-all">
                <Trash2 :size="16" />
              </button>
            </div>
          </div>

          <!-- Editor Inline (expande ao clicar) -->
          <div v-if="editingSourceId === source.id" class="px-6 pb-6 border-t border-white/5 bg-white/[0.02] animate-in slide-in-from-top-2 duration-300">
            <div class="pt-4 space-y-4">
              <!-- Título editável -->
              <div class="space-y-1">
                <label class="field-label">Título</label>
                <input 
                  v-model="editForm.title" 
                  type="text" 
                  class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none transition-all"
                />
              </div>

              <!-- Conteúdo editável -->
              <div class="space-y-1">
                <div class="flex justify-between items-center">
                  <label class="field-label">Conteúdo</label>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-mono" :class="contentTokenClass(editForm.content)">
                      ~{{ estimateTokens(editForm.content).toLocaleString() }} tokens · {{ estimateWordCount(editForm.content).toLocaleString() }} palavras
                    </span>
                    <!-- Botão Resumir -->
                    <button
                      v-if="estimateWordCount(editForm.content) > 500"
                      @click="summarizeSource(source.id)"
                      :disabled="isSummarizing"
                      class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all border"
                      :class="isSummarizing 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-wait' 
                        : 'bg-amber-500/5 border-amber-500/20 text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30'"
                    >
                      <Loader2 v-if="isSummarizing" :size="10" class="animate-spin" />
                      <Sparkles v-else :size="10" />
                      <span>{{ isSummarizing ? 'Resumindo...' : 'Resumir IA' }}</span>
                    </button>
                  </div>
                </div>
                <textarea 
                  v-model="editForm.content" 
                  rows="10" 
                  class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none transition-all resize-y custom-scrollbar font-mono leading-relaxed"
                ></textarea>
              </div>

              <!-- Ações -->
              <div class="flex justify-between items-center pt-2">
                <button 
                  @click="editingSourceId = null" 
                  class="text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <div class="flex items-center gap-3">
                  <span v-if="editSaved" class="text-xs font-black uppercase tracking-widest text-emerald-400 animate-in fade-in duration-300">
                    ✓ Salvo
                  </span>
                  <button 
                    @click="saveEdit(source.id)"
                    :disabled="isSavingEdit"
                    class="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-primary text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    <Loader2 v-if="isSavingEdit" :size="12" class="animate-spin" />
                    <Save v-else :size="12" />
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
        <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-white/8">
          <Database :size="24" />
        </div>
        <p class="text-xs text-zinc-600">Nenhuma fonte adicionada</p>
      </div>
      </div>
      <!-- Fade gradient quando há scroll -->
      <div v-if="sources.length > 3" class="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[hsl(240,10%,4.9%)] to-transparent pointer-events-none rounded-b-2xl"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  Link as LinkIcon, X, Database, Globe, 
  FileText, ExternalLink, Trash2, Pencil, Save,
  ChevronDown, ChevronUp, Sparkles, Loader2,
  FileUp, Upload
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

// ───── PDF Extract State ─────
const pdfInputRef = ref<HTMLInputElement | null>(null)
const pdfFile = ref<File | null>(null)
const isExtractingPdf = ref(false)
const vDropdownRef = ref<HTMLElement | null>(null)

// ───── Edit State ─────
const editingSourceId = ref<string | null>(null)
const editForm = ref({ title: '', content: '' })
const isSavingEdit = ref(false)
const editSaved = ref(false)
const isSummarizing = ref(false)

const form = ref({
  title: '',
  sourceType: 'url',
  content: '',
  url: '',
  author: ''
})

// ───── Utils ─────
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4)
}

function estimateWordCount(text: string): number {
  return (text || '').split(/\s+/).filter(w => w.length > 0).length
}

function contentTokenClass(content: string): string {
  const tokens = estimateTokens(content)
  if (tokens > 50000) return 'text-red-400'
  if (tokens > 20000) return 'text-amber-400'
  return 'text-zinc-500'
}

// ───── Edit Actions ─────
function toggleEdit(sourceId: string) {
  if (editingSourceId.value === sourceId) {
    editingSourceId.value = null
    return
  }
  
  const source = sources.value.find(s => s.id === sourceId)
  if (source) {
    editForm.value = {
      title: source.title,
      content: source.content
    }
    editingSourceId.value = sourceId
    editSaved.value = false
  }
}

async function saveEdit(sourceId: string) {
  isSavingEdit.value = true
  editSaved.value = false
  try {
    const updated = await $fetch(`/api/sources/${sourceId}`, {
      method: 'PATCH',
      body: {
        title: editForm.value.title,
        content: editForm.value.content
      }
    }) as any

    // Atualizar na lista local
    const idx = sources.value.findIndex(s => s.id === sourceId)
    if (idx >= 0) {
      sources.value[idx] = { ...sources.value[idx], ...updated }
    }
    
    editSaved.value = true
    emit('updated')
    
    // Esconder feedback depois de 3s
    setTimeout(() => { editSaved.value = false }, 3000)
  } catch (error: any) {
    console.error('Erro ao salvar edição:', error)
    alert(error.data?.message || 'Erro ao salvar edição')
  } finally {
    isSavingEdit.value = false
  }
}

async function summarizeSource(sourceId: string) {
  isSummarizing.value = true
  try {
    const result = await $fetch(`/api/sources/${sourceId}/summarize`, {
      method: 'POST',
      body: { save: true }
    }) as any

    if (result.success) {
      // Atualizar o editForm com o resumo
      editForm.value.content = result.summary

      // Atualizar na lista local
      const idx = sources.value.findIndex(s => s.id === sourceId)
      if (idx >= 0) {
        sources.value[idx] = { ...sources.value[idx], content: result.summary }
      }

      editSaved.value = true
      emit('updated')

      console.log(`[DossierSources] ✅ Resumo: ${result.originalWordCount} → ${result.summaryWordCount} palavras`)
      setTimeout(() => { editSaved.value = false }, 3000)
    }
  } catch (error: any) {
    console.error('Erro ao resumir:', error)
    alert(error.data?.message || 'Erro ao resumir conteúdo')
  } finally {
    isSummarizing.value = false
  }
}

// ───── Extraction ─────
async function extractContent() {
  if (!form.value.url) return
  
  isExtracting.value = true
  try {
    const response = await $fetch<{ success: boolean, data: { title: string, content: string, author?: string } }>('/api/tools/extract-url', {
      method: 'POST',
      body: { url: form.value.url }
    })
    
    if (response.success && response.data) {
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

// ───── PDF Extraction ─────
function onPdfSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && file.type === 'application/pdf') {
    pdfFile.value = file
  }
}

function clearPdf() {
  pdfFile.value = null
  if (pdfInputRef.value) {
    pdfInputRef.value.value = ''
  }
}

async function extractPdf() {
  if (!pdfFile.value) return
  
  isExtractingPdf.value = true
  try {
    const formData = new FormData()
    formData.append('file', pdfFile.value)

    const response = await $fetch<{ success: boolean, data: { title: string, content: string, pageCount: number, wordCount: number } }>('/api/tools/extract-pdf', {
      method: 'POST',
      body: formData
    })

    if (response.success && response.data) {
      // Preencher título se estiver vazio
      if (!form.value.title || form.value.title.length < 3) {
        form.value.title = response.data.title
      }

      // Preencher conteúdo
      form.value.content = response.data.content

      console.log(`[DossierSources] ✅ PDF convertido: ${response.data.pageCount} páginas, ${response.data.wordCount.toLocaleString()} palavras`)
    }
  } catch (error: any) {
    console.error('Erro ao converter PDF:', error)
    alert(error.data?.message || 'Não foi possível converter o PDF. Verifique se o arquivo contém texto selecionável.')
  } finally {
    isExtractingPdf.value = false
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
  clearPdf()
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
