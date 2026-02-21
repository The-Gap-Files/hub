<template>
  <div class="nic-container">
    <!-- Scanline backdrop -->
    <div class="nic-scanline" />

    <!-- Header -->
    <header class="nic-header">
      <div class="flex items-center gap-3">
        <div class="nic-logo-icon">
          <Brain :size="20" />
          <div class="nic-logo-pulse" />
        </div>
        <div>
          <h2 class="text-sm font-bold text-white tracking-wide">Centro de Inteligência</h2>
          <p class="text-xs text-zinc-500 mt-0.5 font-mono">NEURAL ANALYSIS ENGINE v3</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <!-- Stats -->
        <div class="hidden md:flex items-center gap-3">
          <div class="nic-stat">
            <Users :size="11" class="text-amber-500/60" />
            <span class="nic-stat-value">{{ personsCount }}</span>
            <span class="nic-stat-label">pessoas</span>
          </div>
          <div class="nic-stat-divider" />
          <div class="nic-stat">
            <FileText :size="11" class="text-blue-500/60" />
            <span class="nic-stat-value">{{ totalNotesCount }}</span>
            <span class="nic-stat-label">notas</span>
          </div>
        </div>
        <!-- Análise Neural -->
        <div class="relative" ref="analysisMenuRef">
          <button @click="handleAnalysisClick" :disabled="isAnalyzing" class="nic-analyze-btn" :class="isAnalyzing ? 'nic-analyze-btn--active' : ''">
            <Loader2 v-if="isAnalyzing" :size="13" class="animate-spin" />
            <Sparkles v-else :size="13" />
            <span>{{ isAnalyzing ? 'Analisando...' : 'Análise Neural' }}</span>
          </button>
          <Transition name="popover">
            <div v-if="showAnalysisMenu" class="nic-analysis-popover">
              <div class="nic-popover-header">
                <Brain :size="13" class="text-amber-500" />
                <span>Como deseja analisar?</span>
                <button @click="showAnalysisMenu = false" class="nic-popover-close"><X :size="12" /></button>
              </div>
              <div class="nic-popover-options">
                <button @click="runAnalysis(true)" class="nic-popover-option nic-popover-option--reset">
                  <div class="nic-popover-option-icon reset-icon"><RotateCcw :size="14" /></div>
                  <div class="nic-popover-option-text">
                    <strong>Refazer tudo</strong>
                    <span>Apaga todas as notas e pessoas existentes e refaz do zero</span>
                  </div>
                </button>
                <button @click="runAnalysis(false)" class="nic-popover-option nic-popover-option--add">
                  <div class="nic-popover-option-icon add-icon"><Plus :size="14" /></div>
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
    <Transition name="banner">
      <div v-if="analysisResult" class="nic-analysis-banner">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span class="text-xs font-mono font-bold text-amber-400/80">
            <template v-if="analysisResult.cleared">Limpo e recriado: </template>
            +{{ analysisResult.notesCount }} notas +{{ analysisResult.personsCount }} pessoas via {{ analysisResult.provider }}
          </span>
        </div>
        <button @click="analysisResult = null" class="text-zinc-600 hover:text-zinc-400 transition-colors"><X :size="14" /></button>
      </div>
    </Transition>

    <!-- Sub-navigation -->
    <div class="nic-subnav">
      <button v-for="tab in sectionTabs" :key="tab.id" @click="activeSection = tab.id" class="nic-subnav-btn" :class="{ 'nic-subnav-btn--active': activeSection === tab.id }">
        <component :is="tab.icon" :size="14" />
        <span>{{ tab.name }}</span>
        <span class="nic-subnav-count" :class="tab.countClass">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Split Layout -->
    <div class="nic-split">
      <!-- Left: Content -->
      <div class="nic-left">
        <!-- Pessoas-Chave -->
        <div v-if="activeSection === 'persons'" class="nic-section-body">
          <div v-if="persons.length > 0" class="nic-cards-grid">
            <div v-for="(person, idx) in persons" :key="person.id" class="nic-card person-card group cursor-pointer" :class="{ 'nic-card--expanded': expandedPerson === person.id }" :style="{ animationDelay: `${idx * 40}ms` }" @click="togglePerson(person.id)">
              <div v-if="person.relevance === 'primary'" class="nic-person-glow" />
              <!-- Row 1: Avatar + Name + Delete -->
              <div class="flex items-center gap-2.5 mb-1.5">
                <div class="nic-person-avatar" :class="`nic-person-avatar--${person.relevance}`">
                  {{ getInitials(person.name) }}
                </div>
                <h4 class="text-sm font-bold text-white truncate flex-1 min-w-0">{{ person.name }}</h4>
                <button @click.stop="deletePerson(person.id)" class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 transition-all flex-shrink-0"><Trash2 :size="12" /></button>
              </div>
              <!-- Row 2: Badges (wrap) -->
              <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span v-if="person.role" class="nic-person-role">{{ person.role }}</span>
                <span class="nic-relevance-badge" :class="`nic-relevance--${person.relevance}`">{{ person.relevance }}</span>
              </div>
              <!-- Row 3: Description -->
              <p v-if="person.description" class="text-xs text-zinc-500 leading-relaxed" :class="expandedPerson !== person.id ? 'line-clamp-2' : ''">{{ person.description }}</p>

              <div v-if="person.aliases?.length" class="flex flex-wrap gap-1 mt-2.5">
                <span v-for="alias in person.aliases" :key="alias" class="nic-tag person-tag">{{ alias }}</span>
              </div>

              <!-- Reference Image / Generate Button -->
              <div class="nic-person-ref-section" @click.stop>
                <div v-if="person.hasReferenceImage" class="nic-person-ref-preview">
                  <img :src="`/api/persons/${person.id}/image?t=${person._imageTs || ''}`" alt="Referência" class="nic-ref-thumb" />
                  <button @click.stop="generatePersonImage(person)" :disabled="generatingPersonId === person.id" class="nic-ref-regen-btn" title="Regenerar imagem">
                    <Loader2 v-if="generatingPersonId === person.id" :size="11" class="animate-spin" />
                    <RotateCcw v-else :size="11" />
                  </button>
                </div>
                <button v-else-if="person.visualDescription" @click.stop="generatePersonImage(person)" :disabled="generatingPersonId === person.id" class="nic-generate-person-btn">
                  <Loader2 v-if="generatingPersonId === person.id" :size="12" class="animate-spin" />
                  <ImageIcon v-else :size="12" />
                  <span>{{ generatingPersonId === person.id ? 'Gerando...' : 'Gerar Pessoa' }}</span>
                </button>
              </div>

              <Transition name="expand">
                <div v-if="expandedPerson === person.id && person.visualDescription" class="nic-visual-desc" @click.stop>
                  <span class="text-xs text-zinc-500 font-mono uppercase tracking-wider flex items-center gap-1 mb-1.5">
                    <Eye :size="12" /> Descrição Visual (IA)
                  </span>
                  <p class="text-xs text-zinc-400 italic leading-relaxed">{{ person.visualDescription }}</p>
                </div>
              </Transition>
            </div>
          </div>
          <div v-else class="nic-empty">
            <div class="nic-empty-icon"><Users :size="22" /></div>
            <p>Nenhuma pessoa extraída.</p>
            <span>Execute a <strong class="text-amber-400">Análise Neural</strong> para identificar personagens.</span>
          </div>
        </div>

        <!-- Notes sections -->
        <div v-else-if="activeSection === 'insights'" class="nic-section-body">
          <div v-if="insightNotes.length > 0" class="nic-notes-list">
            <div v-for="(note, idx) in displayedInsights" :key="note.id" class="nic-note-item group insight-note" :style="{ animationDelay: `${idx * 30}ms` }">
              <p class="nic-note-content">{{ note.content }}</p>
              <div class="nic-note-footer">
                <span class="nic-note-date">{{ formatDate(note.createdAt) }}</span>
                <button @click="deleteNote(note.id)" class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 transition-all"><Trash2 :size="14" /></button>
              </div>
            </div>
            <button v-if="insightNotes.length > maxDisplayed" @click="maxDisplayed += 20" class="nic-show-more">
              Mostrar mais ({{ insightNotes.length - maxDisplayed }} restantes)
            </button>
          </div>
          <div v-else class="nic-empty">
            <div class="nic-empty-icon"><Lightbulb :size="22" /></div>
            <p>Nenhum insight registrado.</p>
          </div>
        </div>

        <div v-else-if="activeSection === 'curiosities'" class="nic-section-body">
          <div v-if="curiosityNotes.length > 0" class="nic-notes-list">
            <div v-for="(note, idx) in curiosityNotes.slice(0, maxDisplayed)" :key="note.id" class="nic-note-item group curiosity-note" :style="{ animationDelay: `${idx * 30}ms` }">
              <p class="nic-note-content">{{ note.content }}</p>
              <div class="nic-note-footer">
                <span class="nic-note-date">{{ formatDate(note.createdAt) }}</span>
                <button @click="deleteNote(note.id)" class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 transition-all"><Trash2 :size="11" /></button>
              </div>
            </div>
          </div>
          <div v-else class="nic-empty">
            <div class="nic-empty-icon"><Search :size="22" /></div>
            <p>Nenhuma curiosidade registrada.</p>
          </div>
        </div>

        <div v-else-if="activeSection === 'research'" class="nic-section-body">
          <div v-if="researchNotes.length > 0" class="nic-notes-list">
            <div v-for="(note, idx) in researchNotes.slice(0, maxDisplayed)" :key="note.id" class="nic-note-item group research-note" :style="{ animationDelay: `${idx * 30}ms` }">
              <p class="nic-note-content">{{ note.content }}</p>
              <div class="nic-note-footer">
                <span class="nic-note-date">{{ formatDate(note.createdAt) }}</span>
                <button @click="deleteNote(note.id)" class="opacity-0 group-hover:opacity-100 text-red-500/30 hover:text-red-500 transition-all"><Trash2 :size="11" /></button>
              </div>
            </div>
          </div>
          <div v-else class="nic-empty">
            <div class="nic-empty-icon"><Database :size="22" /></div>
            <p>Nenhum dado de pesquisa registrado.</p>
          </div>
        </div>
      </div>

      <!-- Right: Query Terminal -->
      <div class="nic-right">
        <div class="nic-query-terminal">
          <div class="nic-terminal-header">
            <div class="nic-terminal-dots">
              <span class="dot dot-red" /><span class="dot dot-yellow" /><span class="dot dot-green" />
            </div>
            <span class="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">Consulta de Inteligência</span>
          </div>
          <div class="nic-query-input-row">
            <div class="nic-query-prompt">›</div>
            <input v-model="queryText" type="text" placeholder="Pergunte sobre o dossiê..." class="nic-query-input" @keydown.enter="submitQuery('both')" :disabled="isQuerying" />
            <div v-if="!queryText" class="nic-cursor-blink" />
          </div>
          <div class="nic-query-actions">
            <button @click="submitQuery('docs')" :disabled="!queryText.trim() || isQuerying" class="nic-query-btn nic-query-btn--docs">
              <FileText :size="11" /><span>Docs</span>
            </button>
            <button @click="submitQuery('web')" :disabled="!queryText.trim() || isQuerying" class="nic-query-btn nic-query-btn--web">
              <Globe :size="11" /><span>Web</span>
            </button>
            <button @click="submitQuery('both')" :disabled="!queryText.trim() || isQuerying" class="nic-query-btn nic-query-btn--both">
              <Layers :size="11" /><span>Docs + Web</span>
            </button>
          </div>

          <!-- Query Result -->
          <div v-if="isQuerying" class="nic-query-result nic-query-loading">
            <div class="nic-loading-dots"><span /><span /><span /></div>
            <span class="text-xs font-mono text-amber-500/60">Processando consulta neural...</span>
          </div>

          <div v-else-if="queryResult" class="nic-query-result nic-query-result--filled">
            <div class="mb-2">
              <span class="nic-result-source">
                <component :is="queryResult.source === 'docs' ? FileText : queryResult.source === 'web' ? Globe : Layers" :size="9" />
                {{ queryResult.source === 'docs' ? 'Documento' : queryResult.source === 'web' ? 'Web' : 'Docs + Web' }}
              </span>
            </div>
            <p class="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{{ queryResult.content }}</p>
            <div class="flex gap-2 mt-3 pt-3 border-t border-white/5">
              <button @click="saveQueryResult" class="nic-query-save-btn" :disabled="savingQuery">
                <BookmarkPlus :size="11" />
                <span>{{ savingQuery ? 'Salvando...' : 'Salvar como nota' }}</span>
              </button>
              <button @click="queryResult = null" class="nic-query-discard-btn">
                <X :size="11" /><span>Descartar</span>
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
  Eye, FileText, Globe, BookmarkPlus, RotateCcw, Plus, Layers,
  ImageIcon
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
const generatingPersonId = ref<string | null>(null)
const maxDisplayed = ref(20)
const activeSection = ref<'persons' | 'insights' | 'curiosities' | 'research'>('persons')

