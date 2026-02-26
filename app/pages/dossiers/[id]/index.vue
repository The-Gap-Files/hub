<template>
  <div class="min-h-screen bg-oled-black pb-20 selection:bg-primary/30">
    <!-- Skeleton Loading -->
    <div v-if="loading" class="container mx-auto p-4 md:p-8 max-w-7xl">
      <div class="animate-pulse space-y-6">
        <!-- Skeleton breadcrumb -->
        <div class="h-4 w-48 bg-white/5 rounded-lg"></div>
        <!-- Skeleton title -->
        <div class="space-y-3">
          <div class="h-10 w-3/4 bg-white/5 rounded-xl"></div>
          <div class="h-5 w-1/2 bg-white/[0.03] rounded-lg"></div>
        </div>
        <!-- Skeleton meta bar -->
        <div class="flex gap-6 py-4 border-t border-b border-white/5">
          <div class="h-4 w-24 bg-white/5 rounded"></div>
          <div class="h-4 w-32 bg-white/5 rounded"></div>
          <div class="h-4 w-20 bg-white/5 rounded"></div>
        </div>
        <!-- Skeleton tabs -->
        <div class="flex gap-3">
          <div class="h-10 w-28 bg-white/5 rounded-xl"></div>
          <div class="h-10 w-28 bg-white/[0.03] rounded-xl"></div>
          <div class="h-10 w-28 bg-white/[0.03] rounded-xl"></div>
          <div class="h-10 w-28 bg-white/[0.03] rounded-xl"></div>
        </div>
        <!-- Skeleton content -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-8 space-y-4">
            <div class="h-64 bg-white/[0.03] rounded-2xl border border-white/5"></div>
            <div class="h-40 bg-white/[0.03] rounded-2xl border border-white/5"></div>
          </div>
          <div class="lg:col-span-4 space-y-4">
            <div class="h-36 bg-white/[0.03] rounded-2xl border border-white/5"></div>
            <div class="h-48 bg-white/[0.03] rounded-2xl border border-white/5"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="dossier" class="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <!-- HEADER: Breadcrumb + Title + Theme + Tags + CTA -->
      <header class="mb-8">
        <!-- Linha 1: Breadcrumb + Status -->
        <div class="flex items-center gap-2 mb-4">
          <NuxtLink to="/dossiers" class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cofre</NuxtLink>
          <span class="text-zinc-600 text-xs">/</span>
          <span class="text-xs text-zinc-400">Dossiê</span>
          <span class="text-zinc-600 text-xs">/</span>
          <span class="text-xs text-white/80 truncate max-w-[200px]">{{ dossier.title }}</span>
          <span class="ml-2 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Ativo"></span>
        </div>

        <!-- Linha 2: Título -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-3">
          <h1 class="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
            {{ dossier.title }}
          </h1>
          <div class="flex items-center gap-3 flex-shrink-0">
            <NuxtLink to="/dossiers" class="btn-secondary !py-2 !px-4 !text-xs group/btn">
              <span class="flex items-center gap-1.5">
                <ArrowLeft :size="14" class="group-hover/btn:-translate-x-0.5 transition-transform" />
                Voltar
              </span>
            </NuxtLink>
            <NuxtLink :to="`/dossiers/${dossierId}/produce`" class="btn-primary !py-2 !px-6 !text-xs group/btn inline-flex items-center gap-2">
              <Zap :size="16" class="fill-current" />
              Gerar Vídeo
            </NuxtLink>
          </div>
        </div>

        <!-- Linha 3: Tema -->
        <p class="text-base text-zinc-400 max-w-3xl leading-relaxed mb-4">
          {{ dossier.theme }}
        </p>

        <!-- Linha 4: Tags -->
        <div class="flex flex-wrap gap-1.5 mb-6">
          <span v-for="tag in dossier.tags" :key="tag" 
                class="px-2.5 py-0.5 bg-white/5 border border-white/8 text-white/60 text-xs font-semibold tracking-wide rounded-lg cursor-default">
            #{{ tag }}
          </span>
        </div>

        <!-- Progress Indicator -->
        <div class="flex items-center gap-4 mb-5">
          <div class="flex items-center gap-1.5" :title="(dossier.sources?.length || 0) > 0 ? `${dossier.sources.length} fontes` : 'Adicione fontes'">
            <div class="w-5 h-5 rounded-md flex items-center justify-center" :class="(dossier.sources?.length || 0) > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-zinc-600'">
              <FileText :size="11" />
            </div>
            <span class="text-xs font-medium" :class="(dossier.sources?.length || 0) > 0 ? 'text-emerald-400/80' : 'text-zinc-600'">Fontes</span>
          </div>
          <div class="w-4 h-px bg-white/8"></div>
          <div class="flex items-center gap-1.5" :title="(dossier.notes?.length || 0) > 0 ? `${dossier.notes.length} notas` : 'Execute a Análise Neural'">
            <div class="w-5 h-5 rounded-md flex items-center justify-center" :class="(dossier.notes?.length || 0) > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-zinc-600'">
              <Brain :size="11" />
            </div>
            <span class="text-xs font-medium" :class="(dossier.notes?.length || 0) > 0 ? 'text-emerald-400/80' : 'text-zinc-600'">Análise</span>
          </div>
          <div class="w-4 h-px bg-white/8"></div>
          <div class="flex items-center gap-1.5" :title="(dossier.outputsCount || 0) > 0 ? `${dossier.outputsCount} outputs` : 'Gere vídeos'">
            <div class="w-5 h-5 rounded-md flex items-center justify-center" :class="(dossier.outputsCount || 0) > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-zinc-600'">
              <PlayCircle :size="11" />
            </div>
            <span class="text-xs font-medium" :class="(dossier.outputsCount || 0) > 0 ? 'text-emerald-400/80' : 'text-zinc-600'">Produção</span>
          </div>
        </div>

        <!-- Meta Bar: Canal, Data, Tokens, Custo -->
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/5">
          <!-- Canal -->
          <div class="flex items-center gap-2">
            <Tv :size="13" class="text-zinc-500" />
            <template v-if="dossier.channelName">
              <span class="text-xs text-zinc-300">{{ dossier.channelName }}</span>
              <span v-if="dossier.channelHandle" class="text-xs text-zinc-500">{{ dossier.channelHandle }}</span>
            </template>
            <button v-else @click="showChannelPicker = !showChannelPicker" class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Vincular canal
            </button>
          </div>

          <div class="w-px h-3 bg-white/8"></div>

          <!-- Data -->
          <div class="flex items-center gap-1.5">
            <Clock :size="13" class="text-zinc-500" />
            <span class="text-xs text-zinc-400">{{ formatDate(dossier.updatedAt) }}</span>
          </div>

          <!-- Tokens -->
          <template v-if="dossierTokens > 0">
            <div class="w-px h-3 bg-white/8"></div>
            <div class="flex items-center gap-1.5" :title="tokenTooltip">
              <span class="w-1.5 h-1.5 rounded-full" :class="tokenDotClass"></span>
              <span class="text-xs font-mono" :class="tokenColorClass">~{{ formatTokenCount(dossierTokens) }} tokens</span>
            </div>
          </template>

          <!-- Custo -->
          <template v-if="dossier.totalOutputsCost != null && dossier.totalOutputsCost > 0">
            <div class="w-px h-3 bg-white/8"></div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-emerald-400/80 font-mono">{{ formatCost(dossier.totalOutputsCost) }}</span>
            </div>
          </template>
        </div>

        <!-- Channel Picker -->
        <div v-if="showChannelPicker" class="mt-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
          <select v-model="selectedChannelId" class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none appearance-none cursor-pointer">
            <option value="" class="bg-[#0A0A0F]">Sem canal</option>
            <option v-for="ch in channelOptions" :key="ch.id" :value="ch.id" class="bg-[#0A0A0F]">{{ ch.name }}</option>
          </select>
          <button @click="updateDossierChannel" class="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold rounded-lg transition-all">Salvar</button>
          <button @click="showChannelPicker = false" class="text-zinc-500 text-xs hover:text-white transition-colors">Cancelar</button>
        </div>
      </header>

      <!-- TABS: Conteúdo / Inteligência / Monetização / Produção -->
      <nav class="flex flex-wrap items-center gap-2 mb-8">
        <button v-for="tab in workspaceTabs" :key="tab.id"
          @click="switchTab(tab.id)"
          :class="[
            'px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 border flex items-center gap-2 cursor-pointer',
            activeTab === tab.id 
              ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.15)]' 
              : 'bg-white/[0.03] text-zinc-400 border-white/8 hover:border-white/15 hover:text-zinc-200 hover:bg-white/[0.06]'
          ]"
        >
          <component :is="tab.icon" :size="14" />
          {{ tab.name }}
          <span v-if="tab.count && tab.count > 0" class="ml-1 text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded-md font-mono">
            {{ tab.count }}
          </span>
        </button>
      </nav>

      <!-- CONTENT AREA with tab transitions -->
      <main>
        <!-- Tab: Conteúdo -->
        <Transition name="tab-fade" mode="out-in">
          <div v-if="activeTab === 'content'" key="content" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Main Column -->
            <div class="lg:col-span-8 space-y-6">
              <!-- Fontes do Dossiê (unificado) -->
              <DossierSources 
                :dossier-id="dossierId" 
                :initial-sources="dossier.sources || []" 
                @updated="loadDossier"
              />
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-4 space-y-6">
              <!-- Universo Visual -->
              <section class="glass-card p-1 rounded-2xl">
                <div class="p-4 pb-3 flex justify-between items-center border-b border-white/5">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <Palette :size="13" />
                    </div>
                    <h3 class="text-xs font-bold text-white">Universo Visual</h3>
                  </div>
                  <button 
                    v-if="!editingVisualSettings"
                    @click="startEditingVisualSettings"
                    class="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                    Editar
                  </button>
                </div>
                
                <div class="p-4">
                  <!-- Modo Visualização Compacto -->
                  <div v-if="!editingVisualSettings" class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-zinc-500 font-medium">Estilo</span>
                      <span class="text-xs text-white">{{ getVisualStyleName(dossier.preferredVisualStyleId) || 'Sistema' }}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-zinc-500 font-medium">DNA Seed</span>
                      <span class="text-xs text-white font-mono">{{ getSeedValue(dossier.preferredSeedId) || 'Auto' }}</span>
                    </div>
                    <div v-if="dossier.visualIdentityContext" class="pt-2 border-t border-white/5">
                      <span class="text-xs text-zinc-500 font-medium block mb-1">Diretrizes</span>
                      <p class="text-xs text-zinc-400 italic leading-relaxed line-clamp-3">
                        "{{ dossier.visualIdentityContext }}"
                      </p>
                    </div>
                  </div>
                  
                  <!-- Modo Edição -->
                  <div v-else class="space-y-4">
                    <div class="space-y-1.5">
                      <label class="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
                        <Palette :size="10" />
                        Estilo Visual
                      </label>
                      <select 
                        v-model="visualSettingsForm.preferredVisualStyleId"
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                        <option value="" class="bg-[#0A0A0F]">Nenhum (Sistema)</option>
                        <option v-for="style in visualStyles" :key="style.id" :value="style.id" class="bg-[#0A0A0F]">{{ style.name }}</option>
                      </select>
                    </div>
                    
                    <div class="space-y-1.5">
                      <label class="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
                        <Dna :size="10" />
                        Seed DNA
                      </label>
                      <select 
                        v-model="visualSettingsForm.preferredSeedId"
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                        <option value="" class="bg-[#0A0A0F]">Nova Seed Aleatória</option>
                        <option v-for="seed in allSeeds" :key="seed.id" :value="seed.id" class="bg-[#0A0A0F]">DNA {{ seed.value }}</option>
                      </select>
                    </div>
                    
                    <div class="space-y-1.5">
                      <label class="text-xs text-zinc-500 font-medium flex items-center gap-1.5 group/info relative">
                        Diretrizes de Identidade
                        <HelpCircle :size="12" class="text-zinc-600 hover:text-primary cursor-help transition-colors" />
                        
                        <!-- Tooltip -->
                        <div class="absolute left-0 bottom-full mb-2 w-64 p-3 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all z-50 transform translate-y-2 group-hover/info:translate-y-0">
                          <p class="text-[10px] leading-relaxed text-zinc-300 normal-case tracking-normal font-normal">
                            <strong class="text-primary block mb-1">A âncora visual do seu universo.</strong>
                            Este campo injeta diretrizes estéticas diretas em cada imagem gerada (concreto, ferrugem, iluminação). Garante que a identidade do dossiê seja preservada mesmo em cenas complexas.
                          </p>
                        </div>
                      </label>
                      <textarea
                        v-model="visualSettingsForm.visualIdentityContext"
                        rows="2"
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-primary outline-none transition-all resize-none custom-scrollbar"
                        placeholder="Ex: Universo Noir, evite cores vibrantes...">
                      </textarea>
                    </div>
                    
                    <div class="flex gap-2 pt-2 border-t border-white/5">
                      <button 
                        @click="saveVisualSettings"
                        :disabled="savingVisualSettings"
                        class="flex-1 px-3 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                        <span v-if="!savingVisualSettings">Salvar</span>
                        <span v-else class="flex items-center gap-1.5">
                          <div class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          Salvando...
                        </span>
                      </button>
                      <button 
                        @click="cancelEditingVisualSettings"
                        :disabled="savingVisualSettings"
                        class="px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                        Cancelar
                      </button>
                    </div>
                    
                    <div v-if="visualSettingsSaved" class="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span class="text-xs font-medium text-emerald-400">Atualizado!</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Imagens -->
              <DossierImages 
                :dossier-id="dossierId" 
                :initial-images="dossier.images || []" 
                @updated="loadDossier"
              />
            </div>
          </div>
        </Transition>

        <!-- Tab: Inteligência -->
        <Transition name="tab-fade" mode="out-in">
          <div v-if="activeTab === 'intelligence'" key="intelligence">
            <DossierIntelligenceCenter
              :dossier-id="dossierId"
              :initial-notes="dossier.notes || []"
              :initial-persons="dossier.persons || []"
              @updated="loadDossier"
            />

          </div>
        </Transition>

        <!-- Tab: Monetização -->
        <Transition name="tab-fade" mode="out-in">
          <div v-if="activeTab === 'monetization'" key="monetization">
            <DossierMonetization :dossier-id="dossierId" />
          </div>
        </Transition>

        <!-- Tab: Escritor Chefe -->
        <Transition name="tab-fade" mode="out-in">
          <div v-if="activeTab === 'escritor-chefe'" key="escritor-chefe">
            <DossierEscritorChefe :dossier-id="dossierId" />
          </div>
        </Transition>

        <!-- Tab: Produção -->
        <Transition name="tab-fade" mode="out-in">
          <div v-if="activeTab === 'outputs'" key="outputs">
            <DossierOutputs 
              ref="outputsComponent"
              :dossier-id="dossierId" 
              @open-generator="goToProduce"
            />
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeft, Zap, FileText, Database, Palette, AlertTriangle, Dna, Tv,
  LayoutDashboard, PlayCircle, TrendingUp, Brain, Clock, Maximize2, Minimize2,
  Link as LinkIcon,
  Target, Eye, EyeOff, Layers, BookOpen, GraduationCap, Heart, Flame, Swords,
  HelpCircle, RotateCw
} from 'lucide-vue-next'
import DossierSources from '~/components/dossier/DossierSources.vue'
import DossierImages from '~/components/dossier/DossierImages.vue'
import DossierIntelligenceCenter from '~/components/dossier/DossierIntelligenceCenter.vue'
import DossierOutputs from '~/components/dossier/DossierOutputs.vue'
import DossierMonetization from '~/components/dossier/DossierMonetization.vue'
import DossierEscritorChefe from '~/components/dossier/DossierEscritorChefe.vue'

