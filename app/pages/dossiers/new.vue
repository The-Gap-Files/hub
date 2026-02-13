<template>
  <div class="container mx-auto p-8 max-w-5xl">
    <header class="mb-12 relative group">
      <div class="absolute -inset-x-8 -top-8 h-40 bg-gradient-to-b from-primary/5 to-transparent blur-3xl opacity-50"></div>
      
      <NuxtLink to="/dossiers" class="group/back flex items-center gap-2 text-zinc-600 hover:text-primary transition-colors mb-6">
        <ArrowLeft :size="16" class="group-hover/back:-translate-x-1 transition-transform" />
        <span class="mono-label text-xs">Retornar ao Hub</span>
      </NuxtLink>

      <div class="relative space-y-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-glow">
            <Zap :size="24" />
          </div>
          <span class="mono-label tracking-[0.4em] text-primary/60">New Mission Briefing</span>
        </div>
        <h1 class="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
          Codificar Dossier
        </h1>
        <p class="text-zinc-500 font-medium max-w-md">Inicie o protocolo de inteligência injetando o vetor de dados primário.</p>
      </div>
    </header>

    <!-- INVESTIGADOR AUTÔNOMO -->
    <div class="glass-card p-8 relative overflow-hidden mb-8 border border-amber-500/10">
      <div class="absolute inset-0 pointer-events-none opacity-[0.02] bg-[radial-gradient(circle_at_30%_40%,rgba(245,158,11,0.15),transparent_70%)]"></div>

      <header class="flex items-center gap-3 mb-6 relative">
        <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <Radar :size="20" class="animate-pulse" />
        </div>
        <div>
          <h2 class="text-xs font-black uppercase tracking-[0.3em] text-white">Investigador Autônomo</h2>
          <p class="text-xs text-zinc-500 uppercase font-bold tracking-widest mt-0.5">Jogue uma semente — a IA faz o resto</p>
        </div>
      </header>

      <div class="flex gap-3 relative">
        <div class="flex-1 relative">
          <input
            v-model="investigateQuery"
            type="text"
            :disabled="investigating"
            class="w-full bg-white/5 border border-amber-500/20 rounded-2xl px-5 py-4 text-white focus:border-amber-500 outline-none transition-all shadow-inner placeholder:text-zinc-600"
            placeholder="Ex: Simão de Trento, MK-Ultra, Cleopatra poder..."
            @keydown.enter.prevent="handleInvestigate"
          />
          <div v-if="investigating" class="absolute right-4 top-1/2 -translate-y-1/2">
            <div class="w-5 h-5 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          </div>
        </div>
        <button
          type="button"
          :disabled="investigating || !investigateQuery.trim()"
          @click="handleInvestigate"
          class="px-8 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 font-black text-xs uppercase tracking-[0.2em] hover:bg-amber-500/20 hover:border-amber-500/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed group/inv"
        >
          <span v-if="!investigating" class="flex items-center gap-2">
            <Search :size="16" class="group-hover/inv:rotate-12 transition-transform" />
            Investigar
          </span>
          <span v-else class="flex items-center gap-2">
            <Radar :size="16" class="animate-spin" />
            Buscando...
          </span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="investigating" class="mt-6 space-y-3">
        <div class="flex items-center gap-3 text-amber-500/60">
          <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
          <span class="mono-label text-xs animate-pulse">{{ investigateStatus }}</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="h-12 bg-white/5 rounded-xl animate-pulse"></div>
          <div class="h-12 bg-white/5 rounded-xl animate-pulse" style="animation-delay: 150ms"></div>
          <div class="h-12 bg-white/5 rounded-xl animate-pulse" style="animation-delay: 300ms"></div>
          <div class="h-12 bg-white/5 rounded-xl animate-pulse" style="animation-delay: 450ms"></div>
        </div>
      </div>

      <!-- Resultado -->
      <div v-if="investigateResult && !investigating" class="mt-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <span class="mono-label text-xs text-emerald-500">Investigação completa — Confiança: {{ investigateResult.confidence }}%</span>
          </div>
          <span class="mono-label text-[10px] text-zinc-600">{{ investigateResult.provider }} / {{ investigateResult.model }}</span>
        </div>
        <p class="text-xs text-zinc-500 mt-2 italic">{{ investigateResult.reasoning }}</p>
      </div>
    </div>

    <div class="glass-card p-10 relative overflow-hidden">
      <!-- Background Cyber Grid -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>

      <form @submit.prevent="handleSubmit" class="space-y-10 relative">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Título -->
          <div class="space-y-2">
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
              <FileText :size="12" />
              Título do Arquivo
            </label>
            <input
              v-model="formData.title"
              type="text"
              required
              class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner"
              placeholder="Ex: O Caso da Beatificação de Simão de Trento"
            />
          </div>

          <!-- Tema -->
          <div class="space-y-2">
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
              <Target :size="12" />
              Vetor de Retenção (Tema)
            </label>
            <input
              v-model="formData.theme"
              type="text"
              required
              class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner"
              placeholder="Ex: Injustiça histórica + libelo de sangue"
            />
          </div>

          <!-- Categoria (Custom Select) -->
          <div class="space-y-2">
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
              <Database :size="12" />
              Classificação de Inteligência
            </label>
            <div class="relative" ref="dropdownRef">
              <button 
                type="button"
                @click="isDropdownOpen = !isDropdownOpen"
                class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner flex items-center justify-between group/select"
                :class="{ 'border-primary shadow-[0_0_20px_rgba(59,130,246,0.1)]': isDropdownOpen }"
              >
                <div class="flex items-center gap-3">
                  <component 
                    :is="selectedCategoryIcon" 
                    v-if="formData.category"
                    :size="16" 
                    class="text-primary"
                  />
                  <span :class="{ 'text-zinc-500': !formData.category }" class="text-sm font-medium uppercase tracking-wider">
                    {{ selectedCategoryLabel || 'Selecione a Categoria...' }}
                  </span>
                </div>
                <ChevronDown 
                  :size="18" 
                  class="text-zinc-600 transition-transform duration-300" 
                  :class="{ 'rotate-180 text-primary': isDropdownOpen }" 
                />
              </button>

              <!-- Dropdown Menu -->
              <div 
                v-if="isDropdownOpen"
                class="absolute z-50 top-full left-0 right-0 mt-3 p-2 bg-[#0A0A0F] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
              >
                <div class="grid grid-cols-1 gap-1">
                  <button
                    v-for="cat in categories"
                    :key="cat.id"
                    type="button"
                    @click="selectCategory(cat.id)"
                    class="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-left group/opt"
                    :class="{ 'bg-primary/10 text-primary': formData.category === cat.id }"
                  >
                    <div 
                      class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500 group-hover/opt:text-primary transition-colors"
                      :class="{ 'text-primary bg-primary/5': formData.category === cat.id }"
                    >
                      <component :is="cat.icon" :size="16" />
                    </div>
                    <div>
                      <span class="block text-xs font-black uppercase tracking-widest">{{ cat.label }}</span>
                      <span class="block text-xs text-zinc-600 group-hover/opt:text-zinc-400 uppercase tracking-tighter">{{ cat.desc }}</span>
                    </div>
                    <div v-if="formData.category === cat.id" class="ml-auto">
                      <div class="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,1)]"></div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div class="space-y-2">
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
              <Tag :size="12" />
              Marcadores de Metadados
            </label>
            <input
              v-model="tagsInput"
              type="text"
              class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner"
              placeholder="Ex: idade-média, injustiça, judeus..."
            />
            <div v-if="formData.tags.length > 0" class="flex flex-wrap gap-2 mt-3 pl-1">
              <span
                v-for="tag in formData.tags"
                :key="tag"
                class="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase rounded-lg"
              >
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>

        <!-- Canal (opcional) -->
        <div class="space-y-2">
          <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
            <Tv :size="12" />
            Canal de Distribuição
          </label>
          <select
            v-model="formData.channelId"
            class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner appearance-none cursor-pointer"
          >
            <option value="" class="bg-[#0A0A0F]">Nenhum canal (avulso)</option>
            <option
              v-for="ch in channelOptions"
              :key="ch.id"
              :value="ch.id"
              class="bg-[#0A0A0F]"
            >
              {{ ch.name }} ({{ ch.handle }})
            </option>
          </select>
        </div>

        <!-- UNIVERSO VISUAL (NOVO) -->
        <div class="pt-10 border-t border-white/5 space-y-8">
          <header class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 shadow-glow">
              <Palette :size="20" />
            </div>
            <div>
              <h2 class="text-xs font-black uppercase tracking-[0.3em] text-white">Universo Visual</h2>
              <p class="text-xs text-zinc-500 uppercase font-bold tracking-widest mt-0.5">Defina a identidade estética padrão desta investigação</p>
            </div>
          </header>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Estilo Visual Preferencial -->
            <div class="space-y-3">
              <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
                <Layout :size="12" />
                Estilo Visual Direcionador
              </label>
              <select 
                v-model="formData.preferredVisualStyleId"
                class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner appearance-none cursor-pointer"
              >
                <option value="" class="bg-[#0A0A0F]">Nenhum (Usar sistema)</option>
                <option 
                  v-for="style in visualStyles" 
                  :key="style.id" 
                  :value="style.id"
                  class="bg-[#0A0A0F]"
                >
                  {{ style.name }}
                </option>
              </select>
            </div>

            <!-- Passo 4: DNA Visual (Seed) -->
            <div class="space-y-3">
              <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
                <Dna :size="12" />
                Assinatura Genética (Seed)
              </label>
              <select 
                v-model="formData.preferredSeedId"
                class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner appearance-none cursor-pointer"
              >
                <option value="" class="bg-[#0A0A0F]">Nenhuma (Aleatória)</option>
                <option 
                  v-for="seed in allSeeds" 
                  :key="seed.id" 
                  :value="seed.id"
                  class="bg-[#0A0A0F]"
                >
                  DNA {{ seed.value }}
                </option>
              </select>
            </div>
          </div>

          <!-- Contexto Visual (Seu aviso customizado) -->
          <div class="space-y-3">
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2 group/info relative">
              <AlertTriangle :size="12" />
              Diretrizes de Identidade do Universo (Warning Protocol)
              <HelpCircle :size="14" class="text-zinc-600 hover:text-primary cursor-help transition-colors" />
              
              <!-- Tooltip -->
              <div class="absolute left-0 bottom-full mb-2 w-64 p-3 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all z-50 transform translate-y-2 group-hover/info:translate-y-0">
                <p class="text-[10px] leading-relaxed text-zinc-300 normal-case tracking-normal">
                  <strong class="text-primary block mb-1">A âncora visual do seu universo.</strong>
                  Este campo injeta diretrizes estéticas diretas em cada imagem gerada. Use para definir texturas (concreto, ferrugem), iluminação (fluorescente, néon) e o tom emocional. Garante que a identidade do dossiê seja preservada mesmo em cenas complexas.
                </p>
              </div>
            </label>
            <textarea
              v-model="formData.visualIdentityContext"
              rows="3"
              class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner resize-none custom-scrollbar text-sm"
              placeholder="Ex: Este dossiê pertence a um universo Noir. Evite cores vibrantes. Use sombras profundas e iluminação de alto contraste..."
            ></textarea>
          </div>
        </div>

        <!-- PROMPT DEEP RESEARCH (se investigação preencheu) -->
        <div v-if="investigateResult?.researchPrompt" class="pt-10 border-t border-white/5 space-y-4">
          <header class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <Search :size="20" />
              </div>
              <div>
                <h2 class="text-xs font-black uppercase tracking-[0.3em] text-white">Prompt Gemini Research</h2>
                <p class="text-xs text-zinc-500 uppercase font-bold tracking-widest mt-0.5">Prompt gerado para pesquisa profunda — copiável e editável</p>
              </div>
            </div>
            <button
              type="button"
              @click="copyResearchPrompt"
              class="px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-500 font-bold text-[10px] uppercase tracking-widest hover:bg-cyan-500/20 transition-all flex items-center gap-2"
            >
              <component :is="promptCopied ? CheckCheck : Copy" :size="14" />
              {{ promptCopied ? 'Copiado!' : 'Copiar' }}
            </button>
          </header>
          <textarea
            v-model="investigateResult.researchPrompt"
            rows="10"
            class="w-full bg-white/5 border border-cyan-500/10 rounded-2xl px-5 py-4 text-white/80 focus:border-cyan-500/30 outline-none transition-all resize-none custom-scrollbar text-sm font-mono leading-relaxed"
          ></textarea>
        </div>

        <!-- Botões -->
        <div class="flex flex-col sm:flex-row gap-4 pt-10 border-t border-white/5">
          <button
            type="submit"
            :disabled="submitting"
            class="btn-primary flex-1 py-5 !text-xs tracking-[0.2em] font-black relative group/btn overflow-hidden"
          >
            <span v-if="!submitting" class="flex items-center justify-center gap-3 relative z-10">
              <Plus :size="20" class="group-hover/btn:rotate-90 transition-transform duration-500" />
              INICIALIZAR DOSSIER
            </span>
            <span v-else class="flex items-center justify-center gap-3 relative z-10">
              <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ENCRIPTANDO DADOS...
            </span>
            <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
          </button>
          
          <NuxtLink to="/dossiers" class="btn-secondary !px-12 flex items-center justify-center py-5 mono-label text-xs !text-zinc-500 hover:!text-white border-white/5 hover:bg-white/5">
            Abortar
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  ArrowLeft, Zap, FileText, Target, Database, 
  ChevronDown, Tag, AlignCenter, Plus, Palette, Dna, AlertTriangle, Layout, Tv,
  Skull, History, Beaker, User, Search, Moon, Eye, X, Radar, Copy, CheckCheck,
  HelpCircle
} from 'lucide-vue-next'