// Query terminal
const queryText = ref('')
const isQuerying = ref(false)
const savingQuery = ref(false)
const queryResult = ref<{ content: string; source: 'docs' | 'web' | 'both'; noteType: string } | null>(null)

// Section tabs
const sectionTabs = computed(() => [
  { id: 'persons' as const, name: 'Pessoas-Chave', icon: Users, count: persons.value.length, countClass: 'count-amber' },
  { id: 'insights' as const, name: 'Insights', icon: Lightbulb, count: insightNotes.value.length, countClass: 'count-blue' },
  { id: 'curiosities' as const, name: 'Curiosidades', icon: Search, count: curiosityNotes.value.length, countClass: 'count-purple' },
  { id: 'research' as const, name: 'Pesquisa', icon: Database, count: researchNotes.value.length, countClass: 'count-cyan' },
])

const insightNotes = computed(() => notes.value.filter(n => n.noteType === 'insight'))
const curiosityNotes = computed(() => notes.value.filter(n => n.noteType === 'curiosity'))
const researchNotes = computed(() => notes.value.filter(n => n.noteType === 'research'))
const displayedInsights = computed(() => insightNotes.value.slice(0, maxDisplayed.value))
const personsCount = computed(() => persons.value.length)
const totalNotesCount = computed(() => notes.value.length)

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function togglePerson(id: string) {
  expandedPerson.value = expandedPerson.value === id ? null : id
}

