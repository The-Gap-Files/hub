<template>
  <div class="min-h-screen bg-[#0A0A0F] text-white">
    <!-- Header: voltar ao dossier -->
    <header class="sticky top-0 z-50 border-b border-white/5 bg-[#0A0A0F]/95 backdrop-blur-xl">
      <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <NuxtLink 
          :to="`/dossiers/${dossierId}`" 
          class="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors group">
          <ArrowLeft :size="20" class="group-hover:-translate-x-0.5 transition-transform" />
          <span class="text-sm font-bold uppercase tracking-wider">Voltar ao dossier</span>
        </NuxtLink>
        <div class="flex items-center gap-2 text-primary">
          <Zap :size="20" />
          <span class="mono-label text-primary font-black">Iniciar Produção</span>
        </div>
      </div>

      <!-- Stepper -->
      <div class="max-w-5xl mx-auto px-6 pb-4">
        <nav class="flex items-center gap-1 overflow-x-auto pb-2 custom-scrollbar" aria-label="Etapas">
          <button
            v-for="s in steps"
            :key="s.id"
            type="button"
            @click="goToStep(s.id)"
            class="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all shrink-0 border"
            :class="currentStep === s.id 
              ? 'bg-primary/20 border-primary/50 text-primary' 
              : stepDone(s.id) 
                ? 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white' 
                : 'bg-white/[0.02] border-white/5 text-zinc-600'">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border"
                  :class="currentStep === s.id ? 'border-primary bg-primary/30' : 'border-current'">
              {{ s.num }}
            </span>
            <span class="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{{ s.label }}</span>
          </button>
        </nav>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 py-10">
      <!-- Contexto do dossier -->
      <div v-if="dossier?.visualIdentityContext" class="mb-10 p-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-start gap-4">
        <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500 shrink-0">
          <Palette :size="20" />
        </div>
        <div class="space-y-1">
          <p class="text-[10px] font-black uppercase tracking-widest text-purple-400">Diretriz do Universo</p>
          <p class="text-sm text-purple-200/80 italic">"{{ dossier.visualIdentityContext }}"</p>
        </div>
      </div>

      <!-- Step 1: Classificação -->
      <section v-show="currentStep === 1" class="animate-in fade-in duration-200">
        <div class="mb-8">
          <h2 class="text-2xl font-black uppercase tracking-tight">Classificação (tema)</h2>
          <p class="text-zinc-500 mt-1">Define o tom e a orientação (música, visual, narrativa). Opcional.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            @click="selectedClassificationId = ''"
            class="px-6 py-4 rounded-2xl text-left transition-all border"
            :class="[selectedClassificationId === '' ? 'bg-amber-600/30 border-amber-500 text-amber-200' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20 hover:text-white']">
            <span class="font-bold uppercase tracking-widest text-sm">Nenhuma (livre)</span>
          </button>
          <button
            v-for="c in classifications"
            :key="c.id"
            @click="selectedClassificationId = c.id"
            class="px-6 py-4 rounded-2xl text-left transition-all border"
            :class="[selectedClassificationId === c.id ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20 hover:text-white']">
            <span class="font-bold uppercase tracking-widest text-sm">{{ c.label }}</span>
            <p v-if="c.description" class="text-xs font-normal normal-case opacity-80 mt-1">{{ c.description }}</p>
          </button>
        </div>
      </section>

      <!-- Step 2: Formatos -->
      <section v-show="currentStep === 2" class="animate-in fade-in duration-200">
        <div class="mb-8">
          <h2 class="text-2xl font-black uppercase tracking-tight">Dimensões & Formatos</h2>
          <p class="text-zinc-500 mt-1">Selecione pelo menos um formato para gerar.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label
            v-for="fmt in formats"
            :key="fmt.id"
            class="relative cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-300"
            :class="[selectedFormats.includes(fmt.id) ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:border-white/20']">
            <input type="checkbox" v-model="selectedFormats" :value="fmt.id" class="hidden" @change="onFormatToggle(fmt)" />
            <div class="p-6">
              <div class="flex items-start gap-4 mb-4">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center border transition-all"
                     :class="selectedFormats.includes(fmt.id) ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-white/30'">
                  <component :is="fmt.icon" :size="24" />
                </div>
                <div class="flex-1">
                  <p class="font-black text-white uppercase tracking-wider">{{ fmt.name }}</p>
                  <p class="text-xs font-mono text-zinc-500 mt-0.5">{{ fmt.details }}</p>
                </div>
              </div>
              <div v-if="selectedFormats.includes(fmt.id)" class="pt-4 border-t border-white/10">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[10px] font-bold text-zinc-500 uppercase">Duração</span>
                  <span class="text-sm font-mono text-white">{{ Math.floor((formatDurations[fmt.id] || 0) / 60) }}:{{ String((formatDurations[fmt.id] || 0) % 60).padStart(2, '0') }}</span>
                </div>
                <input
                  type="range"
                  v-model.number="formatDurations[fmt.id]"
                  min="10"
                  :max="fmt.maxDuration || 300"
                  step="5"
                  class="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary"
                />
                <button
                  v-if="formatDurations[fmt.id] !== fmt.defaultDuration"
                  type="button"
                  @click.stop="formatDurations[fmt.id] = fmt.defaultDuration"
                  class="mt-2 text-[10px] text-primary/80 hover:text-primary font-bold uppercase">
                  Padrão ({{ fmt.defaultDuration }}s)
                </button>
              </div>
            </div>
          </label>
        </div>
      </section>

      <!-- Step 3: Estilo de roteiro -->
      <section v-show="currentStep === 3" class="animate-in fade-in duration-200">
        <div class="mb-8">
          <h2 class="text-2xl font-black uppercase tracking-tight">Estilo de roteiro</h2>
          <p class="text-zinc-500 mt-1">Recomendado pela classificação quando definida.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            v-for="style in scriptStyles"
            :key="style.id"
            @click="selectedScriptStyle = style.id"
            class="px-6 py-5 rounded-2xl text-left transition-all border relative"
            :class="[selectedScriptStyle === style.id ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20 hover:text-white']">
            <span class="font-bold uppercase tracking-widest text-sm">{{ style.name }}</span>
            <span v-if="selectedClassificationId && style.id === recommendedScriptStyleId" class="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded-md border border-amber-500/30">Recomendado</span>
          </button>
        </div>
      </section>

      <!-- Step 4: Estilo visual -->
      <section v-show="currentStep === 4" class="animate-in fade-in duration-200">
        <div class="mb-8">
          <h2 class="text-2xl font-black uppercase tracking-tight">Estilo visual</h2>
          <p v-if="dossier?.preferredVisualStyleId && selectedVisualStyle !== dossier.preferredVisualStyleId" class="text-amber-500/90 text-sm mt-2 flex items-center gap-2">
            <AlertTriangle :size="14" /> Esta seleção difere do padrão visual do dossier.
          </p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            v-for="style in visualStyles"
            :key="style.id"
            @click="selectedVisualStyle = style.id"
            class="px-6 py-5 rounded-2xl text-left transition-all border relative"
            :class="[selectedVisualStyle === style.id ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.2)]' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20 hover:text-white']">
            <span class="font-bold uppercase tracking-widest text-sm">{{ style.name }}</span>
            <span v-if="style.id === dossier?.preferredVisualStyleId" class="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] bg-white/10 px-2 py-1 rounded-md">DNA</span>
            <span v-else-if="selectedClassificationId && style.id === recommendedVisualStyleId" class="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded-md border border-amber-500/30">Recomendado</span>
          </button>
        </div>
      </section>

      <!-- Step 5: Inteligência adicional -->
      <section v-show="currentStep === 5" class="animate-in fade-in duration-200 space-y-8">
        <div class="mb-8">
          <h2 class="text-2xl font-black uppercase tracking-tight">Inteligência adicional</h2>
          <p class="text-zinc-500 mt-1">Voz, velocidade, motion, objetivo editorial e DNA.</p>
        </div>

        <div v-if="!selectedVoiceId" class="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center gap-4">
          <AlertTriangle :size="20" class="text-yellow-500 shrink-0" />
          <p class="text-sm text-yellow-500/90">Selecione uma voz para continuar.</p>
        </div>

        <!-- Sugestão de narrador do canal -->
        <div v-if="channelVoiceSuggestion && !selectedVoiceId" class="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-4">
          <Mic :size="20" class="text-blue-400 shrink-0" />
          <div class="flex-1">
            <p class="text-xs text-blue-300">
              🎙️ Narrador mais usado neste canal: <strong class="text-blue-200">{{ channelVoiceSuggestion.voiceId }}</strong> 
              <span class="text-blue-400/60">({{ channelVoiceSuggestion.ttsProvider }}, {{ channelVoiceSuggestion.usageCount }}x)</span>
            </p>
          </div>
          <button @click="applyChannelVoice" class="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-bold uppercase rounded-lg transition-all shrink-0">
            Usar
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="space-y-6">
            <label class="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all">
              <span class="font-bold uppercase tracking-wider text-sm">Habilitar Motion (IA)</span>
              <input type="checkbox" v-model="enableMotion" class="rounded border-white/20 bg-white/5 text-primary focus:ring-primary" />
            </label>
            <div>
              <label class="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Velocidade da narração (WPM)</label>
              <div class="flex gap-2">
                <button v-for="wpm in [120, 150, 180]" :key="wpm"
                  @click="selectedWPM = wpm"
                  class="flex-1 py-3 rounded-xl text-xs font-bold uppercase border transition-all"
                  :class="[selectedWPM === wpm ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 hover:border-white/20']">
                  {{ wpm === 120 ? 'Lento' : wpm === 150 ? 'Normal' : 'Rápido' }} ({{ wpm }})
                </button>
              </div>
            </div>
            <VoiceSelector
              v-model="selectedVoiceId"
              :initial-voices="availableVoices"
              :initial-cursor="initialVoiceCursor"
            />
          </div>
          <div class="space-y-6">
            <div>
              <label class="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Objetivo editorial</label>
              <div class="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                <button @click="selectedObjectiveId = ''; customObjective = ''"
                  class="w-full px-4 py-3 rounded-xl text-left text-sm border transition-all"
                  :class="[!selectedObjectiveId ? 'bg-zinc-600 border-zinc-500 text-white' : 'bg-white/5 border-white/10 hover:border-white/20']">
                  Sem diretriz específica
                </button>
                <button v-for="obj in editorialObjectives" :key="obj.id"
                  @click="selectedObjectiveId = obj.id; customObjective = ''"
                  class="w-full px-4 py-3 rounded-xl text-left border transition-all"
                  :class="[selectedObjectiveId === obj.id ? 'bg-amber-600 border-amber-500 text-white' : 'bg-white/5 border-white/10 hover:border-white/20']">
                  <span class="font-bold text-xs uppercase">{{ obj.name }}</span>
                </button>
                <button @click="selectedObjectiveId = 'custom'"
                  class="w-full px-4 py-3 rounded-xl text-left border transition-all"
                  :class="[selectedObjectiveId === 'custom' ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 hover:border-white/20']">
                  Escrever meu próprio
                </button>
              </div>
              <textarea v-if="selectedObjectiveId === 'custom'" v-model="customObjective" rows="3"
                class="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none resize-none"
                placeholder="Descreva o objetivo editorial..." />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Assinatura genética (DNA)</label>
              <select v-model="selectedSeed"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500">
                <option value="" class="bg-[#0A0A0F]">Aleatória</option>
                <option v-for="seed in allSeeds" :key="seed.id" :value="seed.id" class="bg-[#0A0A0F]">
                  DNA {{ seed.value }} {{ seed.id === dossier?.preferredSeedId ? '(Padrão)' : '' }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <!-- Step 6: Resumo e criar -->
      <section v-show="currentStep === 6" class="animate-in fade-in duration-200">
        <div class="mb-8">
          <h2 class="text-2xl font-black uppercase tracking-tight">Resumo da produção</h2>
          <p class="text-zinc-500 mt-1">Revise e confirme para injetar no pipeline.</p>
        </div>
        <div class="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-6">
          <p class="text-lg">
            Serão criados <strong class="text-primary">{{ productionSummary?.n ?? 0 }}</strong> output(s) com:
          </p>
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <span class="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">{{ productionSummary?.classificationLabel ?? '—' }}</span>
            <span class="text-zinc-600">→</span>
            <span class="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300">{{ productionSummary?.scriptLabel ?? '—' }}</span>
            <span class="text-zinc-600">→</span>
            <span class="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">{{ productionSummary?.visualLabel ?? '—' }}</span>
          </div>
          <p class="text-zinc-500 text-sm">
            Formatos: {{ selectedFormats.join(', ') || '—' }} · Voz {{ selectedVoiceId ? 'definida' : 'não definida' }} · Motion {{ enableMotion ? 'on' : 'off' }}
          </p>
        </div>
      </section>

      <!-- Navegação entre etapas -->
      <div class="mt-16 pt-10 border-t border-white/10 flex flex-col sm:flex-row gap-4 justify-between">
        <button
          v-if="currentStep > 1"
          type="button"
          @click="currentStep--"
          class="btn-secondary px-8 py-4 rounded-2xl font-black uppercase tracking-wider flex items-center gap-2">
          <ArrowLeft :size="18" /> Voltar
        </button>
        <div v-else />
        <div class="flex items-center gap-4">
          <NuxtLink v-if="currentStep < 6" :to="`/dossiers/${dossierId}`" class="btn-secondary px-6 py-4 rounded-2xl font-bold uppercase text-zinc-500">
            Cancelar
          </NuxtLink>
          <button
            v-if="currentStep < 6"
            type="button"
            @click="nextStep"
            :disabled="!canProceed"
            class="btn-primary px-10 py-4 rounded-2xl font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            Próximo <ChevronRight :size="18" />
          </button>
          <button
            v-else
            type="button"
            @click="generateOutputs"
            :disabled="!canSubmit || generatingOutputs"
            class="btn-primary px-10 py-5 rounded-2xl text-lg font-black uppercase tracking-wider flex items-center gap-3 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed">
            <span v-if="!generatingOutputs">Injetar pipeline</span>
            <span v-else class="flex items-center gap-2"><span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Criando...</span>
            <ChevronRight :size="20" />
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeft, Zap, ChevronRight, Smartphone, Monitor, Instagram, Palette, AlertTriangle, Mic
} from 'lucide-vue-next'
import VoiceSelector from '~/components/dossier/VoiceSelector.vue'