interface ChannelOption {
  id: string
  name: string
  handle: string
}

const channelOptions = ref<ChannelOption[]>([])

const formData = ref({
  title: '',
  theme: '',
  category: '',
  tags: [] as string[],
  visualIdentityContext: '',
  preferredVisualStyleId: '',
  preferredSeedId: '',
  channelId: ''
})

const tagsInput = ref('')
const submitting = ref(false)
const isDropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

// ───── Investigador ─────
const investigateQuery = ref('')
const investigating = ref(false)
const investigateStatus = ref('Preparando investigação...')
const investigateResult = ref<any>(null)
const promptCopied = ref(false)

// Carregar estilos e seeds
const visualStyles = ref<any[]>([])
const allSeeds = ref<any[]>([])

async function loadVisualResources() {
  try {
    const [stylesRes, seedsRes] = await Promise.all([
      $fetch('/api/visual-styles'),
      $fetch('/api/seeds')
    ])
    visualStyles.value = (stylesRes as any).data || []
    allSeeds.value = (seedsRes as any).data || []
  } catch (error) {
    console.error('Erro ao carregar recursos visuais:', error)
  }
}


const classificationRaw = ref<any[]>([])

const iconMap: Record<string, any> = {
  skull: Skull,
  history: History,
  beaker: Beaker,
  user: User,
  search: Search,
  moon: Moon,
  eye: Eye
}