// Popover
const showAnalysisMenu = ref(false)
const analysisMenuRef = ref<HTMLElement | null>(null)

function handleAnalysisClick() {
  const hasExistingData = notes.value.length > 0 || persons.value.length > 0
  if (hasExistingData) {
    showAnalysisMenu.value = !showAnalysisMenu.value
  } else {
    runAnalysis(false)
  }
}

// Click outside
const handleClickOutside = (event: MouseEvent) => {
  if (analysisMenuRef.value && !analysisMenuRef.value.contains(event.target as Node)) {
    showAnalysisMenu.value = false
  }
}
onMounted(() => window.addEventListener('click', handleClickOutside))
onUnmounted(() => window.removeEventListener('click', handleClickOutside))

// Analysis
async function runAnalysis(clearExisting: boolean) {
  showAnalysisMenu.value = false
  isAnalyzing.value = true
  analysisResult.value = null
  try {
    const data = await $fetch<{
      success: boolean; notes: any[]; persons: any[]; count: number; personsCount: number; cleared: boolean; provider: string; model: string
    }>(`/api/dossiers/${props.dossierId}/analyze-insights`, {
      method: 'POST', body: { clearExisting }
    })
    if (data.success) {
      if (data.cleared) {
        notes.value = [...data.notes]
        persons.value = [...data.persons]
      } else {
        if (data.notes.length > 0) notes.value.unshift(...data.notes)
        if (data.persons.length > 0) persons.value.unshift(...data.persons)
      }
      analysisResult.value = {
        notesCount: data.count, personsCount: data.personsCount,
        provider: `${data.provider} (${data.model})`, cleared: data.cleared
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

async function deleteNote(id: string) {
  if (!confirm('Eliminar este registro permanentemente?')) return
  try {
    await $fetch(`/api/notes/${id}`, { method: 'DELETE' })
    notes.value = notes.value.filter(n => n.id !== id)
    emit('updated')
  } catch (error) { console.error('Erro ao deletar nota:', error) }
}

async function deletePerson(id: string) {
  if (!confirm('Remover esta pessoa do dossiê?')) return
  try {
    await $fetch(`/api/persons/${id}`, { method: 'DELETE' })
    persons.value = persons.value.filter(p => p.id !== id)
    emit('updated')
  } catch (error) { console.error('Erro ao deletar pessoa:', error) }
}

async function submitQuery(source: 'docs' | 'web' | 'both') {
  if (!queryText.value.trim()) return
  isQuerying.value = true
  queryResult.value = null
  try {
    const data = await $fetch<{ content: string; noteType: string }>(`/api/dossiers/${props.dossierId}/intelligence-query`, {
      method: 'POST', body: { query: queryText.value, source }
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
      method: 'POST', body: { content: queryResult.value.content, noteType: queryResult.value.noteType }
    })
    notes.value.unshift(data)
    queryResult.value = null
    queryText.value = ''
    emit('updated')
  } catch (error) { console.error('Erro ao salvar resultado:', error) }
  finally { savingQuery.value = false }
}

async function generatePersonImage(person: any) {
  generatingPersonId.value = person.id
  try {
    await $fetch(`/api/persons/${person.id}/generate-image`, {
      method: 'POST',
      body: { visualPrompt: person.visualDescription }
    })
    person.hasReferenceImage = true
    person._imageTs = Date.now() // bust cache on regeneration
  } catch (error: any) {
    console.error('Erro ao gerar imagem:', error)
    alert(error.data?.message || 'Erro ao gerar imagem do personagem.')
  } finally {
    generatingPersonId.value = null
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

watch(() => props.initialNotes, (newVal) => { notes.value = [...newVal] })
watch(() => props.initialPersons, (newVal) => { persons.value = [...newVal] })
</script>

<style scoped>
/* ═══════════════════════════════════════════════════
   INTELLIGENCE CENTER — UI PRO MAX V4
   ═══════════════════════════════════════════════════ */

.nic-container {
  background: linear-gradient(180deg, hsl(240 15% 5.5%) 0%, hsl(240 10% 4%) 100%);
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  overflow: hidden;
  position: relative;
}

/* Scanline effect */
.nic-scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(245, 158, 11, 0.008) 2px,
    rgba(245, 158, 11, 0.008) 4px
  );
  pointer-events: none;
  z-index: 0;
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
  position: relative;
  z-index: 20;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, transparent 60%);
}

.nic-logo-icon {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(250, 84, 1, 0.1));
  color: #f59e0b;
  position: relative;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.08);
}

.nic-logo-pulse {
  position: absolute; inset: -3px;
  border-radius: 13px;
  border: 1px solid rgba(245, 158, 11, 0.15);
  animation: logoPulse 3s ease-in-out infinite;
}

@keyframes logoPulse {
  0%, 100% { opacity: 0; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

/* Stats */
.nic-stat {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.nic-stat-value { font-family: 'Fira Code', monospace; font-size: 0.875rem; font-weight: 700; color: white; }
.nic-stat-label { font-size: 0.75rem; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.06em; }
.nic-stat-divider { width: 1px; height: 14px; background: rgba(255,255,255,0.06); }

/* Analyze button */
.nic-analyze-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: 10px;
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  background: linear-gradient(135deg, rgba(250, 84, 1, 0.08), rgba(245, 158, 11, 0.06));
  border: 1px solid rgba(250, 84, 1, 0.2);
  color: rgba(250, 84, 1, 0.85); cursor: pointer;
  transition: all 250ms cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 0 0 0 rgba(250, 84, 1, 0);
}
.nic-analyze-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(250, 84, 1, 0.15), rgba(245, 158, 11, 0.1));
  border-color: rgba(250, 84, 1, 0.4); color: #FA5401;
  box-shadow: 0 0 20px rgba(250, 84, 1, 0.1);
  transform: translateY(-1px);
}
.nic-analyze-btn--active { cursor: wait; }
.nic-analyze-btn:disabled { pointer-events: none; }

/* Analysis Banner */
.nic-analysis-banner {
  padding: 0.5rem 1.25rem;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02));
  border-bottom: 1px solid rgba(245, 158, 11, 0.08);
  display: flex; justify-content: space-between; align-items: center;
  animation: bannerSlideIn 300ms ease;
}
@keyframes bannerSlideIn { from { opacity: 0; transform: translateY(-8px); } }

