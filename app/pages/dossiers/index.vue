<template>
  <div class="container mx-auto p-8 max-w-7xl">
    <header class="flex flex-col md:flex-row justify-between items-end gap-6 mb-16 relative group">
      <div class="absolute -inset-x-8 -top-8 h-40 bg-gradient-to-b from-primary/5 to-transparent blur-3xl opacity-50"></div>
      
      <div class="relative space-y-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-glow">
            <Library :size="24" />
          </div>
          <span class="mono-label tracking-[0.4em] text-primary/60">Intelligence Hub</span>
        </div>
        <h1 class="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
          Dossiers
        </h1>
        <p class="text-zinc-500 font-medium max-w-md">Nexus central de inteligência e vetores de produção documental.</p>
      </div>

        <div class="flex gap-2">
            <button
                @click="openNewsRadar"
                class="btn-secondary !px-4 !py-4 shadow-glow group/btn border-primary/20 text-primary hover:bg-primary/10"
                title="Interceptar Sinais Globais"
            >
                <Radio :size="20" class="group-hover/btn:scale-110 transition-transform duration-500" />
            </button>
            <NuxtLink to="/dossiers/new" class="btn-primary !px-10 !py-4 shadow-glow group/btn">
            <span class="flex items-center gap-3">
                <FilePlus :size="20" class="group-hover/btn:rotate-90 transition-transform duration-500" />
                INICIAR NOVA INVESTIGAÇÃO
            </span>
            </NuxtLink>
        </div>
    </header>

    <!-- News Radar Modal -->
    <div v-if="showNewsModal" class="fixed inset-0 z-50 flex items-center justify-center p-8 backdrop-blur-md bg-black/80" @click.self="showNewsModal = false">
        <div class="w-full max-w-5xl h-[85vh] bg-[#09090b] border border-white/10 rounded-3xl flex flex-col shadow-2xl relative overflow-hidden">
            <!-- Header -->
            <div class="p-6 border-b border-white/10 bg-white/[0.02]">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 animate-pulse">
                            <Radio :size="20" />
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white tracking-tight uppercase">Radar de Inteligência</h2>
                            <p class="text-xs text-zinc-500 mono-label tracking-widest">
                              {{ filteredNews.length }} sinais interceptados
                              <span v-if="refreshingNews" class="text-emerald-500 animate-pulse ml-2">● scanning...</span>
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button 
                            @click="refreshNewsRadar" 
                            :disabled="refreshingNews"
                            class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all disabled:opacity-30"
                            title="Atualizar feeds"
                        >
                            <Loader2 v-if="refreshingNews" :size="14" class="animate-spin" />
                            <Radio v-else :size="14" />
                        </button>
                        <button @click="showNewsModal = false" class="text-zinc-500 hover:text-white transition-colors">
                            <X :size="24" />
                        </button>
                    </div>
                </div>
                <!-- Category Filters -->
                <div class="flex gap-2 flex-wrap">
                    <button
                        v-for="cat in newsCategories"
                        :key="cat.id"
                        @click="selectedNewsCategory = selectedNewsCategory === cat.id ? '' : cat.id"
                        :class="[
                            'px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all',
                            selectedNewsCategory === cat.id
                                ? `${cat.activeClass} border-current`
                                : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
                        ]"
                    >
                        {{ cat.icon }} {{ cat.label }}
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
                <div v-if="loadingNews" class="col-span-full flex flex-col items-center justify-center py-20 space-y-4">
                     <Loader2 :size="40" class="animate-spin text-emerald-500" />
                     <p class="text-emerald-500/50 mono-label animate-pulse">Scanning frequencies...</p>
                </div>

                <div v-else-if="filteredNews.length === 0" class="col-span-full flex flex-col items-center justify-center py-20 space-y-4">
                     <Radio :size="40" class="text-zinc-700" />
                     <p class="text-zinc-600 mono-label">Nenhum sinal nesta frequência.</p>
                </div>
                
                <div 
                    v-else 
                    v-for="(item, idx) in filteredNews" 
                    :key="idx" 
                    class="bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] p-5 rounded-xl flex flex-col gap-3 group transition-all duration-300"
                >
                    <div class="flex justify-between items-start gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span :class="getCategoryBadgeClass(item.category)" class="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded">{{ item.category }}</span>
                            <span class="text-[10px] text-zinc-600">{{ item.source }}</span>
                            <span v-if="item.publishedAt" class="text-[10px] text-zinc-600">· {{ formatNewsDate(item.publishedAt) }}</span>
                        </div>
                        <a :href="item.link" target="_blank" class="text-zinc-600 hover:text-emerald-400 transition-colors shrink-0"><ExternalLink :size="14" /></a>
                    </div>
                    
                    <h3 class="text-white text-base leading-tight group-hover:text-emerald-400 transition-colors line-clamp-3 font-semibold">
                        {{ item.title }}
                    </h3>
                    
                    <p class="text-zinc-500 text-xs line-clamp-3 leading-relaxed">
                        {{ item.summary }}
                    </p>

                    <div class="mt-auto pt-3">
                        <button 
                            @click="investigateSignal(item)"
                            class="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                            <Files :size="14" />
                            Investigar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-40 space-y-6">
      <div class="relative">
        <div class="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-2 h-2 bg-primary rounded-full animate-ping"></div>
        </div>
      </div>
      <p class="mono-label !text-xs text-primary animate-pulse tracking-[0.3em]">DECIPHERING_DATABASE...</p>
    </div>

    <div v-else-if="dossiers.length === 0" class="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01]">
       <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-8 text-white/5">
         <FolderOpen :size="48" />
       </div>
       <h3 class="text-2xl font-black text-white/30 uppercase italic mb-2">Shadow Void</h3>
       <p class="mono-label opacity-40 italic max-w-xs text-center">Nenhum rastro de inteligência encontrado nos servidores locais.</p>
       <NuxtLink to="/dossiers/new" class="btn-secondary mt-10 !px-12">
         Forjar Investigação
       </NuxtLink>
    </div>

    <div v-else class="grid gap-6">
      <div
        v-for="dossier in dossiers"
        :key="dossier.id"
        class="glass-card group relative p-8 hover:border-primary/50 transition-all duration-700 cursor-pointer overflow-hidden"
        @click="navigateTo(`/dossiers/${dossier.id}`)"
      >
        <!-- Background Reveal (Cinematic) -->
        <div class="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        
        <div class="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div class="flex-1 space-y-4">
            <div class="flex items-center gap-3">
              <span class="mono-label px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md text-primary group-hover:bg-primary group-hover:text-white transition-all">ID: {{ dossier.id.slice(0, 8) }}</span>
              <span v-if="dossier.category" class="mono-label text-zinc-600 group-hover:text-zinc-400 transition-colors">{{ dossier.category }}</span>
              <span v-if="dossier.channelName" class="mono-label px-1.5 py-0.5 bg-blue-400/10 border border-blue-400/20 rounded text-blue-400/70 ">{{ dossier.channelName }}</span>
              <span class="text-zinc-800">•</span>
              <span class="mono-label text-zinc-600">{{ new Date(dossier.createdAt).toLocaleDateString('pt-BR') }}</span>
            </div>
            
            <div>
              <h3 class="text-3xl font-black text-white tracking-tighter uppercase italic group-hover:text-primary transition-colors leading-none mb-3">
                {{ dossier.title }}
              </h3>
              <p class="text-zinc-500 font-medium line-clamp-2 max-w-3xl leading-relaxed">
                {{ dossier.theme }}
              </p>
            </div>
            
            <div class="flex flex-wrap gap-6 pt-2">
              <div class="flex items-center gap-2 group/stat">
                <Database :size="14" class="text-zinc-700 group-hover/stat:text-white transition-colors" />
                <span class="mono-label  text-zinc-500 group-hover/stat:text-white transition-colors">{{ dossier.sourcesCount || 0 }} <span class="opacity-30">fontes</span></span>
              </div>
              <div class="flex items-center gap-2 group/stat">
                <ImageIcon :size="14" class="text-zinc-700 group-hover/stat:text-white transition-colors" />
                <span class="mono-label  text-zinc-500 group-hover/stat:text-white transition-colors">{{ dossier.imagesCount || 0 }} <span class="opacity-30">assets</span></span>
              </div>
              <div class="flex items-center gap-2 group/stat">
                <Brain :size="14" class="text-zinc-700 group-hover/stat:text-white transition-colors" />
                <span class="mono-label  text-zinc-500 group-hover/stat:text-white transition-colors">{{ dossier.notesCount || 0 }} <span class="opacity-30">insights</span></span>
              </div>
              <div class="flex items-center gap-2 group/stat border-l border-white/5 pl-6">
                <Film :size="14" class="text-primary group-hover/stat:text-primary-foreground transition-colors" />
                <span class="mono-label  text-primary group-hover/stat:text-primary transition-colors">{{ dossier.outputsCount || 0 }} <span class="opacity-40 uppercase">renders</span></span>
              </div>
              <div v-if="dossier.totalOutputsCost != null && dossier.totalOutputsCost > 0" class="flex items-center gap-2 group/stat border-l border-white/5 pl-6">
                <span class="mono-label  text-emerald-400/90 group-hover/stat:text-emerald-400 transition-colors">{{ formatCost(dossier.totalOutputsCost) }}</span>
                <span class="opacity-40 uppercase ">custo</span>
              </div>
            </div>
          </div>

          <div class="flex gap-2 self-end md:self-center opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
            <!-- Delete Button (só aparece se não tem fontes) -->
            <button
              v-if="(dossier.sourcesCount || 0) === 0"
              @click.stop="confirmDelete(dossier)"
              class="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 transition-all duration-300"
              title="Deletar dossiê (sem fontes)"
            >
              <Trash2 :size="18" />
            </button>
            <div class="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-glow">
              <ChevronRight :size="24" />
            </div>
          </div>
        </div>
        
        <!-- Animated Scanline on Hover -->
        <div class="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-5 transition-opacity duration-1000 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      </div>
    </div>

    <!-- Paginação (Cyber Matrix Style) -->
    <div v-if="total > pageSize" class="flex justify-center items-center gap-6 mt-20">
      <button
        @click="changePage(page - 1)"
        :disabled="page === 1"
        class="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/10 transition-all"
      >
        <ChevronLeft :size="20" />
      </button>
      
      <div class="flex flex-col items-center">
        <span class="mono-label  text-primary tracking-[0.2em]">Matrix Sector</span>
        <span class="text-lg font-black text-white italic">
           {{ page }} / {{ Math.ceil(total / pageSize) }}
        </span>
      </div>

      <button
        @click="changePage(page + 1)"
        :disabled="page >= Math.ceil(total / pageSize)"
        class="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/10 transition-all"
      >
        <ChevronRight :size="20" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  Library, FilePlus, Database, Image as ImageIcon, 
  Brain, Film, ChevronRight, FolderOpen,
  ChevronLeft, Trash2, Radio, X, Loader2, ExternalLink, Files
} from 'lucide-vue-next'