const categories = computed(() => {
  return classificationRaw.value.map(c => ({
    id: c.id,
    label: c.label,
    desc: c.description,
    icon: iconMap[c.iconKey] || FileText
  }))
})

const selectedCategoryLabel = computed(() => {
  return categories.value.find(c => c.id === formData.value.category)?.label
})

const selectedCategoryIcon = computed(() => {
  return categories.value.find(c => c.id === formData.value.category)?.icon
})

function selectCategory(id: string) {
  formData.value.category = id
  isDropdownOpen.value = false
}

// Fechar ao clicar fora (sem @vueuse)
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
  loadVisualResources()
  loadClassifications()
  loadChannelOptions()
})

async function loadChannelOptions() {
  try {
    const res = await $fetch<any>('/api/channels')
    channelOptions.value = (res.channels || []).map((ch: any) => ({ id: ch.id, name: ch.name, handle: ch.handle }))
  } catch { /* silencioso */ }
}

async function loadClassifications() {
  try {
    const res = await $fetch<{ data: any[] }>('/api/intelligence-classifications')
    classificationRaw.value = res.data || []
  } catch (e) {
    console.error('Erro ao carregar classificações:', e)
  }
}

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})

// Atualizar tags quando input mudar
watch(tagsInput, (value) => {
  formData.value.tags = value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)
})

