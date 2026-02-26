<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    @click.self="$emit('close')"
  >
    <div class="bg-zinc-900 border border-white/10 p-6 rounded-2xl max-w-4xl w-full shadow-2xl space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-white">Preview da thumbnail</h3>
        <span
          v-if="candidate?.hookText"
          class="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs font-bold uppercase tracking-wider"
        >
          {{ candidate.hookText }}
        </span>
      </div>
      <div class="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/50">
        <img
          :src="`data:image/png;base64,${candidate?.base64}`"
          alt="Thumbnail"
          class="w-full h-full object-contain"
        />
      </div>
      <div class="flex items-center justify-end gap-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
        >
          CANCELAR
        </button>
        <button
          @click="$emit('select')"
          :disabled="selecting"
          class="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-2"
        >
          <span v-if="selecting" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
          {{ selecting ? 'Salvando...' : 'CONFIRMAR' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  candidate: { base64: string; hookText?: string } | null
  selecting: boolean
}>()

defineEmits<{
  close: []
  select: []
}>()
</script>
