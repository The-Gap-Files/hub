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

      <div class="relative flex items-center gap-4">
        <!-- Channel Filter -->
        <select v-model="selectedChannelId" @change="onChannelFilterChange" class="channel-filter">
          <option value="">Todos os canais</option>
          <option v-for="ch in channelOptions" :key="ch.id" :value="ch.id">{{ ch.name }}</option>
        </select>

        <NuxtLink to="/dossiers/new" class="btn-primary !px-10 !py-4 shadow-glow group/btn">
          <span class="flex items-center gap-3">
            <FilePlus :size="20" class="group-hover/btn:rotate-90 transition-transform duration-500" />
            INICIAR NOVA INVESTIGAÇÃO
          </span>
        </NuxtLink>
      </div>
    </header>

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
              <span v-if="dossier.channelName" class="mono-label px-1.5 py-0.5 bg-blue-400/10 border border-blue-400/20 rounded text-blue-400/70 !text-[9px]">{{ dossier.channelName }}</span>
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
                <span class="mono-label !text-[10px] text-zinc-500 group-hover/stat:text-white transition-colors">{{ dossier.sourcesCount || 0 }} <span class="opacity-30">fontes</span></span>
              </div>
              <div class="flex items-center gap-2 group/stat">
                <ImageIcon :size="14" class="text-zinc-700 group-hover/stat:text-white transition-colors" />
                <span class="mono-label !text-[10px] text-zinc-500 group-hover/stat:text-white transition-colors">{{ dossier.imagesCount || 0 }} <span class="opacity-30">assets</span></span>
              </div>
              <div class="flex items-center gap-2 group/stat">
                <Brain :size="14" class="text-zinc-700 group-hover/stat:text-white transition-colors" />
                <span class="mono-label !text-[10px] text-zinc-500 group-hover/stat:text-white transition-colors">{{ dossier.notesCount || 0 }} <span class="opacity-30">insights</span></span>
              </div>
              <div class="flex items-center gap-2 group/stat border-l border-white/5 pl-6">
                <Film :size="14" class="text-primary group-hover/stat:text-primary-foreground transition-colors" />
                <span class="mono-label !text-[10px] text-primary group-hover/stat:text-primary transition-colors">{{ dossier.outputsCount || 0 }} <span class="opacity-40 uppercase">renders</span></span>
              </div>
              <div v-if="dossier.totalOutputsCost != null && dossier.totalOutputsCost > 0" class="flex items-center gap-2 group/stat border-l border-white/5 pl-6">
                <span class="mono-label !text-[10px] text-emerald-400/90 group-hover/stat:text-emerald-400 transition-colors">{{ formatCost(dossier.totalOutputsCost) }}</span>
                <span class="opacity-40 uppercase !text-[9px]">custo</span>
              </div>
            </div>
          </div>

          <div class="flex gap-2 self-end md:self-center opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
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
        <span class="mono-label !text-[10px] text-primary tracking-[0.2em]">Matrix Sector</span>
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
  ChevronLeft
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