const route = useRoute()
const router = useRouter()
const dossierId = route.params.id as string

const steps = [
  { id: 1, num: '01', label: 'Classificação' },
  { id: 2, num: '02', label: 'Formatos' },
  { id: 3, num: '03', label: 'Roteiro' },
  { id: 4, num: '04', label: 'Visual' },
  { id: 5, num: '05', label: 'Inteligência' },
  { id: 6, num: '06', label: 'Resumo' }
]

const currentStep = ref(1)
const dossier = ref<any>(null)
const loading = ref(true)
const selectedFormats = ref<string[]>([])
const formatDurations = ref<Record<string, number>>({})
const selectedScriptStyle = ref('')
const selectedVisualStyle = ref('')
const selectedSeed = ref('')
const selectedWPM = ref(150)
const selectedVoiceId = ref('')
const enableMotion = ref(true)
const generatingOutputs = ref(false)
const selectedObjectiveId = ref('')
const customObjective = ref('')
const editorialObjectives = ref<any[]>([])
const availableVoices = ref<any[]>([])
const initialVoiceCursor = ref<string | undefined>(undefined)
const classifications = ref<any[]>([])
const selectedClassificationId = ref<string>('')
const scriptStyles = ref<any[]>([])
const visualStyles = ref<any[]>([])
const allSeeds = ref<any[]>([])
const videoFormatsRaw = ref<any[]>([])
const channelVoiceSuggestion = ref<{ ttsProvider: string; voiceId: string; usageCount: number } | null>(null)

