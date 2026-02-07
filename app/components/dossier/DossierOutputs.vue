<template>
  <div class="space-y-10">
    <div class="flex justify-between items-center bg-white/[0.02] p-6 rounded-3xl border border-white/5">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-glow">
          <Film :size="24" />
        </div>
        <div>
          <h3 class="text-xl font-black text-white tracking-tighter uppercase italic">Master Renders</h3>
          <p class="mono-label !text-[9px] opacity-40">{{ outputs.length }} arquivos gerados no pipeline</p>
        </div>
      </div>
      <button @click="$emit('openGenerator')" class="btn-primary !px-8 !py-3 !text-[10px] tracking-widest font-black uppercase">
        <Zap :size="16" />
        Novo Vetor
      </button>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-32 space-y-4">
      <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin shadow-glow"></div>
      <p class="mono-label !text-[10px] animate-pulse">Sincronizando Metadados...</p>
    </div>

    <div v-else-if="outputs.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      <div
        v-for="output in outputs"
        :key="output.id"
        class="glass-card group flex flex-col overflow-hidden border-white/5 hover:border-primary/50 transition-all duration-700"
      >
        <!-- Render Preview Interface -->
        <div class="aspect-video bg-black flex items-center justify-center relative group-hover:scale-105 transition-transform duration-1000">
          <NuxtLink v-if="output.status === 'PENDING' || output.status === 'PROCESSING'" 
               :to="`/outputs/${output.id}`"
               class="absolute inset-0 bg-primary/5 flex flex-col items-center justify-center space-y-4 backdrop-blur-[2px] cursor-pointer hover:bg-primary/10 transition-colors">
            <div class="relative">
              <div class="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="w-1 h-1 bg-primary rounded-full animate-ping"></div>
              </div>
            </div>
            <span class="mono-label !text-[10px] animate-pulse text-primary tracking-[0.3em]">CLICK_TO_MONITOR</span>
          </NuxtLink>
          
          <div v-else-if="output.status === 'FAILED'" class="absolute inset-0 bg-red-500/10 flex flex-col items-center justify-center space-y-2">
            <AlertTriangle :size="32" class="text-red-500" />
            <span class="mono-label !text-[10px] text-red-500">CRITICAL_RENDER_ERROR</span>
          </div>

          <div v-else-if="output.status === 'CANCELLED'" class="absolute inset-0 bg-orange-500/10 flex flex-col items-center justify-center space-y-2">
            <XCircle :size="32" class="text-orange-500" />
            <span class="mono-label !text-[10px] text-orange-500">PIPELINE_CANCELLED</span>
          </div>


          <div v-else class="relative w-full h-full overflow-hidden">
             <!-- Placeholder para vídeo real -->
             <div class="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black opacity-60"></div>
             <PlayCircle :size="48" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 group-hover:text-primary group-hover:scale-110 transition-all duration-500" />
             
             <!-- Overlay de Scanline -->
             <div class="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
          </div>
          
          <!-- Badge de Status (OLED style) -->
          <div class="absolute top-4 right-4">
             <div :class="getStatusClass(output.status)" class="px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border transition-all">
               {{ output.status }}
             </div>
          </div>

          <!-- Timecode Overlay -->
          <div v-if="output.status === 'COMPLETED'" class="absolute bottom-4 left-4 mono-label !text-[9px] bg-black/60 px-2 py-1 rounded border border-white/10">
            TC: 00:00:{{ output.duration < 10 ? '0' + output.duration : output.duration }}:00
          </div>
        </div>

        <!-- Metadata & Controls -->
        <div class="p-6 flex-1 flex flex-col bg-white/[0.02]">
          <div class="flex justify-between items-start mb-6">
            <div class="space-y-1">
              <h4 class="text-lg font-black text-white group-hover:text-primary transition-colors tracking-tight italic uppercase">
                {{ formatOutputType(output.outputType) }}
              </h4>
              <div class="flex items-center gap-2">
                <span class="mono-label !text-[8px] text-zinc-500">{{ output.platform }}</span>
                <span class="text-zinc-700">•</span>
                <span class="mono-label !text-[8px] text-zinc-500">{{ output.aspectRatio }}</span>
              </div>
            </div>
            <div class="text-right">
              <p class="mono-label !text-[10px] text-primary">{{ output.duration }}s</p>
              <p class="text-[8px] font-mono text-zinc-600 uppercase">DURATION</p>
            </div>
          </div>

          <!-- Injected Styles Badges -->
          <div class="flex flex-wrap gap-2 mb-8">
            <div v-if="output.scriptStyleId" class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
              <ScrollText :size="10" class="text-blue-400" />
              <span class="mono-label !text-[8px] !lowercase text-blue-300">{{ output.scriptStyleId }}</span>
            </div>
            <div v-if="output.visualStyleId" class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20">
              <Zap :size="10" class="text-purple-400" />
              <span class="mono-label !text-[8px] !lowercase text-purple-300">{{ output.visualStyleId }}</span>
            </div>
          </div>

          <!-- Action Matrix -->
          <div class="mt-auto grid grid-cols-2 gap-3">
            <template v-if="output.status === 'COMPLETED'">
              <button 
                class="btn-secondary !py-2.5 !text-[10px] font-black flex items-center justify-center gap-2 border-white/10 hover:border-primary/30"
                @click="downloadOutput(output)"
              >
                <Download :size="14" />
                EXCELSIOR
              </button>
              <NuxtLink 
                :to="`/outputs/${output.id}`" 
                class="btn-primary !py-2.5 !text-[10px] font-black flex items-center justify-center gap-2 shadow-none"
              >
                <ExternalLink :size="14" />
                MASTER_VIEW
              </NuxtLink>
            </template>
            <template v-else-if="output.status === 'FAILED'">
              <button 
                class="col-span-2 py-3 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20 transition-all"
                @click="retryOutput(output)"
              >
                REINJECT_PIPELINE
              </button>
            </template>
            <!-- Estado para Script Próximo Estágio (Aguardando Aprovação) -->
            <template v-else-if="!output.scriptApproved && output.status !== 'FAILED'">
              <div class="col-span-2">
                 <div class="py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center mb-3">
                    <ScrollText :size="12" class="mr-2" />
                    Roteiro Aguardando Aprovação
                 </div>
                 <NuxtLink 
                    :to="`/outputs/${output.id}`" 
                    class="btn-primary w-full !py-3 !text-[10px] font-black flex items-center justify-center gap-2"
                 >
                    <ExternalLink :size="14" />
                    REVISAR & APROVAR
                 </NuxtLink>
              </div>
            </template>

            <!-- Estado Padrão (Processando) -->
            <template v-else>
               <div class="col-span-2 grid grid-cols-2 gap-3">
                  <NuxtLink 
                    :to="`/outputs/${output.id}`"
                    class="py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center hover:bg-blue-500/20 transition-all cursor-pointer group/monitor"
                  >
                    <div class="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping mr-2"></div>
                    <span class="group-hover/monitor:hidden">PROCESSING</span>
                    <span class="hidden group-hover/monitor:inline">OPEN MONITOR</span>
                  </NuxtLink>
                  <button 
                    @click="abortOutput(output)"
                    class="py-3 rounded-xl bg-red-900/10 border border-red-500/20 text-red-500/50 hover:text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle :size="12" />
                    Abort
                  </button>
               </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State (Cinematic Version) -->
    <div v-else class="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01]">
      <div class="relative mb-8">
        <Film :size="64" class="text-white/5" />
        <Zap :size="32" class="absolute -top-2 -right-2 text-primary/20 animate-pulse" />
      </div>
      <h3 class="text-2xl font-black text-white/20 tracking-tighter uppercase italic mb-2">Sem produções ativas</h3>
      <p class="mono-label opacity-30 italic max-w-xs text-center leading-relaxed">Inicie o motor Antigravity para gerar versões cinemáticas deste dossier.</p>
      
      <button @click="$emit('openGenerator')" class="btn-primary mt-12 !px-12 !py-4 shadow-glow">
        INICIAR MOTOR DE PRODUÇÃO
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  Film, Zap, Download, ExternalLink, PlayCircle, 
  AlertTriangle, ScrollText, XCircle 
} from 'lucide-vue-next'