// ───── Investigador ─────
async function handleInvestigate() {
  const query = investigateQuery.value.trim()
  if (!query || investigating.value) return

  investigating.value = true
  investigateResult.value = null
  investigateStatus.value = 'Conectando à rede de inteligência...'

  // Animação de status
  const statusMessages = [
    'Vasculhando bancos de dados globais...',
    'Analisando fontes primárias...',
    'Cruzando referências históricas...',
    'Classificando inteligência editorial...',
    'Gerando vetor de retenção...',
    'Compilando dossiê preliminar...'
  ]
  let statusIndex = 0
  const statusInterval = setInterval(() => {
    statusIndex = (statusIndex + 1) % statusMessages.length
    investigateStatus.value = statusMessages[statusIndex] ?? 'Processando...'
  }, 2500)

  try {
    const result = await $fetch<any>('/api/dossiers/investigate', {
      method: 'POST',
      body: { query }
    })

    investigateResult.value = result

    // Auto-fill do formulário
    formData.value.title = result.title || ''
    formData.value.theme = result.theme || ''
    formData.value.category = result.classificationId || ''
    formData.value.visualIdentityContext = result.visualIdentityContext || ''
    formData.value.preferredVisualStyleId = result.suggestedVisualStyleId || ''

    // Tags
    if (result.tags && result.tags.length > 0) {
      formData.value.tags = result.tags
      tagsInput.value = result.tags.join(', ')
    }

  } catch (error: any) {
    console.error('Erro na investigação:', error)
    alert(error.data?.message || 'Erro ao investigar semente')
  } finally {
    clearInterval(statusInterval)
    investigating.value = false
  }
}

