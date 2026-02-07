<template>
  <div class="container mx-auto p-8 max-w-5xl">
    <header class="mb-12 relative group">
      <div class="absolute -inset-x-8 -top-8 h-40 bg-gradient-to-b from-primary/5 to-transparent blur-3xl opacity-50"></div>
      
      <NuxtLink to="/dossiers" class="group/back flex items-center gap-2 text-zinc-600 hover:text-primary transition-colors mb-6">
        <ArrowLeft :size="16" class="group-hover/back:-translate-x-1 transition-transform" />
        <span class="mono-label !text-[10px]">Retornar ao Hub</span>
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

    <div class="glass-card p-10 relative overflow-hidden">
      <!-- Background Cyber Grid -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>

      <form @submit.prevent="handleSubmit" class="space-y-10 relative">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Título -->
          <div class="space-y-2">
            <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
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
            <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
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
            <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
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
                      <span class="block text-[8px] text-zinc-600 group-hover/opt:text-zinc-400 uppercase tracking-tighter">{{ cat.desc }}</span>
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
            <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
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
                class="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase rounded-lg"
              >
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>

        <!-- Texto Principal -->
        <div class="space-y-2">
          <div class="flex justify-between items-end">
            <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
              <AlignCenter :size="12" />
              Fonte Primária (Base Neural)
            </label>
            <span class="mono-label !text-[9px] opacity-30">{{ formData.sourceText.length }} caracteres detectados</span>
          </div>
          <textarea
            v-model="formData.sourceText"
            required
            rows="10"
            class="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-sm text-zinc-300 font-mono leading-relaxed focus:border-primary outline-none transition-all shadow-inner resize-none custom-scrollbar"
            placeholder="Cole aqui o corpo da investigação (artigo, transcrição, documento histórico)..."
          ></textarea>
        </div>

        <!-- UNIVERSO VISUAL (NOVO) -->
        <div class="pt-10 border-t border-white/5 space-y-8">
          <header class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 shadow-glow">
              <Palette :size="20" />
            </div>
            <div>
              <h2 class="text-xs font-black uppercase tracking-[0.3em] text-white">Universo Visual</h2>
              <p class="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">Defina a identidade estética padrão desta investigação</p>
            </div>
          </header>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Estilo Visual Preferencial -->
            <div class="space-y-3">
              <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
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
              <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
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
            <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
              <AlertTriangle :size="12" />
              Diretrizes de Identidade do Universo (Warning Protocol)
            </label>
            <textarea
              v-model="formData.visualIdentityContext"
              rows="3"
              class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-primary outline-none transition-all shadow-inner resize-none custom-scrollbar text-sm"
              placeholder="Ex: Este dossiê pertence a um universo Noir. Evite cores vibrantes. Use sombras profundas e iluminação de alto contraste..."
            ></textarea>
          </div>
        </div>

        <!-- Botões -->
        <div class="flex flex-col sm:flex-row gap-4 pt-10 border-t border-white/5">
          <button
            type="submit"
            :disabled="submitting"
            class="btn-primary flex-1 py-5 !text-[12px] tracking-[0.2em] font-black relative group/btn overflow-hidden"
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
          
          <NuxtLink to="/dossiers" class="btn-secondary !px-12 flex items-center justify-center py-5 mono-label !text-[10px] !text-zinc-500 hover:!text-white border-white/5 hover:bg-white/5">
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
  ChevronDown, Tag, AlignCenter, Plus, Palette, Dna, AlertTriangle, Layout,
  Skull, History, Beaker, User, Search, Moon, Eye, X
} from 'lucide-vue-next'

const formData = ref({
  title: '',
  theme: '',
  category: '',
  tags: [] as string[],
  sourceText: '',
  visualIdentityContext: '',
  preferredVisualStyleId: '',
  preferredSeedId: ''
})

const tagsInput = ref('')
const submitting = ref(false)
const isDropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

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
})

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

async function handleSubmit() {
  if (submitting.value) return

  submitting.value = true
  try {
    const dossier = await $fetch('/api/dossiers', {
      method: 'POST',
      body: {
        title: formData.value.title,
        theme: formData.value.theme,
        sourceText: formData.value.sourceText,
        tags: formData.value.tags,
        category: formData.value.category || undefined,
        visualIdentityContext: formData.value.visualIdentityContext || undefined,
        preferredVisualStyleId: formData.value.preferredVisualStyleId || undefined,
        preferredSeedId: formData.value.preferredSeedId || undefined
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
