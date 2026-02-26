<template>
  <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
    <div>
      <div class="flex items-center gap-3 mb-2">
        <span class="px-2 py-1 bg-white/10 rounded text-xs font-black tracking-widest uppercase text-white/70">
          {{ output.outputType }}
        </span>
        <span v-if="output.status" :class="getStatusClass(output.status)" class="px-2 py-1 rounded text-xs font-black tracking-widest uppercase border">
          {{ output.status }}
        </span>
      </div>
      <h1 class="text-4xl md:text-5xl font-black tracking-tighter text-white italic uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
        {{ output.title || 'Sem Título' }}
      </h1>
      <p class="text-zinc-500 mt-2 text-sm max-w-2xl px-1">
        {{ output.dossier?.title }} • {{ output.platform }} • {{ output.aspectRatio }}
      </p>

      <!-- Cost Badge -->
      <div v-if="totalCost > 0" class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <DollarSign :size="14" class="text-amber-400" />
        <span class="text-amber-300 text-sm font-mono font-bold">{{ formatCost(totalCost) }}</span>
        <span class="text-amber-400/50 text-xs uppercase tracking-widest">gasto neste output</span>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="flex gap-4 flex-wrap">
       <button v-if="output.status === 'COMPLETED'" @click="$emit('downloadMaster')" class="btn-primary flex items-center gap-2">
         <Download :size="16" />
         BAIXAR MASTER
       </button>
       <button v-else-if="output.status === 'FAILED'" class="btn-secondary text-red-400 border-red-500/30 flex items-center gap-2">
         <RotateCw :size="16" />
         RETRY
       </button>

       <!-- Correction Mode -->
       <button
          v-if="output.status === 'COMPLETED' && !correctionMode"
          @click="$emit('enterCorrectionMode')"
          :disabled="enteringCorrections"
          class="btn-secondary flex items-center gap-2 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
        >
          <Wrench :size="16" :class="enteringCorrections ? 'animate-spin' : ''" />
          <span>{{ enteringCorrections ? 'ATIVANDO...' : 'MODO CORREÇÃO' }}</span>
        </button>

       <!-- Render Again -->
       <button
          v-if="(output.status === 'COMPLETED' || output.status === 'RENDERED' || output.status === 'FAILED') && !correctionMode"
          @click="$emit('renderAgain')"
          :disabled="rendering"
          class="btn-secondary flex items-center gap-2 text-xs"
        >
          <Film :size="16" :class="rendering ? 'animate-spin' : ''" />
          <span>{{ rendering ? 'RENDERIZANDO...' : 'RENDERIZAR NOVAMENTE' }}</span>
        </button>

       <!-- Reset Output -->
       <button
          v-if="!correctionMode"
          @click="$emit('resetOutput')"
          :disabled="reverting || approving"
          class="btn-secondary flex items-center gap-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
        >
          <Undo2 :size="16" />
          Resetar output
       </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Download, RotateCw, Film, DollarSign, Wrench, Undo2 } from 'lucide-vue-next'
import type { OutputData } from '~/types/output'

defineProps<{
  output: OutputData
  totalCost: number
  correctionMode: boolean
  enteringCorrections: boolean
  rendering: boolean
  reverting: boolean
  approving: boolean
  formatCost: (v: number) => string
  getStatusClass: (status: string) => string
}>()

defineEmits<{
  downloadMaster: []
  enterCorrectionMode: []
  renderAgain: []
  resetOutput: []
}>()
</script>