/* Sub-navigation tabs */
.nic-subnav {
  display: flex; gap: 0.5rem; padding: 0.75rem 1.25rem;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  background: rgba(0,0,0,0.15);
  position: relative; z-index: 1;
  overflow-x: auto;
  flex-wrap: wrap;
}
.nic-subnav-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0.5rem 1.25rem; border-radius: 0.75rem;
  font-size: 0.75rem; font-weight: 700;
  color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
  transition: all 200ms ease;
  white-space: nowrap;
}
.nic-subnav-btn:hover {
  color: rgba(255,255,255,0.7);
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.1);
}
.nic-subnav-btn--active {
  color: black;
  background: white;
  border-color: white;
  box-shadow: 0 0 15px rgba(255,255,255,0.15);
}
.nic-subnav-count {
  font-family: 'Fira Code', monospace; font-size: 0.75rem; font-weight: 700;
  padding: 1px 6px; border-radius: 0.375rem;
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3);
}
.nic-subnav-btn--active .nic-subnav-count {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

/* Split Layout */
.nic-split {
  display: grid; grid-template-columns: 1fr; min-height: 400px; position: relative; z-index: 1;
}
@media (min-width: 1024px) { .nic-split { grid-template-columns: 7fr 5fr; } }

.nic-left {
  border-right: 1px solid hsl(var(--border) / 0.5);
  overflow-y: auto;
}
.nic-left::-webkit-scrollbar { width: 6px; }
.nic-left::-webkit-scrollbar-track { background: transparent; }
.nic-left::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.15); border-radius: 3px; }
.nic-left::-webkit-scrollbar-thumb:hover { background: rgba(245, 158, 11, 0.3); }

