<template>
  <div class="min-h-screen bg-oled-black pb-20 selection:bg-primary/30">
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[80vh] space-y-6">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
        <div class="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-1 h-1 bg-primary rounded-full animate-ping"></div>
        </div>
      </div>
      <div class="text-center space-y-2">
        <p class="text-lg font-black tracking-tighter text-white uppercase animate-pulse">Sincronizando Dossier...</p>
        <p class="text-xs font-mono text-muted-foreground uppercase tracking-widest">Protocolo Antigravity v4.0</p>
      </div>
    </div>

    <div v-else-if="dossier" class="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <!-- Header Imersivo UI-UX Pro Max -->
      <header class="relative mb-12 group">
        <div class="absolute -inset-4 bg-gradient-to-r from-primary/5 via-blue-500/5 to-purple-500/5 blur-3xl rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        
        <div class="relative flex flex-col md:flex-row justify-between items-end gap-8 pb-8 border-b border-white/10">
          <div class="flex-1 space-y-4">
            <div class="flex items-center gap-3 flex-wrap">
              <span class="mono-label px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md text-primary">Ativo</span>
              <span class="text-muted-foreground/30 px-2">•</span>
              <span class="mono-label text-muted-foreground">{{ formatDate(dossier.updatedAt) }}</span>
              <template v-if="dossier.totalOutputsCost != null && dossier.totalOutputsCost > 0">
                <span class="text-muted-foreground/30 px-2">•</span>
                <span class="mono-label text-emerald-400/90">Custo outputs: {{ formatCost(dossier.totalOutputsCost) }}</span>
              </template>
              <!-- Token Counter -->
              <template v-if="dossierTokens > 0">
                <span class="text-muted-foreground/30 px-2">•</span>
                <span 
                  class="mono-label flex items-center gap-1.5"
                  :class="tokenColorClass"
                  :title="tokenTooltip"
                >
                  <span class="inline-block w-1.5 h-1.5 rounded-full" :class="tokenDotClass"></span>
                  ~{{ formatTokenCount(dossierTokens) }} tokens
                </span>
              </template>
            </div>
            
            <h1 class="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
              {{ dossier.title }}
            </h1>
            
            <p class="text-xl text-muted-foreground max-w-3xl font-medium leading-relaxed">
              {{ dossier.theme }}
            </p>
            
            <div class="flex flex-wrap gap-2 pt-2">
              <span v-for="tag in dossier.tags" :key="tag" 
                    class="px-3 py-1 bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-white/10 transition-colors cursor-default">
                #{{ tag }}
              </span>
            </div>
          </div>
          
          <div class="flex items-center gap-4">
             <NuxtLink to="/dossiers" class="btn-secondary group/btn">
               <span class="flex items-center gap-2">
                 <ArrowLeft :size="18" class="group-hover/btn:-translate-x-1 transition-transform" />
                 Voltar
               </span>
             </NuxtLink>
             <NuxtLink :to="`/dossiers/${dossierId}/produce`" class="btn-primary group/btn px-10 inline-flex items-center gap-2">
               <Zap :size="20" class="fill-current" />
               GERAR VÍDEO
             </NuxtLink>
          </div>
        </div>
      </header>

      <!-- SEÇÃO 2: Workspace Navigation -->
      <div class="flex flex-wrap items-center gap-4 mb-10">
        <button v-for="tab in workspaceTabs" :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 border flex items-center gap-2',
            activeTab === tab.id 
              ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.25)]' 
              : 'bg-white/5 text-muted-foreground border-white/10 hover:border-white/20 hover:text-white'
          ]"
        >
          <component :is="tab.icon" :size="16" />
          {{ tab.name }}
          <span v-if="tab.id === 'outputs' && dossier.outputsCount" class="ml-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
            {{ dossier.outputsCount }}
          </span>
        </button>
      </div>

      <!-- SEÇÃO 3: Content Displays -->
      <main class="animate-in fade-in slide-in-from-top-4 duration-700">
        <!-- Workspace: Context (Dossier Processing) -->
        <div v-show="activeTab === 'dashboard'" class="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <!-- Main Source Text -->
          <div class="lg:col-span-8 space-y-10">
            <section class="glass-card p-1">
              <div class="p-8 pb-4 flex justify-between items-center border-b border-white/5">
                <div class="flex items-center gap-3">
                   <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                     <FileText :size="20" />
                   </div>
                   <h3 class="text-sm font-black uppercase tracking-widest text-white">Documento Primário</h3>
                </div>
                <button class="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Refinar Conteúdo</button>
              </div>
              <div class="p-8">
                <div class="prose prose-invert max-w-none text-zinc-400 font-sans leading-relaxed max-h-[600px] overflow-y-auto pr-6 custom-scrollbar">
                   <pre class="whitespace-pre-wrap font-sans text-lg tracking-tight">{{ dossier.sourceText }}</pre>
                </div>
              </div>
            </section>
            
            <DossierSources 
              :dossier-id="dossierId" 
              :initial-sources="dossier.sources || []" 
              @updated="loadDossier"
            />
          </div>

          <!-- Semantic Data Column -->
          <div class="lg:col-span-4 space-y-10">
            <!-- NOVO: Universo Visual Editável -->
            <section class="glass-card p-1">
              <div class="p-6 pb-4 flex justify-between items-center border-b border-white/5">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <Palette :size="20" />
                  </div>
                  <h3 class="text-sm font-black uppercase tracking-widest text-white">Universo Visual</h3>
                </div>
                <button 
                  v-if="!editingVisualSettings"
                  @click="startEditingVisualSettings"
                  class="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                  Editar
                </button>
              </div>
              
              <div class="p-6 space-y-6">
                <!-- Modo Visualização -->
                <div v-if="!editingVisualSettings" class="space-y-4">
                  <div class="space-y-2">
                    <label class="mono-label !text-[9px] text-zinc-500">Estilo Visual</label>
                    <p class="text-sm text-white font-medium">
                      {{ getVisualStyleName(dossier.preferredVisualStyleId) || 'Nenhum definido' }}
                    </p>
                  </div>
                  
                  <div class="space-y-2">
                    <label class="mono-label !text-[9px] text-zinc-500">DNA (Seed)</label>
                    <p class="text-sm text-white font-medium font-mono">
                      {{ getSeedValue(dossier.preferredSeedId) || 'Aleatória' }}
                    </p>
                  </div>
                  
                  <div v-if="dossier.visualIdentityContext" class="space-y-2">
                    <label class="mono-label !text-[9px] text-zinc-500">Diretrizes de Identidade</label>
                    <p class="text-xs text-zinc-400 italic leading-relaxed">
                      "{{ dossier.visualIdentityContext }}"
                    </p>
                  </div>
                </div>
                
                <!-- Modo Edição -->
                <div v-else class="space-y-6">
                  <div class="space-y-3">
                    <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
                      <Palette :size="12" />
                      Estilo Visual Direcionador
                    </label>
                    <select 
                      v-model="visualSettingsForm.preferredVisualStyleId"
                      class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-primary outline-none transition-all shadow-inner appearance-none cursor-pointer">
                      <option value="" class="bg-[#0A0A0F]">Nenhum (Usar sistema)</option>
                      <option 
                        v-for="style in visualStyles" 
                        :key="style.id" 
                        :value="style.id"
                        class="bg-[#0A0A0F]">
                        {{ style.name }}
                      </option>
                    </select>
                  </div>
                  
                  <div class="space-y-3">
                    <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
                      <Dna :size="12" />
                      Assinatura Genética (Seed)
                    </label>
                    <select 
                      v-model="visualSettingsForm.preferredSeedId"
                      class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-primary outline-none transition-all shadow-inner appearance-none cursor-pointer">
                      <option value="" class="bg-[#0A0A0F]">Gerar Nova Seed Aleatória</option>
                      <option 
                        v-for="seed in allSeeds" 
                        :key="seed.id" 
                        :value="seed.id"
                        class="bg-[#0A0A0F]">
                        DNA {{ seed.value }}
                      </option>
                    </select>
                  </div>
                  
                  <div class="space-y-3">
                    <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
                      <AlertTriangle :size="12" />
                      Diretrizes de Identidade
                    </label>
                    <textarea
                      v-model="visualSettingsForm.visualIdentityContext"
                      rows="3"
                      class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-primary outline-none transition-all shadow-inner resize-none custom-scrollbar"
                      placeholder="Ex: Este dossiê pertence a um universo Noir. Evite cores vibrantes...">
                    </textarea>
                  </div>
                  
                  <!-- Botões de Ação -->
                  <div class="flex gap-3 pt-4 border-t border-white/5">
                    <button 
                      @click="saveVisualSettings"
                      :disabled="savingVisualSettings"
                      class="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      <span v-if="!savingVisualSettings">Salvar</span>
                      <span v-else class="flex items-center gap-2">
                        <div class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Salvando...
                      </span>
                    </button>
                    <button 
                      @click="cancelEditingVisualSettings"
                      :disabled="savingVisualSettings"
                      class="px-4 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50">
                      Cancelar
                    </button>
                  </div>
                  
                  <!-- Mensagem de Sucesso -->
                  <div v-if="visualSettingsSaved" 
                       class="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                    <div class="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                      <div class="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                    <span class="text-[10px] font-bold text-green-500 uppercase tracking-wider">
                      Configurações visuais atualizadas com sucesso!
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <DossierNotes 
              :dossier-id="dossierId" 
              :initial-notes="dossier.notes || []" 
              @updated="loadDossier" 
            />
            
            <DossierImages 
              :dossier-id="dossierId" 
              :initial-images="dossier.images || []" 
              @updated="loadDossier"
            />
          </div>
        </div>

        <!-- Workspace: Monetization Strategy -->
        <div v-show="activeTab === 'monetization'">
          <DossierMonetization :dossier-id="dossierId" />
        </div>

        <!-- Workspace: Production Outputs -->
        <div v-show="activeTab === 'outputs'">
          <DossierOutputs 
            ref="outputsComponent"
            :dossier-id="dossierId" 
            @open-generator="goToProduce"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  ArrowLeft, Zap, FileText, Database, Palette, AlertTriangle, Dna,
  LayoutDashboard, PlayCircle, TrendingUp,
  Target, Eye, EyeOff, Clock, Layers, BookOpen, GraduationCap, Heart, Flame, Swords
} from 'lucide-vue-next'
import DossierSources from '~/components/dossier/DossierSources.vue'
import DossierImages from '~/components/dossier/DossierImages.vue'
import DossierNotes from '~/components/dossier/DossierNotes.vue'
import DossierOutputs from '~/components/dossier/DossierOutputs.vue'
import DossierMonetization from '~/components/dossier/DossierMonetization.vue'