const formats = computed(() => {
  return videoFormatsRaw.value.map(f => {
    let icon = Monitor
    if (f.platform === 'Instagram') icon = Instagram
    else if (f.orientation === 'VERTICAL') icon = Smartphone
    return { ...f, icon, details: `${f.aspectRatio} • ${f.orientation}` }
  })
})

const recommendedScriptStyleId = computed(() => {
  if (!selectedClassificationId.value) return undefined
  const c = classifications.value.find((x: any) => x.id === selectedClassificationId.value)
  return c?.defaultScriptStyleId
})
const recommendedVisualStyleId = computed(() => {
  const scriptId = recommendedScriptStyleId.value
  if (!scriptId) return undefined
  const script = scriptStyles.value.find((s: any) => s.id === scriptId)
  return script?.defaultVisualStyleId
})

const resolvedObjective = computed(() => {
  if (selectedObjectiveId.value === 'custom') return customObjective.value.trim()
  if (selectedObjectiveId.value) {
    const preset = editorialObjectives.value.find((o: any) => o.id === selectedObjectiveId.value)
    return preset?.instruction || ''
  }
  return ''
})

const productionSummary = computed(() => {
  const n = selectedFormats.value.length
  if (n === 0) return null
  const classificationLabel = selectedClassificationId.value
    ? (classifications.value.find((c: any) => c.id === selectedClassificationId.value)?.label ?? selectedClassificationId.value)
    : 'Nenhuma (livre)'
  const scriptLabel = scriptStyles.value.find((s: any) => s.id === selectedScriptStyle.value)?.name ?? selectedScriptStyle.value
  const visualLabel = visualStyles.value.find((v: any) => v.id === selectedVisualStyle.value)?.name ?? selectedVisualStyle.value
  return { n, classificationLabel, scriptLabel, visualLabel }
})

