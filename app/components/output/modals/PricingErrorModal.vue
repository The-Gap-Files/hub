<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="bg-zinc-900 border border-red-500/30 p-8 rounded-2xl max-w-lg w-full shadow-2xl space-y-6">
      <div class="flex items-center gap-3">
        <div class="p-3 bg-red-500/10 rounded-xl">
          <AlertTriangle :size="28" class="text-red-400" />
        </div>
        <div>
          <h3 class="text-xl font-bold text-red-300">Modelo sem Preço Configurado</h3>
          <p class="text-zinc-500 text-sm">A execução foi bloqueada para proteger seu orçamento</p>
        </div>
      </div>

      <div class="bg-black/40 border border-white/10 rounded-xl p-5 space-y-3">
        <div>
          <span class="text-xs font-black tracking-widest text-zinc-500 uppercase">Modelo</span>
          <p class="text-white font-mono text-sm mt-1">{{ error.model }}</p>
        </div>
        <div>
          <span class="text-xs font-black tracking-widest text-zinc-500 uppercase">Provider</span>
          <p class="text-white font-mono text-sm mt-1">{{ error.provider }}</p>
        </div>
      </div>

      <div class="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
        <h4 class="text-amber-300 font-bold text-sm mb-3 flex items-center gap-2">
          <DollarSign :size="16" />
          O que fazer:
        </h4>
        <ol class="text-zinc-400 text-sm space-y-2 list-decimal list-inside">
          <li>Acesse a página do modelo no Replicate para verificar o tipo de cobrança (por output ou por tempo de GPU)</li>
          <li>Atualize o mapa de preços em <code class="text-amber-300/80 bg-black/40 px-1.5 py-0.5 rounded text-xs">server/constants/pricing.ts</code></li>
          <li>Reinicie o servidor e tente novamente</li>
        </ol>
      </div>

      <div class="flex items-center justify-between pt-2">
        <a
          :href="error.configUrl"
          target="_blank"
          class="px-6 py-3 bg-white/5 border border-white/10 text-zinc-300 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-bold"
        >
          <Eye :size="16" />
          Ver Modelo no Replicate
        </a>
        <button
          @click="$emit('close')"
          class="px-6 py-3 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl hover:bg-red-500/30 transition-all text-sm font-bold"
        >
          Entendi
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, Eye, DollarSign } from 'lucide-vue-next'

defineProps<{
  error: { model: string; provider: string; configUrl: string }
}>()

defineEmits<{
  close: []
}>()
</script>