const route = useRoute()
const router = useRouter()
const dossierId = route.params.id as string

const dossier = ref<any>(null)
const loading = ref(true)
const activeTab = ref('dashboard')
const outputsComponent = ref<any>(null)
const editingVisualSettings = ref(false)
const savingVisualSettings = ref(false)
const visualSettingsSaved = ref(false)
const visualSettingsForm = ref({
  preferredVisualStyleId: '',
  preferredSeedId: '',
  visualIdentityContext: ''
})
const visualStyles = ref<any[]>([])
const allSeeds = ref<any[]>([])
const workspaceTabs = [
  { id: 'dashboard', name: 'Intelligence Context', icon: Database },
  { id: 'monetization', name: 'Monetization Strategy', icon: TrendingUp },
  { id: 'outputs', name: 'Production Pipeline', icon: PlayCircle }
]

async function loadDossier() {
  try {
    const data = await $fetch(`/api/dossiers/${dossierId}`)
    dossier.value = data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadVisualReferences() {
  try {
    const [visualsRes, seedsRes] = await Promise.all([
      $fetch('/api/visual-styles'),
      $fetch('/api/seeds')
    ])
    visualStyles.value = (visualsRes as any).data || []
    allSeeds.value = (seedsRes as any).data || []
  } catch (e) {
    console.error(e)
  }
}

function getVisualStyleName(styleId: string | null) {
  if (!styleId) return null
  return visualStyles.value.find((s: any) => s.id === styleId)?.name
}

function getSeedValue(seedId: string | null) {
  if (!seedId) return null
  const seed = allSeeds.value.find((s: any) => s.id === seedId)
  return seed ? `DNA ${seed.value}` : null
}

function startEditingVisualSettings() {
  visualSettingsForm.value = {
    preferredVisualStyleId: dossier.value?.preferredVisualStyleId || '',
    preferredSeedId: dossier.value?.preferredSeedId || '',
    visualIdentityContext: dossier.value?.visualIdentityContext || ''
  }
  editingVisualSettings.value = true
  visualSettingsSaved.value = false
}

async function saveVisualSettings() {
  if (savingVisualSettings.value) return
  savingVisualSettings.value = true
  try {
    const updateData: any = {
      preferredVisualStyleId: visualSettingsForm.value.preferredVisualStyleId || undefined,
      visualIdentityContext: visualSettingsForm.value.visualIdentityContext || undefined
    }
    if (!visualSettingsForm.value.preferredSeedId && visualSettingsForm.value.preferredVisualStyleId) {
      const randomValue = Math.floor(Math.random() * 2147483647)
      const seedResponse = await $fetch('/api/seeds', { method: 'POST', body: { value: randomValue } })
      updateData.preferredSeedId = (seedResponse as any).data.id
    } else {
      updateData.preferredSeedId = visualSettingsForm.value.preferredSeedId || undefined
    }
    await $fetch(`/api/dossiers/${dossierId}`, { method: 'PATCH', body: updateData })
    await loadDossier()
    visualSettingsSaved.value = true
    editingVisualSettings.value = false
    setTimeout(() => { visualSettingsSaved.value = false }, 3000)
  } catch (err: any) {
    alert(err?.data?.message || 'Erro ao salvar configurações visuais')
  } finally {
    savingVisualSettings.value = false
  }
}

function cancelEditingVisualSettings() {
  editingVisualSettings.value = false
  visualSettingsSaved.value = false
}

function formatDate(dateString: string) {
  if (!dateString) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateString))
}