function stepDone(stepId: number) {
  if (stepId === 1) return true
  if (stepId === 2) return selectedFormats.value.length > 0
  if (stepId === 3) return !!selectedScriptStyle.value
  if (stepId === 4) return !!selectedVisualStyle.value
  if (stepId === 5) return !!selectedVoiceId.value
  if (stepId === 6) return true
  return false
}

const canProceed = computed(() => {
  if (currentStep.value === 1) return true
  if (currentStep.value === 2) return selectedFormats.value.length > 0
  if (currentStep.value === 3) return !!selectedScriptStyle.value
  if (currentStep.value === 4) return !!selectedVisualStyle.value
  if (currentStep.value === 5) return !!selectedVoiceId.value
  return true
})

const canSubmit = computed(() => {
  return selectedFormats.value.length > 0 && selectedScriptStyle.value && selectedVisualStyle.value && selectedVoiceId.value && !generatingOutputs.value
})

function goToStep(stepId: number) {
  if (stepId <= currentStep.value || stepDone(stepId)) currentStep.value = stepId
}

function nextStep() {
  if (currentStep.value < 6 && canProceed.value) currentStep.value++
}

watch(selectedClassificationId, (id) => {
  if (!id || !scriptStyles.value.length || !visualStyles.value.length) return
  const c = classifications.value.find((x: any) => x.id === id)
  if (c?.defaultScriptStyleId && scriptStyles.value.some((s: any) => s.id === c.defaultScriptStyleId)) {
    selectedScriptStyle.value = c.defaultScriptStyleId
    const script = scriptStyles.value.find((s: any) => s.id === c.defaultScriptStyleId)
    if (script?.defaultVisualStyleId && visualStyles.value.some((v: any) => v.id === script.defaultVisualStyleId)) {
      selectedVisualStyle.value = script.defaultVisualStyleId
    }
  }
})

