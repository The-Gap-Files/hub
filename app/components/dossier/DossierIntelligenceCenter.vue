<template>
  <div class="nic-container">
    <!-- Header -->
    <header class="nic-header">
      <div class="flex items-center gap-3">
        <div class="nic-logo-icon">
          <Brain :size="18" />
        </div>
        <div>
          <h2 class="text-sm font-bold text-white">Centro de Inteligência</h2>
          <p class="text-xs text-zinc-500 mt-0.5">Pessoas, insights e dados extraídos do dossiê</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <!-- Stats compact -->
        <div class="hidden md:flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-bold font-mono text-white">{{ personsCount }}</span>
            <span class="text-xs text-zinc-500">pessoas</span>
          </div>
          <div class="w-px h-3 bg-white/8"></div>
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-bold font-mono text-white">{{ totalNotesCount }}</span>
            <span class="text-xs text-zinc-500">notas</span>
          </div>
        </div>
        <!-- Análise Neural Button + Popover -->
        <div class="relative">
          <button 
            @click="handleAnalysisClick"
            :disabled="isAnalyzing"
            class="nic-analyze-btn"
            :class="isAnalyzing ? 'nic-analyze-btn--active' : ''"
          >
            <Loader2 v-if="isAnalyzing" :size="13" class="animate-spin" />
            <Sparkles v-else :size="13" />
            <span>{{ isAnalyzing ? 'Analisando...' : 'Análise Neural' }}</span>
          </button>

          <!-- Popover de escolha -->
          <Transition name="popover">
            <div v-if="showAnalysisMenu" class="nic-analysis-popover">
              <div class="nic-popover-header">
                <Brain :size="13" class="text-amber-500" />
                <span>Como deseja analisar?</span>
                <button @click="showAnalysisMenu = false" class="nic-popover-close">
                  <X :size="12" />
                </button>
              </div>
              <div class="nic-popover-options">
                <button @click="runAnalysis(true)" class="nic-popover-option nic-popover-option--reset">
                  <div class="nic-popover-option-icon reset-icon">
                    <RotateCcw :size="14" />
                  </div>
                  <div class="nic-popover-option-text">
                    <strong>Refazer tudo</strong>
                    <span>Apaga todas as notas e pessoas existentes e refaz do zero</span>
                  </div>
                </button>
                <button @click="runAnalysis(false)" class="nic-popover-option nic-popover-option--add">
                  <div class="nic-popover-option-icon add-icon">
                    <Plus :size="14" />
                  </div>
                  <div class="nic-popover-option-text">
                    <strong>Adicionar novas</strong>
                    <span>Mantém dados existentes e adiciona novas informações</span>
                  </div>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Banner de resultado -->
    <div v-if="analysisResult" class="nic-analysis-banner">
      <span class="text-xs font-mono font-bold text-amber-400/80">
        <template v-if="analysisResult.cleared">🗑️ Limpo e recriado: </template>
        +{{ analysisResult.notesCount }} notas +{{ analysisResult.personsCount }} pessoas via {{ analysisResult.provider }}
      </span>
      <button @click="analysisResult = null" class="text-zinc-600 hover:text-zinc-400 transition-colors">
        <X :size="14" />
      </button>
    </div>

    <!-- Split Layout: Sections (left) + Query Terminal (right) -->
    <div class="nic-split">
      <!-- Left: Accordion Sections -->
      <div class="nic-left">
        <!-- Pessoas-Chave -->
        <section class="nic-section">
          <div class="nic-section-header" @click="toggleSection('persons')">
            <div class="nic-section-icon persons-icon">
              <Users :size="14" />
            </div>
            <h3 class="nic-section-title flex-1">Pessoas-Chave</h3>
            <span class="nic-badge">{{ persons.length }}</span>
            <component :is="activeSection === 'persons' ? ChevronUp : ChevronDown" :size="14" class="text-zinc-600 ml-1" />
          </div>

          <div v-show="activeSection === 'persons'" class="nic-section-body">
            <div v-if="persons.length > 0" class="nic-cards-grid">
              <div 
                v-for="person in persons" 
                :key="person.id"
                class="nic-card person-card group cursor-pointer"
                :class="{ 'nic-card--expanded': expandedPerson === person.id }"
                @click="togglePerson(person.id)"
              >
                <div v-if="person.relevance === 'primary'" class="nic-person-glow" />
                <div class="nic-card-header">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="nic-person-avatar" :class="`nic-person-avatar--${person.relevance}`">
                      <User :size="12" />
                    </div>
                    <h4 class="text-xs font-semibold text-white truncate">{{ person.name }}</h4>
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span v-if="person.role" class="nic-person-role">{{ person.role }}</span>
                    <span class="nic-relevance-badge" :class="`nic-relevance--${person.relevance}`">{{ person.relevance }}</span>
                    <button @click.stop="deletePerson(person.id)" class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 transition-all">
                      <Trash2 :size="12" />
                    </button>
                  </div>
                </div>

                <p v-if="person.description" class="text-xs text-zinc-500 leading-relaxed mt-1">{{ person.description }}</p>

                <div v-if="person.aliases?.length" class="flex flex-wrap gap-1 mt-2">
                  <span v-for="alias in person.aliases" :key="alias" class="nic-tag person-tag">{{ alias }}</span>
                </div>

                <Transition name="expand">
                  <div v-if="expandedPerson === person.id && person.visualDescription" class="mt-2 pt-2 border-t border-white/5" @click.stop>
                    <span class="text-xs text-zinc-500 font-medium flex items-center gap-1 mb-1">
                      <Eye :size="10" />
                      Descrição Visual (IA)
                    </span>
                    <p class="text-xs text-zinc-400 italic leading-relaxed">{{ person.visualDescription }}</p>
                  </div>
                </Transition>
              </div>
            </div>
            <div v-else class="nic-empty">
              <Users :size="18" class="text-white/8" />
              <p>Nenhuma pessoa extraída. Execute a <strong class="text-zinc-400">Análise Neural</strong> para identificar personagens.</p>
            </div>
          </div>
        </section>

        <!-- Insights Neurais -->
        <section class="nic-section">
          <div class="nic-section-header" @click="toggleSection('insights')">
            <div class="nic-section-icon insights-icon">
              <Lightbulb :size="14" />
            </div>
            <h3 class="nic-section-title flex-1">Insights</h3>
            <span class="nic-badge">{{ insightNotes.length }}</span>
            <component :is="activeSection === 'insights' ? ChevronUp : ChevronDown" :size="14" class="text-zinc-600 ml-1" />
          </div>

          <div v-show="activeSection === 'insights'" class="nic-section-body">
            <div v-if="insightNotes.length > 0" class="nic-notes-list">
              <div v-for="note in displayedInsights" :key="note.id" class="nic-note-item group insight-note">
                <p class="nic-note-content">{{ note.content }}</p>
                <div class="nic-note-footer">
                  <span class="nic-note-date">{{ formatDate(note.createdAt) }}</span>
                  <button @click="deleteNote(note.id)" class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 transition-all">
                    <Trash2 :size="11" />
                  </button>
                </div>
              </div>
              <button v-if="insightNotes.length > maxDisplayed" @click="maxDisplayed += 20" class="text-xs text-primary hover:text-primary/80 font-medium mt-2 transition-colors">
                Mostrar mais ({{ insightNotes.length - maxDisplayed }} restantes)
              </button>
            </div>
            <div v-else class="nic-empty">
              <Lightbulb :size="18" class="text-white/8" />
              <p>Nenhum insight registrado.</p>
            </div>
          </div>
        </section>

        <!-- Curiosidades -->
        <section class="nic-section">
          <div class="nic-section-header" @click="toggleSection('curiosities')">
            <div class="nic-section-icon curiosity-icon">
              <Search :size="14" />
            </div>
            <h3 class="nic-section-title flex-1">Curiosidades</h3>
            <span class="nic-badge">{{ curiosityNotes.length }}</span>
            <component :is="activeSection === 'curiosities' ? ChevronUp : ChevronDown" :size="14" class="text-zinc-600 ml-1" />
          </div>

          <div v-show="activeSection === 'curiosities'" class="nic-section-body">
            <div v-if="curiosityNotes.length > 0" class="nic-notes-list">
              <div v-for="note in curiosityNotes.slice(0, maxDisplayed)" :key="note.id" class="nic-note-item group curiosity-note">
                <p class="nic-note-content">{{ note.content }}</p>
                <div class="nic-note-footer">
                  <span class="nic-note-date">{{ formatDate(note.createdAt) }}</span>
                  <button @click="deleteNote(note.id)" class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 transition-all">
                    <Trash2 :size="11" />
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="nic-empty">
              <Search :size="18" class="text-white/8" />
              <p>Nenhuma curiosidade registrada.</p>
            </div>
          </div>
        </section>

        <!-- Dados de Pesquisa -->
        <section class="nic-section">
          <div class="nic-section-header" @click="toggleSection('research')">
            <div class="nic-section-icon research-icon">
              <Database :size="14" />
            </div>
            <h3 class="nic-section-title flex-1">Dados de Pesquisa</h3>
            <span class="nic-badge">{{ researchNotes.length }}</span>
            <component :is="activeSection === 'research' ? ChevronUp : ChevronDown" :size="14" class="text-zinc-600 ml-1" />
          </div>

          <div v-show="activeSection === 'research'" class="nic-section-body">
            <div v-if="researchNotes.length > 0" class="nic-notes-list">
              <div v-for="note in researchNotes.slice(0, maxDisplayed)" :key="note.id" class="nic-note-item group research-note">
                <p class="nic-note-content">{{ note.content }}</p>
                <div class="nic-note-footer">
                  <span class="nic-note-date">{{ formatDate(note.createdAt) }}</span>
                  <button @click="deleteNote(note.id)" class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 transition-all">
                    <Trash2 :size="11" />
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="nic-empty">
              <Database :size="18" class="text-white/8" />
              <p>Nenhum dado de pesquisa registrado.</p>
            </div>
          </div>
        </section>
      </div>

      <!-- Right: Query Terminal (always visible) -->
      <div class="nic-right">
        <div class="nic-query-terminal">
          <div class="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <Terminal :size="13" class="text-emerald-500" />
            <span class="text-xs font-bold text-zinc-400">Consulta de Inteligência</span>
          </div>
          <div class="nic-query-input-row">
            <div class="nic-query-prompt">›</div>
            <input 
              v-model="queryText"
              type="text"
              placeholder="Pergunte sobre o dossiê..."
              class="nic-query-input"
              @keydown.enter="submitQuery('both')"
              :disabled="isQuerying"
            />
          </div>
          <div class="nic-query-actions">
            <button 
              @click="submitQuery('docs')" 
              :disabled="!queryText.trim() || isQuerying"
              class="nic-query-btn nic-query-btn--docs"
            >
              <FileText :size="11" />
              <span>Docs</span>
            </button>
            <button 
              @click="submitQuery('web')" 
              :disabled="!queryText.trim() || isQuerying"
              class="nic-query-btn nic-query-btn--web"
            >
              <Globe :size="11" />
              <span>Web</span>
            </button>
            <button 
              @click="submitQuery('both')" 
              :disabled="!queryText.trim() || isQuerying"
              class="nic-query-btn nic-query-btn--both"
            >
              <Layers :size="11" />
              <span>Docs + Web</span>
            </button>
          </div>

          <!-- Query Result -->
          <div v-if="isQuerying" class="nic-query-result nic-query-loading">
            <Loader2 :size="14" class="animate-spin text-amber-500/60" />
            <span class="text-xs font-mono text-amber-500/60">Processando...</span>
          </div>

          <div v-else-if="queryResult" class="nic-query-result">
            <div class="mb-2">
              <span class="inline-flex items-center gap-1 text-xs font-mono font-bold text-zinc-500 px-1.5 py-0.5 rounded bg-white/5">
              <component :is="queryResult.source === 'docs' ? FileText : queryResult.source === 'web' ? Globe : Layers" :size="9" />
                {{ queryResult.source === 'docs' ? 'Documento' : queryResult.source === 'web' ? 'Web' : 'Docs + Web' }}
              </span>
            </div>
            <p class="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{{ queryResult.content }}</p>
            <div class="flex gap-2 mt-3 pt-3 border-t border-white/5">
              <button @click="saveQueryResult" class="nic-query-save-btn" :disabled="savingQuery">
                <BookmarkPlus :size="11" />
                <span>{{ savingQuery ? 'Salvando...' : 'Salvar' }}</span>
              </button>
              <button @click="queryResult = null" class="nic-query-discard-btn">
                <X :size="11" />
                <span>Descartar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  Brain, Users, User, Lightbulb, Search, Database, Terminal,
  ChevronUp, ChevronDown, Sparkles, Loader2, X, Trash2,
  Eye, FileText, Globe, BookmarkPlus, RotateCcw, Plus, Layers
} from 'lucide-vue-next'