function formatCost(totalCost: number): string {
  if (totalCost >= 0.01) return `$${totalCost.toFixed(2)}`
  if (totalCost > 0) return `$${totalCost.toFixed(4)}`
  return '$0.00'
}

// ───── Dossier Token Calculator ─────
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4)
}

const dossierTokens = computed(() => {
  if (!dossier.value) return 0
  let total = 0
  
  // Documento principal
  total += estimateTokens(dossier.value.sourceText || '')
  
  // Fontes secundárias
  if (dossier.value.sources?.length) {
    for (const source of dossier.value.sources) {
      total += estimateTokens(source.content || '')
      total += estimateTokens(source.title || '')
    }
  }
  
  // Notas existentes
  if (dossier.value.notes?.length) {
    for (const note of dossier.value.notes) {
      total += estimateTokens(note.content || '')
    }
  }
  
  // Imagens (descrições)
  if (dossier.value.images?.length) {
    for (const img of dossier.value.images) {
      total += estimateTokens(img.description || '')
    }
  }
  
  return total
})

const tokenColorClass = computed(() => {
  const t = dossierTokens.value
  if (t > 150_000) return 'text-red-400'
  if (t > 100_000) return 'text-amber-400'
  return 'text-zinc-500'
})

const tokenDotClass = computed(() => {
  const t = dossierTokens.value
  if (t > 150_000) return 'bg-red-400 animate-pulse'
  if (t > 100_000) return 'bg-amber-400'
  return 'bg-zinc-600'
})

const tokenTooltip = computed(() => {
  const t = dossierTokens.value
  const limit = 200_000
  const pct = Math.round((t / limit) * 100)
  if (t > 150_000) return `⚠️ ${pct}% do limite de 200K tokens — considere resumir fontes`
  if (t > 100_000) return `${pct}% do limite de 200K tokens`
  return `${pct}% do limite de 200K tokens — dentro do ideal`
})

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toString()
}

function goToProduce() {
  const id = (dossierId || route.params.id) as string
  if (!id) return
  router.push(`/dossiers/${id}/produce`)
}

onMounted(async () => {
  await loadDossier()
  await loadVisualReferences()
  const tab = route.query.tab as string
  if (tab === 'outputs') activeTab.value = 'outputs'
})
</script>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