function onFormatToggle(fmt: any) {
  if (selectedFormats.value.includes(fmt.id)) {
    if (!formatDurations.value[fmt.id]) formatDurations.value[fmt.id] = fmt.defaultDuration
  } else {
    delete formatDurations.value[fmt.id]
  }
}

async function loadDossier() {
  try {
    dossier.value = await $fetch(`/api/dossiers/${dossierId}`)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadStyles() {
  try {
    const [classificationsRes, scriptsRes, visualsRes, seedsRes, voicesRes, formatsRes, objectivesRes] = await Promise.all([
      $fetch('/api/intelligence-classifications'),
      $fetch('/api/script-styles'),
      $fetch('/api/visual-styles'),
      $fetch('/api/seeds'),
      $fetch('/api/voices'),
      $fetch('/api/video-formats'),
      $fetch('/api/editorial-objectives')
    ])
    classifications.value = (classificationsRes as any).data || []
    scriptStyles.value = (scriptsRes as any).data || []
    visualStyles.value = (visualsRes as any).data || []
    allSeeds.value = (seedsRes as any).data || []
    videoFormatsRaw.value = (formatsRes as any).data || []
    editorialObjectives.value = (objectivesRes as any).data || []
    availableVoices.value = (voicesRes as any).voices || []
    initialVoiceCursor.value = (voicesRes as any).nextCursor

    if (scriptStyles.value.length) selectedScriptStyle.value = scriptStyles.value[0].id
    if (dossier.value?.preferredVisualStyleId) selectedVisualStyle.value = dossier.value.preferredVisualStyleId
    else if (visualStyles.value.length) selectedVisualStyle.value = visualStyles.value[0].id
    if (dossier.value?.preferredSeedId) selectedSeed.value = dossier.value.preferredSeedId

    // Carregar sugestão de narrador do canal
    if (dossier.value?.channelId) {
      try {
        const voiceRes = await $fetch<any>(`/api/channels/${dossier.value.channelId}/most-used-voice`)
        if (voiceRes.voices?.length) {
          channelVoiceSuggestion.value = voiceRes.voices[0]
        }
      } catch { /* silencioso */ }
    }
  } catch (e) {
    console.error(e)
  }
}

function applyChannelVoice() {
  if (channelVoiceSuggestion.value) {
    selectedVoiceId.value = channelVoiceSuggestion.value.voiceId
  }
}

async function generateOutputs() {
  if (!canSubmit.value) return
  generatingOutputs.value = true
  try {
    const outputConfigs = selectedFormats.value.map((formatId) => {
      const isTeaser = formatId.includes('teaser')
      const customDuration = formatDurations.value[formatId]
      return {
        outputType: isTeaser ? 'VIDEO_TEASER' : 'VIDEO_FULL',
        format: isTeaser ? 'teaser' : 'full',
        duration: customDuration || 60,
        aspectRatio: isTeaser ? '9:16' : '16:9',
        platform: formatId.split('-')[1],
        classificationId: selectedClassificationId.value || undefined,
        scriptStyleId: selectedScriptStyle.value,
        visualStyleId: selectedVisualStyle.value,
        seedId: selectedSeed.value || undefined,
        enableMotion: enableMotion.value,
        targetWPM: selectedWPM.value,
        voiceId: selectedVoiceId.value || undefined,
        objective: resolvedObjective.value || undefined
      }
    })
    await $fetch(`/api/dossiers/${dossierId}/outputs`, { method: 'POST', body: { outputs: outputConfigs } })
    await router.push(`/dossiers/${dossierId}?tab=outputs`)
  } catch (err: any) {
    console.error(err)
    alert(err?.data?.message || 'Erro ao iniciar produção')
  } finally {
    generatingOutputs.value = false
  }
}

onMounted(async () => {
  await loadDossier()
  await loadStyles()
})
</script>