interface ChannelOption {
  id: string
  name: string
}

const dossiers = ref<any[]>([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectedChannelId = ref('')
const channelOptions = ref<ChannelOption[]>([])
const deleting = ref<string | null>(null)
const showNewsModal = ref(false)
const newsItems = ref<any[]>([])
const loadingNews = ref(false)
const router = useRouter()
const selectedNewsCategory = ref('')

const newsCategories = [
  { id: 'paranormal', label: 'Paranormal', icon: '👁️', activeClass: 'bg-purple-500/20 text-purple-400' },
  { id: 'science', label: 'Ciência', icon: '🔬', activeClass: 'bg-cyan-500/20 text-cyan-400' },
  { id: 'true-crime', label: 'True Crime', icon: '🔪', activeClass: 'bg-red-500/20 text-red-400' },
  { id: 'serial-killer', label: 'Serial Killers', icon: '💀', activeClass: 'bg-rose-500/20 text-rose-400' },
  { id: 'journalism', label: 'Jornalismo', icon: '📰', activeClass: 'bg-amber-500/20 text-amber-400' },
  { id: 'geopolitics', label: 'Geopolítica', icon: '🌐', activeClass: 'bg-blue-500/20 text-blue-400' },
  { id: 'weird', label: 'Bizarro', icon: '🤡', activeClass: 'bg-pink-500/20 text-pink-400' },
]

const filteredNews = computed(() => {
  if (!selectedNewsCategory.value) return newsItems.value
  return newsItems.value.filter((item: any) => item.category === selectedNewsCategory.value)
})

function formatNewsDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffHours < 1) return 'agora'
    if (diffHours < 24) return `há ${diffHours}h`
    if (diffDays < 7) return `há ${diffDays}d`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

function getCategoryBadgeClass(category: string): string {
  const map: Record<string, string> = {
    'paranormal': 'bg-purple-500/20 text-purple-400',
    'science': 'bg-cyan-500/20 text-cyan-400',
    'true-crime': 'bg-red-500/20 text-red-400',
    'serial-killer': 'bg-rose-500/20 text-rose-400',
    'journalism': 'bg-amber-500/20 text-amber-400',
    'geopolitics': 'bg-blue-500/20 text-blue-400',
    'weird': 'bg-pink-500/20 text-pink-400',
  }
  return map[category] || 'bg-white/10 text-zinc-400'
}

async function confirmDelete(dossier: any) {
  const confirmed = window.confirm(`Deletar o dossiê "${dossier.title}"?\n\nEsta ação é irreversível.`)
  if (!confirmed) return

  deleting.value = dossier.id
  try {
    await $fetch(`/api/dossiers/${dossier.id}`, { method: 'DELETE' })
    // Remover da lista local imediatamente (otimistic)
    dossiers.value = dossiers.value.filter(d => d.id !== dossier.id)
    total.value = Math.max(0, total.value - 1)
  } catch (error: any) {
    const msg = error?.data?.message || 'Erro ao deletar dossiê'
    alert(msg)
  } finally {
    deleting.value = null
  }
}

async function loadChannels() {
  try {
    const response = await $fetch<any>('/api/channels')
    channelOptions.value = response.channels.map((ch: any) => ({ id: ch.id, name: ch.name }))
  } catch {
    // silencioso
  }
}

async function loadDossiers() {
  loading.value = true
  try {
    const query: Record<string, any> = { page: page.value, pageSize: pageSize.value }
    if (selectedChannelId.value) query.channelId = selectedChannelId.value

    const response = await $fetch('/api/dossiers', { query })
    dossiers.value = (response as any).dossiers
    total.value = (response as any).total
  } catch (error) {
    console.error('Erro ao carregar dossiers:', error)
  } finally {
    loading.value = false
  }
}

function onChannelFilterChange() {
  page.value = 1
  loadDossiers()
}

function changePage(newPage: number) {
  if (newPage < 1 || newPage > Math.ceil(total.value / pageSize.value)) return
  page.value = newPage
  loadDossiers()
}

function formatCost(totalCost: number): string {
  if (totalCost >= 0.01) return `$${totalCost.toFixed(2)}`
  if (totalCost > 0) return `$${totalCost.toFixed(4)}`
  return '$0.00'
}

const refreshingNews = ref(false)

async function openNewsRadar() {
    showNewsModal.value = true
    if (newsItems.value.length === 0) {
        // Primeira abertura: carregar do cache (banco) instantaneamente
        loadingNews.value = true
        try {
            const cached = await $fetch<any>('/api/intelligence/news')
            newsItems.value = cached.data
        } catch (e) {
            // Cache vazio, vai direto pro refresh
        } finally {
            loadingNews.value = false
        }
    }
    // Sempre buscar novos sinais dos feeds em background
    refreshNewsRadar()
}

async function refreshNewsRadar() {
    refreshingNews.value = true
    try {
        const res = await $fetch<any>('/api/intelligence/news', { query: { refresh: 'true' } })
        newsItems.value = res.data
    } catch (e) {
        if (newsItems.value.length === 0) {
            alert('Falha ao conectar com satélites de notícias.')
        }
    } finally {
        refreshingNews.value = false
    }
}

async function investigateSignal(item: any) {
    // Criar dossier automaticamente e redirecionar
    if (!confirm(`Iniciar investigação sobre: "${item.title}"?`)) return
    
    try {
        const payload = {
            title: item.title,
            theme: item.summary ? `${item.summary}\n\nSource: ${item.link}` : `Investigation based on: ${item.link}`,
            tags: ['AUTO-INTEL', item.source],
            visualIdentityContext: 'Documentary/Investigative',
        }
        
        const res = await $fetch<any>('/api/dossiers', {
            method: 'POST',
            body: payload
        })
        
        // Adicionar o link como fonte automaticamente
        await $fetch(`/api/dossiers/${res.id}/sources`, {
            method: 'POST',
            body: {
                title: 'Primary Signal Source',
                content: item.link, // URL vai aqui, o backend pode extrair depois se tiver scraper
                sourceType: 'ARTICLE',
                url: item.link,
                author: item.author || item.source
            }
        })

        showNewsModal.value = false
        router.push(`/dossiers/${res.id}`)
    } catch (e) {
        console.error(e)
        alert('Erro ao iniciar investigação.')
    }
}

onMounted(() => {
  loadChannels()
  loadDossiers()
})
</script>

<style scoped>
.channel-filter {
  @apply bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all duration-300 cursor-pointer appearance-none;
  @apply hover:border-primary/30 focus:border-primary/50;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.25em 1.25em;
  padding-right: 2rem;
}.channel-filter option {
  @apply bg-[#0C0C12] text-white;
}
</style>