.nic-right { display: flex; flex-direction: column; }

.nic-section-body { padding: 1rem 1.25rem; animation: sectionIn 250ms ease; }
@keyframes sectionIn { from { opacity: 0; transform: translateY(-6px); } }

/* Cards Grid */
.nic-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.625rem; }

.nic-card {
  background: hsl(240 10% 5.5%);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px; padding: 0.875rem 1rem;
  transition: all 250ms cubic-bezier(0.22, 1, 0.36, 1);
  position: relative; overflow: hidden;
  animation: cardFadeIn 400ms ease both;
}
@keyframes cardFadeIn { from { opacity: 0; transform: translateY(8px); } }

.nic-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  opacity: 0; transition: opacity 250ms ease;
}
.person-card::before { background: linear-gradient(90deg, #f59e0b, #ea580c); }
.nic-card:hover { border-color: rgba(255,255,255,0.1); background: hsl(240 10% 7%); transform: translateY(-1px); }
.nic-card:hover::before { opacity: 1; }
.nic-card--expanded::before { opacity: 1; }

.nic-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; }

.nic-person-glow {
  position: absolute; top: -30px; right: -30px; width: 80px; height: 80px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.08), transparent 70%);
  pointer-events: none;
}

/* Person Avatar with initials */
.nic-person-avatar {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: 8px; flex-shrink: 0;
  font-size: 0.625rem; font-weight: 800; letter-spacing: 0.04em;
}
.nic-person-avatar--primary { background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(250, 84, 1, 0.15)); color: #f59e0b; box-shadow: 0 0 12px rgba(245, 158, 11, 0.1); }
.nic-person-avatar--secondary { background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.1)); color: #60a5fa; }
.nic-person-avatar--mentioned { background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); }

