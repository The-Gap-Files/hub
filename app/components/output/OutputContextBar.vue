<template>
  <div
    class="sticky top-0 z-30 -mx-6 px-6 py-4 mb-8 rounded-2xl border border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl shadow-lg transition-colors duration-200"
    role="region"
    aria-label="Resumo e constantes do output"
  >
    <div class="flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
      <!-- Summary -->
      <div class="min-w-0 flex-1 sm:max-w-xl">
        <p class="mono-label text-xs text-zinc-500 uppercase tracking-widest mb-1">Summary</p>
        <p class="text-sm text-zinc-300 italic leading-relaxed truncate" :title="summary ?? undefined">
          {{ summary || '—' }}
        </p>
      </div>
      <!-- Metrics -->
      <div class="flex items-center gap-6 sm:gap-8 flex-shrink-0">
        <div>
          <p class="mono-label text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Duration</p>
          <p class="text-lg font-mono font-bold text-white">{{ duration }}s</p>
        </div>
        <div>
          <p class="mono-label text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Word count</p>
          <p class="text-lg font-mono font-bold text-white">{{ wordCount ?? '—' }} <span class="text-zinc-500 text-sm font-normal">words</span></p>
        </div>
        <div>
          <p class="mono-label text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Scene count</p>
          <p class="text-lg font-mono font-bold text-white">{{ sceneCount }} <span class="text-zinc-500 text-sm font-normal">scenes</span></p>
        </div>
        <!-- Export JSON -->
        <button
          v-if="sceneCount > 0"
          @click="$emit('exportJson')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-white/10 text-zinc-300 text-xs font-medium hover:bg-zinc-700/80 hover:text-white hover:border-white/20 transition-all duration-200 cursor-pointer"
          title="Exportar cenas como JSON (sem imagens/audio)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export JSON
        </button>
      </div>
      <!-- Constants -->
      <div class="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0 sm:border-l sm:border-white/10 sm:pl-6">
        <span class="mono-label text-xs text-zinc-500 uppercase tracking-widest w-full sm:w-auto mb-0.5 sm:mb-0">Constantes escolhidas</span>
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="classification" class="inline-flex items-center px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-medium transition-colors duration-200 hover:bg-amber-500/15 cursor-default">{{ classification }}</span>
          <span v-if="scriptStyleName" class="inline-flex items-center px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium transition-colors duration-200 hover:bg-primary/15 cursor-default">{{ scriptStyleName }}</span>
          <span v-if="visualStyleName" class="inline-flex items-center px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs font-medium transition-colors duration-200 hover:bg-purple-500/15 cursor-default">{{ visualStyleName }}</span>
          <span v-if="!classification && !scriptStyleName && !visualStyleName" class="text-zinc-500 text-xs italic">Nenhuma</span>
        </div>
        <button
          @click="$emit('editConfig')"
          class="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white hover:border-white/20 transition-all cursor-pointer"
          title="Editar constantes/objetivo/seed/idiomas deste output"
        >
          <Edit :size="14" />
          Editar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Edit } from 'lucide-vue-next'

defineProps<{
  summary: string | null
  duration: number | string
  wordCount: number | null
  sceneCount: number
  classification: string | null
  scriptStyleName: string | null
  visualStyleName: string | null
}>()

defineEmits<{
  exportJson: []
  editConfig: []
}>()
</script>