const props = defineProps<{
  dossierId: string
  initialNotes: any[]
  initialPersons: any[]
}>()

const emit = defineEmits(['updated'])

// State
const notes = ref([...props.initialNotes])
const persons = ref([...props.initialPersons])
const isAnalyzing = ref(false)
const analysisResult = ref<{ notesCount: number; personsCount: number; provider: string; cleared: boolean } | null>(null)
const expandedPerson = ref<string | null>(null)
const maxDisplayed = ref(20)

// Exclusive accordion: only one section open at a time
const activeSection = ref<'persons' | 'insights' | 'curiosities' | 'research' | null>('persons')

// Query terminal
const queryText = ref('')
const isQuerying = ref(false)
const savingQuery = ref(false)
const queryResult = ref<{ content: string; source: 'docs' | 'web' | 'both'; noteType: string } | null>(null)

// Computed
const insightNotes = computed(() => notes.value.filter(n => n.noteType === 'insight'))
const curiosityNotes = computed(() => notes.value.filter(n => n.noteType === 'curiosity'))
const researchNotes = computed(() => notes.value.filter(n => n.noteType === 'research'))
const displayedInsights = computed(() => insightNotes.value.slice(0, maxDisplayed.value))

const personsCount = computed(() => persons.value.length)
const totalNotesCount = computed(() => notes.value.length)

