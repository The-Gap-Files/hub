<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div class="bg-zinc-900 border border-cyan-500/20 p-8 rounded-2xl max-w-lg w-full shadow-2xl space-y-6">
      <h3 class="text-xl font-bold flex items-center gap-2">
        <Map :size="20" class="text-cyan-400" />
        Replanejar Narrativa
      </h3>
      <p class="text-sm text-zinc-400">
        O que gostaria de mudar no plano narrativo? O Story Architect vai gerar um novo outline com sua direção.
      </p>

      <textarea
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        class="w-full h-32 bg-black/50 border border-white/10 rounded-xl p-4 text-sm focus:border-cyan-500 focus:outline-none resize-none"
        placeholder="Ex: O clímax deveria focar na conexão política, não na evidência forense. Quero mais tensão no hook..."
        autofocus
      ></textarea>

      <div class="flex justify-end gap-3 pt-2">
        <button @click="$emit('close')" class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors">
          CANCELAR
        </button>
        <button
          @click="$emit('confirm')"
          :disabled="regenerating || needsSpeechConfig"
          class="px-6 py-2 bg-cyan-500 text-black font-bold text-xs rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <span v-if="regenerating" class="animate-spin w-3 h-3 border-2 border-black/30 border-t-black rounded-full"></span>
          REPLANEJAR
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Map } from 'lucide-vue-next'

defineProps<{
  modelValue: string
  regenerating: boolean
  needsSpeechConfig: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
  close: []
  confirm: []
}>()
</script>