.nic-person-role {
  font-family: 'Fira Code', monospace; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 2px 6px; border-radius: 5px;
  background: rgba(245, 158, 11, 0.08); color: rgba(245, 158, 11, 0.65);
  border: 1px solid rgba(245, 158, 11, 0.1);
}

.nic-relevance-badge {
  font-family: 'Fira Code', monospace; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 2px 5px; border-radius: 4px; white-space: nowrap;
}
.nic-relevance--primary { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.15); }
.nic-relevance--secondary { background: rgba(59, 130, 246, 0.08); color: rgba(59, 130, 246, 0.6); border: 1px solid rgba(59, 130, 246, 0.12); }
.nic-relevance--mentioned { background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.25); border: 1px solid rgba(255, 255, 255, 0.06); }

.nic-tag { font-family: 'Fira Code', monospace; font-size: 0.75rem; padding: 1px 6px; border-radius: 4px; }
.person-tag { background: rgba(245, 158, 11, 0.05); color: rgba(245, 158, 11, 0.5); border: 1px solid rgba(245, 158, 11, 0.08); }

/* Person Reference Image */
.nic-person-ref-section { margin-top: 0.5rem; }

.nic-person-ref-preview {
  display: flex; align-items: center; gap: 0.5rem;
}
.nic-ref-thumb {
  width: 48px; height: 48px; border-radius: 8px;
  object-fit: cover;
  border: 1px solid rgba(245, 158, 11, 0.2);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.08);
}
.nic-ref-regen-btn {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; cursor: pointer;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.3); transition: all 200ms ease;
}
.nic-ref-regen-btn:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); color: #f59e0b;
}
.nic-ref-regen-btn:disabled { opacity: 0.5; cursor: wait; }

.nic-generate-person-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 7px;
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(250, 84, 1, 0.04));
  border: 1px solid rgba(245, 158, 11, 0.12);
  color: rgba(245, 158, 11, 0.6); cursor: pointer;
  transition: all 250ms cubic-bezier(0.22, 1, 0.36, 1);
}
.nic-generate-person-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(250, 84, 1, 0.08));
  border-color: rgba(245, 158, 11, 0.3); color: #f59e0b;
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.08);
}
.nic-generate-person-btn:disabled { opacity: 0.5; cursor: wait; }

.nic-visual-desc {
  margin-top: 0.625rem; padding-top: 0.625rem;
  border-top: 1px solid rgba(255,255,255,0.05);
  background: rgba(139, 92, 246, 0.02); margin: 0.625rem -1rem -0.875rem;
  padding: 0.75rem 1rem; border-radius: 0 0 12px 12px;
}

/* Notes */
.nic-notes-list { display: flex; flex-direction: column; gap: 0.5rem; }

