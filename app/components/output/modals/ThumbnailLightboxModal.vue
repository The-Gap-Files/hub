<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 animate-in fade-in duration-200"
    @click.self="$emit('close')"
  >
    <div class="bg-zinc-900/95 border border-white/10 p-4 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col gap-3">
      <!-- Header -->
      <div class="flex items-center justify-between shrink-0">
        <span class="text-sm font-bold text-white flex items-center gap-2">
          <ImageIcon :size="14" class="text-emerald-400" />
          Thumbnail
        </span>
        <button @click="$emit('close')" class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white cursor-pointer">
          <X :size="16" />
        </button>
      </div>

      <!-- Image -->
      <div class="relative rounded-xl overflow-hidden border border-white/10 bg-black/50 flex-1 min-h-0">
        <img :src="thumbnailUrl" alt="Thumbnail selecionada" class="max-h-[60vh] w-auto mx-auto object-contain" />
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-2">
          <button
            @click="$emit('remove')"
            :disabled="removing"
            class="px-3 py-1.5 text-xs font-bold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            {{ removing ? 'Removendo...' : 'Remover' }}
          </button>
          <button
            @click="$emit('regenerate')"
            :disabled="generating"
            class="px-3 py-1.5 text-xs font-bold text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon :size="12" :class="generating ? 'animate-spin' : ''" />
            {{ generating ? 'Gerando...' : 'Gerar novamente' }}
          </button>
        </div>
        <a
          :href="thumbnailUrl"
          download="thumbnail.png"
          class="btn-primary px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Download :size="12" />
          DOWNLOAD
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ImageIcon, X, Download } from 'lucide-vue-next'

defineProps<{
  thumbnailUrl: string
  removing: boolean
  generating: boolean
}>()

defineEmits<{
  close: []
  remove: []
  regenerate: []
}>()
</script>