async function copyResearchPrompt() {
  if (!investigateResult.value?.researchPrompt) return
  try {
    await navigator.clipboard.writeText(investigateResult.value.researchPrompt)
    promptCopied.value = true
    setTimeout(() => { promptCopied.value = false }, 2000)
  } catch {
    // Fallback para navegadores sem clipboard API
    const textarea = document.createElement('textarea')
    textarea.value = investigateResult.value.researchPrompt
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    promptCopied.value = true
    setTimeout(() => { promptCopied.value = false }, 2000)
  }
}

async function handleSubmit() {
  if (submitting.value) return

  submitting.value = true
  try {
    const dossier = await $fetch('/api/dossiers', {
      method: 'POST',
      body: {
        title: formData.value.title,
        theme: formData.value.theme,
        tags: formData.value.tags,
        category: formData.value.category || undefined,
        visualIdentityContext: formData.value.visualIdentityContext || undefined,
        researchPrompt: investigateResult.value?.researchPrompt || undefined,
        preferredVisualStyleId: formData.value.preferredVisualStyleId || undefined,
        preferredSeedId: formData.value.preferredSeedId || undefined,
        channelId: formData.value.channelId || undefined
      }
    })

    // Redirecionar para página do dossier
    await navigateTo(`/dossiers/${(dossier as any).id}`)
  } catch (error: any) {
    console.error('Erro ao criar dossier:', error)
    alert(error.data?.message || 'Erro ao criar dossier')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* Estilos adicionais seriam mantidos se houvesse, mas aqui usamos utilitários do tailwind */
</style>