.nic-note-item {
  padding: 0.75rem 0.875rem; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.04); position: relative;
  transition: all 250ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: cardFadeIn 400ms ease both;
}
.nic-note-item::before {
  content: ''; position: absolute; left: 0; top: 8px; bottom: 8px;
  width: 2px; border-radius: 2px;
}

.insight-note { background: rgba(59, 130, 246, 0.02); }
.insight-note::before { background: linear-gradient(180deg, #3b82f6, #6366f1); }
.insight-note:hover { border-color: rgba(59, 130, 246, 0.15); background: rgba(59, 130, 246, 0.04); box-shadow: 0 0 20px rgba(59, 130, 246, 0.04); }

.curiosity-note { background: rgba(168, 85, 247, 0.02); }
.curiosity-note::before { background: linear-gradient(180deg, #a855f7, #ec4899); }
.curiosity-note:hover { border-color: rgba(168, 85, 247, 0.15); background: rgba(168, 85, 247, 0.04); box-shadow: 0 0 20px rgba(168, 85, 247, 0.04); }

.research-note { background: rgba(6, 182, 212, 0.02); }
.research-note::before { background: linear-gradient(180deg, #06b6d4, #10b981); }
.research-note:hover { border-color: rgba(6, 182, 212, 0.15); background: rgba(6, 182, 212, 0.04); box-shadow: 0 0 20px rgba(6, 182, 212, 0.04); }

.nic-note-content { font-size: 0.75rem; color: rgba(255,255,255,0.5); line-height: 1.6; transition: color 200ms ease; }
.nic-note-item:hover .nic-note-content { color: rgba(255,255,255,0.85); }

.nic-note-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
.nic-note-date { font-family: 'Fira Code', monospace; font-size: 0.75rem; color: rgba(255,255,255,0.15); }
.nic-show-more { font-size: 0.75rem; color: rgba(245, 158, 11, 0.6); font-weight: 600; margin-top: 0.5rem; cursor: pointer; transition: color 200ms; background: none; border: none; }
.nic-show-more:hover { color: #f59e0b; }

/* Empty state */
.nic-empty { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 0; text-align: center; }
.nic-empty-icon {
  width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
  border-radius: 14px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.08); margin-bottom: 0.25rem;
}
.nic-empty p { font-size: 0.875rem; color: rgba(255,255,255,0.25); font-weight: 500; }
.nic-empty span { font-size: 0.75rem; color: rgba(255,255,255,0.15); }

/* Query Terminal */
.nic-query-terminal { background: hsl(240 12% 3%); flex: 1; display: flex; flex-direction: column; }

.nic-terminal-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
  background: rgba(0,0,0,0.3);
}
.nic-terminal-dots { display: flex; gap: 5px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot-red { background: #ff5f57; }
.dot-yellow { background: #febc2e; }
.dot-green { background: #28c840; }

.nic-query-input-row {
  display: flex; align-items: center; padding: 0 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.03); position: relative;
}
.nic-query-prompt { font-family: 'Fira Code', monospace; font-size: 1.1rem; font-weight: 700; color: #10b981; margin-right: 0.5rem; flex-shrink: 0; }
.nic-query-input {
  flex: 1; background: transparent; border: none; outline: none;
  padding: 0.875rem 0; font-family: 'Fira Code', monospace; font-size: 0.75rem; color: white;
}
.nic-query-input::placeholder { color: rgba(255,255,255,0.15); }

.nic-cursor-blink {
  width: 7px; height: 16px; background: #10b981;
  animation: cursorBlink 1s step-end infinite; border-radius: 1px;
}
@keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.nic-query-actions { display: flex; gap: 0.375rem; padding: 0.5rem 1rem; }

.nic-query-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 12px; border-radius: 7px;
  font-family: 'Fira Code', monospace; font-size: 0.75rem; font-weight: 700;
  transition: all 200ms ease; cursor: pointer;
}
.nic-query-btn:disabled { opacity: 0.25; pointer-events: none; }

.nic-query-btn--docs { background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.12); color: rgba(59, 130, 246, 0.6); }
.nic-query-btn--docs:hover:not(:disabled) { background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.3); color: #3b82f6; box-shadow: 0 0 12px rgba(59, 130, 246, 0.08); }
.nic-query-btn--web { background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.12); color: rgba(16, 185, 129, 0.6); }
.nic-query-btn--web:hover:not(:disabled) { background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.3); color: #10b981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.08); }
.nic-query-btn--both { background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.12); color: rgba(245, 158, 11, 0.6); }
.nic-query-btn--both:hover:not(:disabled) { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.3); color: #f59e0b; box-shadow: 0 0 12px rgba(245, 158, 11, 0.08); }

/* Query Result */
.nic-query-result { margin: 0 0.75rem 0.75rem; padding: 0.875rem; border-radius: 10px; }
.nic-query-result--filled { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); animation: resultFadeIn 300ms ease; }
@keyframes resultFadeIn { from { opacity: 0; transform: translateY(4px); } }

.nic-query-loading {
  display: flex; align-items: center; gap: 0.75rem;
  justify-content: center; padding: 2rem;
  background: rgba(245, 158, 11, 0.02); border: 1px solid rgba(245, 158, 11, 0.05);
}

.nic-loading-dots { display: flex; gap: 4px; }
.nic-loading-dots span {
  width: 6px; height: 6px; border-radius: 50%; background: rgba(245, 158, 11, 0.4);
  animation: dotPulse 1.4s ease-in-out infinite;
}
.nic-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.nic-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotPulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

.nic-result-source {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-family: 'Fira Code', monospace; font-weight: 700;
  color: rgba(255,255,255,0.35); padding: 2px 8px; border-radius: 4px;
  background: rgba(255,255,255,0.04); text-transform: uppercase; letter-spacing: 0.05em;
}

.nic-query-save-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 7px;
  font-size: 0.75rem; font-weight: 600;
  background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.15);
  color: #10b981; cursor: pointer; transition: all 200ms ease;
}
.nic-query-save-btn:hover:not(:disabled) { background: rgba(16, 185, 129, 0.15); box-shadow: 0 0 12px rgba(16, 185, 129, 0.1); }
.nic-query-save-btn:disabled { opacity: 0.5; pointer-events: none; }

.nic-query-discard-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 12px; border-radius: 7px;
  font-size: 0.75rem; font-weight: 600;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.4); cursor: pointer; transition: all 200ms ease;
}
.nic-query-discard-btn:hover { background: rgba(239, 68, 68, 0.06); border-color: rgba(239, 68, 68, 0.15); color: #ef4444; }

/* Transitions */
.expand-enter-active, .expand-leave-active { transition: all 250ms ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
.expand-enter-to, .expand-leave-from { opacity: 1; max-height: 200px; }

.banner-enter-active { transition: all 300ms ease; }
.banner-leave-active { transition: all 200ms ease; }
.banner-enter-from { opacity: 0; transform: translateY(-100%); }
.banner-leave-to { opacity: 0; transform: translateY(-100%); }

/* Analysis Popover */
.nic-analysis-popover {
  position: absolute; top: calc(100% + 8px); right: 0; width: 320px;
  background: hsl(240 10% 7%); border: 1px solid hsl(var(--border)); border-radius: 12px;
  overflow: hidden; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.03); z-index: 50;
}
.nic-popover-header {
  display: flex; align-items: center; gap: 6px; padding: 10px 14px;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  font-size: 0.8rem; font-weight: 600; color: white;
}
.nic-popover-close { margin-left: auto; color: rgba(255,255,255,0.2); cursor: pointer; transition: color 150ms ease; }
.nic-popover-close:hover { color: white; }
.nic-popover-options { display: flex; flex-direction: column; padding: 6px; gap: 4px; }
.nic-popover-option {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
  border-radius: 8px; border: 1px solid transparent; background: transparent;
  cursor: pointer; text-align: left; transition: all 200ms ease;
}
.nic-popover-option:hover { background: rgba(255,255,255,0.03); }
.nic-popover-option--reset:hover { border-color: rgba(239, 68, 68, 0.15); background: rgba(239, 68, 68, 0.04); }
.nic-popover-option--add:hover { border-color: rgba(16, 185, 129, 0.15); background: rgba(16, 185, 129, 0.04); }
.nic-popover-option-icon {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  border-radius: 8px; flex-shrink: 0;
}
.reset-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.add-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.nic-popover-option-text { display: flex; flex-direction: column; gap: 2px; }
.nic-popover-option-text strong { font-size: 0.875rem; font-weight: 600; color: white; }
.nic-popover-option-text span { font-size: 0.75rem; color: rgba(255,255,255,0.4); line-height: 1.4; }

/* Popover transition */
.popover-enter-active { transition: all 200ms cubic-bezier(0.22, 1, 0.36, 1); }
.popover-leave-active { transition: all 150ms ease; }
.popover-enter-from { opacity: 0; transform: translateY(-6px) scale(0.96); }
.popover-enter-to, .popover-leave-from { opacity: 1; transform: translateY(0) scale(1); }
.popover-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
</style>