// Exclusive accordion toggle
function toggleSection(section: typeof activeSection.value) {
  activeSection.value = activeSection.value === section ? null : section
}

function togglePerson(id: string) {
  expandedPerson.value = expandedPerson.value === id ? null : id
}

// Popover de análise
const showAnalysisMenu = ref(false)

function handleAnalysisClick() {
  // Se já existem dados, mostrar menu de escolha
  const hasExistingData = notes.value.length > 0 || persons.value.length > 0
  if (hasExistingData) {
    showAnalysisMenu.value = !showAnalysisMenu.value
  } else {
    // Sem dados existentes, executa direto (modo adicionar)
    runAnalysis(false)
  }
}

// Analysis
async function runAnalysis(clearExisting: boolean) {
  showAnalysisMenu.value = false
  isAnalyzing.value = true
  analysisResult.value = null
  try {
    const data = await $fetch<{
      success: boolean
      notes: any[]
      persons: any[]
      count: number
      personsCount: number
      cleared: boolean
      provider: string
      model: string
    }>(`/api/dossiers/${props.dossierId}/analyze-insights`, {
      method: 'POST',
      body: { clearExisting }
    })
    if (data.success) {
      if (data.cleared) {
        // Se limpou, substituir tudo
        notes.value = [...data.notes]
        persons.value = [...data.persons]
      } else {
        // Se adicionou, inserir no início
        if (data.notes.length > 0) notes.value.unshift(...data.notes)
        if (data.persons.length > 0) persons.value.unshift(...data.persons)
      }
      analysisResult.value = {
        notesCount: data.count,
        personsCount: data.personsCount,
        provider: `${data.provider} (${data.model})`,
        cleared: data.cleared
      }
      emit('updated')
    }
  } catch (error: any) {
    console.error('Erro na análise neural:', error)
    alert(error.data?.message || 'Erro ao executar análise neural.')
  } finally {
    isAnalyzing.value = false
  }
}

