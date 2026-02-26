<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="glass-card max-w-lg w-full p-8 rounded-3xl border-amber-500/20 shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-black text-white flex items-center gap-3">
            <Mic :size="28" class="text-amber-400" />
            Trocar Narrador
          </h2>
          <p class="text-zinc-400 text-sm mt-2">
            Escolha uma nova voz e/ou velocidade. Toda a narração será regenerada.
          </p>
          <p v-if="currentVoiceId" class="text-zinc-500 text-xs mt-1 font-mono">
            Voz atual: {{ currentVoiceId }}
          </p>
        </div>
        <button @click="$emit('close')" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X :size="24" />
        </button>
      </div>

      <!-- Voice Selector -->
      <div class="mb-6">
        <VoiceSelector
          :model-value="modelValue"
          @update:model-value="$emit('update:modelValue', $event)"
          label="Nova Voz do Narrador"
        />
      </div>

      <!-- Warning -->
      <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
        <p class="text-amber-200/80 text-sm flex items-start gap-2">
          <AlertTriangle :size="16" class="text-amber-400 shrink-0 mt-0.5" />
          <span>
            Essa ação vai <strong>deletar</strong> todos os áudios de narração atuais e gerar novos com a voz selecionada. O script e as imagens serão mantidos.
          </span>
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-4 border-t border-white/10">
        <button @click="$emit('close')" class="px-6 py-3 text-zinc-400 hover:text-white transition-colors">
          Cancelar
        </button>
        <button
          @click="$emit('confirm')"
          :disabled="!modelValue || modelValue === currentVoiceId"
          class="px-8 py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Mic :size="20" />
          Trocar e Regenerar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Mic, X, AlertTriangle } from 'lucide-vue-next'
import VoiceSelector from '~/components/dossier/VoiceSelector.vue'

defineProps<{
  modelValue: string | null
  currentVoiceId: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
  close: []
  confirm: []
}>()
</script>

<style scoped>
.glass-card {
  @apply bg-black/40 backdrop-blur-xl border border-white/5;
}
</style>