const props = defineProps<{
  dossierId: string
}>()

const outputs = ref<any[]>([])
const loading = ref(true)
let pollTimer: any = null

async function loadOutputs() {
  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/outputs`)
    outputs.value = data as any[]
  } catch (error) {
    console.error('Erro ao carregar outputs:', error)
  } finally {
    loading.value = false
  }
}

async function abortOutput(output: any) {
  if (!confirm('Cancelar este pipeline de produção? O processo será interrompido e marcado como cancelado.')) return

  try {
    await $fetch(`/api/outputs/${output.id}/cancel`, { method: 'POST' })
    // Atualizar status localmente para feedback instantâneo
    const index = outputs.value.findIndex(o => o.id === output.id)
    if (index !== -1) {
      outputs.value[index].status = 'CANCELLED'
    }
  } catch (error) {
    console.error('Erro ao cancelar pipeline:', error)
    alert('Erro ao cancelar pipeline. Tente novamente.')
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'FAILED': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'CANCELLED': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'PROCESSING': return 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse'
    case 'PENDING': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
  }
}

function formatOutputType(type: string) {
  return type.replace('VIDEO_', '').replace('_', ' ')
}

function downloadOutput(output: any) {
  window.open(`/api/outputs/${output.id}/download`, '_blank')
}

async function retryOutput(output: any) {
  alert('Re-injeção de pipeline ainda não liberada no core.')
}

// Polling simplificado para atualizar status de processamento
function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    const hasProcessing = outputs.value.some(o => o.status === 'PENDING' || o.status === 'PROCESSING')
    if (hasProcessing) {
      loadOutputs()
    } else {
      // Se não tem nada processando, poll mais devagar só pra garantir?
      // Por enquanto vamos parar pra economizar recursos
      stopPolling()
    }
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  loadOutputs()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

defineExpose({ refresh: loadOutputs })
</script>