// CRUD
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

async function deletePerson(id: string) {
  if (!confirm('Remover esta pessoa do dossiê?')) return
  try {
    await $fetch(`/api/persons/${id}`, { method: 'DELETE' })
    persons.value = persons.value.filter(p => p.id !== id)
    emit('updated')
  } catch (error) {
    console.error('Erro ao deletar pessoa:', error)
  }
}

// Intelligence Query
async function submitQuery(source: 'docs' | 'web' | 'both') {
  if (!queryText.value.trim()) return
  isQuerying.value = true
  queryResult.value = null
  try {
    const data = await $fetch<{ content: string; noteType: string }>(`/api/dossiers/${props.dossierId}/intelligence-query`, {
      method: 'POST',
      body: { query: queryText.value, source }
    })
    queryResult.value = { content: data.content, source, noteType: data.noteType || 'research' }
  } catch (error: any) {
    console.error('Erro na consulta:', error)
    alert(error.data?.message || 'Erro ao processar consulta.')
  } finally {
    isQuerying.value = false
  }
}

async function saveQueryResult() {
  if (!queryResult.value) return
  savingQuery.value = true
  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/notes`, {
      method: 'POST',
      body: { content: queryResult.value.content, noteType: queryResult.value.noteType }
    })
    notes.value.unshift(data)
    queryResult.value = null
    queryText.value = ''
    emit('updated')
  } catch (error) {
    console.error('Erro ao salvar resultado:', error)
  } finally {
    savingQuery.value = false
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

watch(() => props.initialNotes, (newVal) => { notes.value = [...newVal] })
watch(() => props.initialPersons, (newVal) => { persons.value = [...newVal] })
</script>

<style scoped>
.nic-container {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  overflow: hidden;
}

/* Header */
.nic-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid hsl(var(--border));
  flex-wrap: wrap;
  gap: 0.75rem;
}

.nic-logo-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.nic-analyze-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(250, 84, 1, 0.06);
  border: 1px solid rgba(250, 84, 1, 0.2);
  color: rgba(250, 84, 1, 0.8);
  transition: all 200ms ease;
  cursor: pointer;
}

.nic-analyze-btn:hover:not(:disabled) {
  background: rgba(250, 84, 1, 0.12);
  border-color: rgba(250, 84, 1, 0.35);
  color: #FA5401;
}

.nic-analyze-btn--active { cursor: wait; }
.nic-analyze-btn:disabled { pointer-events: none; }

/* Analysis Banner */
.nic-analysis-banner {
  padding: 0.5rem 1.25rem;
  background: rgba(245, 158, 11, 0.04);
  border-bottom: 1px solid rgba(245, 158, 11, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Split Layout */
.nic-split {
  display: grid;
  grid-template-columns: 1fr;
  min-height: 400px;
}

@media (min-width: 1024px) {
  .nic-split {
    grid-template-columns: 7fr 5fr;
  }
}

.nic-left {
  border-right: 1px solid hsl(var(--border) / 0.5);
  overflow-y: auto;
  max-height: 70vh;
}

.nic-right {
  display: flex;
  flex-direction: column;
}

/* Sections */
.nic-section {
  border-bottom: 1px solid hsl(var(--border) / 0.4);
}

.nic-section:last-child { border-bottom: none; }

.nic-section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  cursor: pointer;
  transition: background 150ms ease;
}

.nic-section-header:hover {
  background: hsl(var(--muted) / 0.25);
}

.nic-section-body {
  padding: 0 1.25rem 1rem;
  animation: sectionSlideIn 200ms ease;
}

@keyframes sectionSlideIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.nic-section-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  flex-shrink: 0;
}

.persons-icon { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.insights-icon { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.curiosity-icon { background: rgba(168, 85, 247, 0.12); color: #a855f7; }
.research-icon { background: rgba(6, 182, 212, 0.12); color: #06b6d4; }

.nic-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.nic-badge {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.nic-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 0;
  text-align: center;
}

.nic-empty p {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
}

/* Cards Grid */
.nic-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.5rem;
}

.nic-card {
  background: hsl(240 10% 5.5%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  padding: 0.75rem 1rem;
  transition: all 200ms ease;
  position: relative;
  overflow: hidden;
}

.nic-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  opacity: 0;
  transition: opacity 200ms ease;
}

.person-card::before { background: linear-gradient(90deg, #f59e0b, #ea580c); }
.nic-card:hover { border-color: hsl(var(--border) / 0.8); background: hsl(240 10% 6.5%); }
.nic-card:hover::before { opacity: 1; }
.nic-card--expanded::before { opacity: 1; }

.nic-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.nic-person-glow {
  position: absolute;
  top: -20px; right: -20px;
  width: 60px; height: 60px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.06), transparent 70%);
  pointer-events: none;
}

.nic-person-avatar {
  width: 24px; height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  flex-shrink: 0;
}

.nic-person-avatar--primary { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.nic-person-avatar--secondary { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.nic-person-avatar--mentioned { background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); }

.nic-person-role {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.06);
  color: rgba(245, 158, 11, 0.6);
  border: 1px solid rgba(245, 158, 11, 0.1);
  white-space: nowrap;
}

.nic-relevance-badge {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.nic-relevance--primary { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.15); }
.nic-relevance--secondary { background: rgba(59, 130, 246, 0.08); color: rgba(59, 130, 246, 0.6); border: 1px solid rgba(59, 130, 246, 0.12); }
.nic-relevance--mentioned { background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.25); border: 1px solid rgba(255, 255, 255, 0.06); }

.nic-tag {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  padding: 0 5px;
  border-radius: 3px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.person-tag {
  background: rgba(245, 158, 11, 0.05);
  color: rgba(245, 158, 11, 0.45);
  border: 1px solid rgba(245, 158, 11, 0.06);
}

/* Notes List */
.nic-notes-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.nic-note-item {
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid hsl(var(--border) / 0.4);
  transition: all 200ms ease;
  position: relative;
}

.nic-note-item::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  border-radius: 2px 0 0 2px;
}

.insight-note { background: rgba(59, 130, 246, 0.02); }
.insight-note::before { background: #3b82f6; }
.insight-note:hover { border-color: rgba(59, 130, 246, 0.15); }

.curiosity-note { background: rgba(168, 85, 247, 0.02); }
.curiosity-note::before { background: #a855f7; }
.curiosity-note:hover { border-color: rgba(168, 85, 247, 0.15); }

.research-note { background: rgba(6, 182, 212, 0.02); }
.research-note::before { background: #06b6d4; }
.research-note:hover { border-color: rgba(6, 182, 212, 0.15); }

.nic-note-content {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.55;
  transition: color 200ms ease;
}

.nic-note-item:hover .nic-note-content { color: hsl(var(--foreground)); }

.nic-note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.375rem;
}

.nic-note-date {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground) / 0.4);
}

/* Query Terminal */
.nic-query-terminal {
  background: hsl(240 10% 3.5%);
  flex: 1;
  display: flex;
  flex-direction: column;
}

.nic-query-input-row {
  display: flex;
  align-items: center;
  padding: 0 1rem;
  border-bottom: 1px solid hsl(var(--border) / 0.4);
}

.nic-query-prompt {
  font-family: 'Fira Code', monospace;
  font-size: 1rem;
  font-weight: 700;
  color: #10b981;
  margin-right: 0.5rem;
  flex-shrink: 0;
}

.nic-query-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 0.75rem 0;
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  color: hsl(var(--foreground));
}

.nic-query-input::placeholder { color: hsl(var(--muted-foreground) / 0.3); }

.nic-query-actions {
  display: flex;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
}

.nic-query-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 6px;
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 200ms ease;
  cursor: pointer;
}

.nic-query-btn:disabled { opacity: 0.3; pointer-events: none; }

.nic-query-btn--docs {
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.12);
  color: rgba(59, 130, 246, 0.6);
}

.nic-query-btn--docs:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.25);
  color: #3b82f6;
}

.nic-query-btn--web {
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.12);
  color: rgba(16, 185, 129, 0.6);
}

.nic-query-btn--web:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.25);
  color: #10b981;
}

.nic-query-btn--both {
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.12);
  color: rgba(245, 158, 11, 0.6);
}

.nic-query-btn--both:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.25);
  color: #f59e0b;
}

/* Query Result */
.nic-query-result {
  margin: 0 0.75rem 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.nic-query-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  padding: 1.25rem;
}

.nic-query-save-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
  color: #10b981;
  transition: all 200ms ease;
  cursor: pointer;
}

.nic-query-save-btn:hover:not(:disabled) { background: rgba(16, 185, 129, 0.12); }
.nic-query-save-btn:disabled { opacity: 0.5; pointer-events: none; }

.nic-query-discard-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  transition: all 200ms ease;
  cursor: pointer;
}

.nic-query-discard-btn:hover {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

/* Transitions */
.expand-enter-active, .expand-leave-active { transition: all 200ms ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
.expand-enter-to, .expand-leave-from { opacity: 1; max-height: 200px; }

/* Analysis Popover */
.nic-analysis-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  background: hsl(240 10% 7%);
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03);
  z-index: 50;
}

.nic-popover-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.nic-popover-close {
  margin-left: auto;
  color: hsl(var(--muted-foreground) / 0.4);
  cursor: pointer;
  transition: color 150ms ease;
}

.nic-popover-close:hover { color: hsl(var(--foreground)); }

.nic-popover-options {
  display: flex;
  flex-direction: column;
  padding: 6px;
  gap: 4px;
}

.nic-popover-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 200ms ease;
}

.nic-popover-option:hover {
  background: hsl(var(--muted) / 0.4);
}

.nic-popover-option--reset:hover {
  border-color: rgba(239, 68, 68, 0.15);
  background: rgba(239, 68, 68, 0.04);
}

.nic-popover-option--add:hover {
  border-color: rgba(16, 185, 129, 0.15);
  background: rgba(16, 185, 129, 0.04);
}

.nic-popover-option-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  flex-shrink: 0;
  margin-top: 1px;
}

.reset-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.add-icon {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.nic-popover-option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nic-popover-option-text strong {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.nic-popover-option-text span {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
}

/* Popover transition */
.popover-enter-active { transition: all 200ms ease; }
.popover-leave-active { transition: all 150ms ease; }
.popover-enter-from { opacity: 0; transform: translateY(-6px) scale(0.96); }
.popover-enter-to { opacity: 1; transform: translateY(0) scale(1); }
.popover-leave-from { opacity: 1; transform: translateY(0) scale(1); }
.popover-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
</style>
