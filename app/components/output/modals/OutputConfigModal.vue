<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="glass-card max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 rounded-3xl border-white/10 shadow-2xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-black text-white flex items-center gap-3">
            <Edit :size="28" class="text-primary" />
            Configurações do Output
          </h2>
          <p class="text-zinc-400 text-sm mt-2">
            Ajuste as constantes e diretrizes usadas na geração. Isso <strong>não</strong> dispara o pipeline automaticamente.
          </p>
        </div>
        <button @click="$emit('close')" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X :size="24" />
        </button>
      </div>

      <div v-if="error" class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-200">
        {{ error }}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div>
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Estilo de roteiro</label>
          <select :value="scriptStyleId" @change="$emit('update:scriptStyleId', ($event.target as HTMLSelectElement).value)" class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-primary/40">
            <option value="">(vazio)</option>
            <option v-for="s in scriptStylesOptions" :key="s.id" :value="s.id">{{ s.name }} ({{ s.id }})</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Estilo visual</label>
          <select :value="visualStyleId" @change="$emit('update:visualStyleId', ($event.target as HTMLSelectElement).value)" class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-primary/40">
            <option value="">(vazio)</option>
            <option v-for="s in visualStylesOptions" :key="s.id" :value="s.id">{{ s.name }} ({{ s.id }})</option>
          </select>
        </div>

        <div class="md:col-span-2">
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Preset de objetivo editorial (opcional)</label>
          <select :value="editorialObjectiveId" @change="$emit('update:editorialObjectiveId', ($event.target as HTMLSelectElement).value); $emit('applyPreset')" class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-primary/40">
            <option value="">(nenhum)</option>
            <option v-for="o in editorialObjectivesOptions" :key="o.id" :value="o.id">{{ o.name }} ({{ o.id }})</option>
          </select>
        </div>

        <div class="md:col-span-2">
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Objective (texto livre)</label>
          <textarea :value="objective" @input="$emit('update:objective', ($event.target as HTMLTextAreaElement).value)" rows="4" class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40" placeholder="Diretriz narrativa do output..."></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Idioma do vídeo</label>
          <input :value="language" @input="$emit('update:language', ($event.target as HTMLInputElement).value)" type="text" class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-primary/40" placeholder="pt-BR" />
        </div>
        <div>
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Idioma da narração</label>
          <input :value="narrationLanguage" @input="$emit('update:narrationLanguage', ($event.target as HTMLInputElement).value)" type="text" class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-primary/40" placeholder="pt-BR" />
        </div>

        <div class="md:col-span-2">
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Seed</label>
          <div v-if="seedLocked" class="space-y-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
            <div class="flex items-center gap-2">
              <span class="text-sm text-white font-mono">{{ currentSeedValue ?? '—' }}</span>
              <span class="text-[10px] uppercase tracking-wider text-emerald-300">Travada pelo monetizador</span>
            </div>
            <p class="text-xs text-emerald-200/80">
              Essa seed veio do plano de monetização (Full/Teaser) e é usada pra manter consistência visual entre todos os vídeos do pacote.
            </p>
          </div>
          <div v-else class="space-y-2">
            <select
              :value="seedChoice"
              @change="$emit('update:seedChoice', ($event.target as HTMLSelectElement).value)"
              class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-primary/40"
            >
              <option value="auto">Automática – deixar o sistema escolher a seed</option>
              <option v-for="s in seedOptions" :key="s.id" :value="String(s.value)">{{ s.value }}</option>
            </select>
          </div>
          <p class="text-xs text-zinc-500 mt-2">
            Seed atual: <span class="font-mono text-zinc-300">{{ currentSeedValue ?? '—' }}</span>
          </p>
        </div>

        <div class="md:col-span-2">
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Must include (opcional)</label>
          <textarea :value="mustInclude" @input="$emit('update:mustInclude', ($event.target as HTMLTextAreaElement).value)" rows="2" class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40" placeholder="Coisas que devem aparecer..."></textarea>
        </div>
        <div class="md:col-span-2">
          <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Must exclude (opcional)</label>
          <textarea :value="mustExclude" @input="$emit('update:mustExclude', ($event.target as HTMLTextAreaElement).value)" rows="2" class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40" placeholder="Coisas que devem ser evitadas..."></textarea>
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 border-t border-white/10">
        <button @click="$emit('close')" class="px-6 py-3 text-zinc-400 hover:text-white transition-colors">
          Cancelar
        </button>
        <button
          @click="$emit('save')"
          :disabled="saving"
          class="px-8 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(124,58,237,0.25)] flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Edit :size="18" :class="saving ? 'animate-spin' : ''" />
          {{ saving ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Edit, X } from 'lucide-vue-next'

defineProps<{
  error: string | null
  saving: boolean
  scriptStyleId: string
  visualStyleId: string
  editorialObjectiveId: string
  objective: string
  language: string
  narrationLanguage: string
  seedChoice: string
  seedLocked: boolean
  currentSeedValue: number | null
  mustInclude: string
  mustExclude: string
  scriptStylesOptions: Array<{ id: string; name: string }>
  visualStylesOptions: Array<{ id: string; name: string }>
  editorialObjectivesOptions: Array<{ id: string; name: string }>
  seedOptions: Array<{ id: string; value: number }>
}>()

defineEmits<{
  close: []
  save: []
  applyPreset: []
  'update:scriptStyleId': [value: string]
  'update:visualStyleId': [value: string]
  'update:editorialObjectiveId': [value: string]
  'update:objective': [value: string]
  'update:language': [value: string]
  'update:narrationLanguage': [value: string]
  'update:seedChoice': [value: string]
  'update:mustInclude': [value: string]
  'update:mustExclude': [value: string]
}>()
</script>

<style scoped>
.glass-card {
  @apply bg-black/40 backdrop-blur-xl border border-white/5;
}
</style>