const route = useRoute()
const router = useRouter()
const dossierId = route.params.id as string

const dossier = ref<any>(null)
const loading = ref(true)
const activeTab = ref('content')
const outputsComponent = ref<any>(null)
const showFullDocument = ref(false)
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

// Channel
const showChannelPicker = ref(false)
const selectedChannelId = ref('')
const channelOptions = ref<{ id: string; name: string }[]>([])

// Tab definitions with dynamic counts
const workspaceTabs = computed(() => [
  { 
    id: 'content', 
    name: 'Conteúdo', 
    icon: FileText, 
    count: (dossier.value?.sources?.length || 0) + (dossier.value?.images?.length || 0)
  },
  { 
    id: 'intelligence', 
    name: 'Inteligência', 
    icon: Brain, 
    count: (dossier.value?.notes?.length || 0) + (dossier.value?.persons?.length || 0)
  },
  {
    id: 'escritor-chefe',
    name: 'Escritor Chefe',
    icon: BookOpen,
    count: 0
  },
  {
    id: 'monetization',
    name: 'Monetização',
    icon: TrendingUp,
    count: 0
  },
  {
    id: 'outputs',
    name: 'Produção',
    icon: PlayCircle,
    count: dossier.value?.outputsCount || 0
  }
])

function switchTab(tabId: string) {
  activeTab.value = tabId
}

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
  if (dossier.value.sources?.length) {
    for (const source of dossier.value.sources) {
      total += estimateTokens(source.content || '')
      total += estimateTokens(source.title || '')
    }
  }
  if (dossier.value.notes?.length) {
    for (const note of dossier.value.notes) {
      total += estimateTokens(note.content || '')
    }
  }
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
  if (t > 150_000) return `${pct}% do limite de 200K tokens — considere resumir fontes`
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
  await loadChannelOptions()
  selectedChannelId.value = dossier.value?.channelId || ''
  const tab = route.query.tab as string
  if (tab === 'outputs') activeTab.value = 'outputs'
  if (tab === 'intelligence') activeTab.value = 'intelligence'
})

async function loadChannelOptions() {
  try {
    const res = await $fetch<any>('/api/channels')
    channelOptions.value = (res.channels || []).map((ch: any) => ({ id: ch.id, name: ch.name }))
  } catch { /* silencioso */ }
}

async function updateDossierChannel() {
  try {
    await $fetch(`/api/dossiers/${dossierId}`, {
      method: 'PATCH',
      body: { channelId: selectedChannelId.value || null }
    })
    await loadDossier()
    showChannelPicker.value = false
  } catch (err: any) {
    alert(err?.data?.message || 'Erro ao atualizar canal')
  }
}

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

/* Tab transition */
.tab-fade-enter-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.tab-fade-leave-active {
  transition: opacity 150ms ease;
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.tab-fade-leave-to {
  opacity: 0;
}
</style>
