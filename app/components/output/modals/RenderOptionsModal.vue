<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 rounded-3xl border-emerald-500/20 shadow-2xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-black text-white flex items-center gap-3">
            <Film :size="28" class="text-emerald-500" />
            Opções de renderização
          </h2>
          <p class="text-zinc-400 text-sm mt-2">Inclua logo e/ou legendas no vídeo final</p>
        </div>
        <button @click="$emit('close')" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X :size="24" />
        </button>
      </div>

      <!-- Checkboxes -->
      <div class="space-y-4 mb-6">
        <label class="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
          <input type="checkbox" :checked="includeLogo" @change="$emit('update:includeLogo', ($event.target as HTMLInputElement).checked)" class="w-5 h-5 rounded border-white/30 text-primary bg-black/40" />
          <span class="font-medium text-white">Incluir logo The Gap Files</span>
          <span class="text-zinc-500 text-sm">(rodapé direito, transparente)</span>
        </label>
        <label class="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
          <input type="checkbox" :checked="includeCaptions" @change="$emit('update:includeCaptions', ($event.target as HTMLInputElement).checked)" class="w-5 h-5 rounded border-white/30 text-secondary bg-black/40" />
          <span class="font-medium text-white">Incluir legendas</span>
          <span class="text-zinc-500 text-sm">(estilo escolhido abaixo)</span>
        </label>
        <label v-if="hasBgmData" class="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
          <input type="checkbox" :checked="adjustVolume" @change="$emit('update:adjustVolume', ($event.target as HTMLInputElement).checked)" class="w-5 h-5 rounded border-white/30 text-emerald-500 bg-black/40" />
          <Volume2 :size="18" class="text-emerald-400" />
          <span class="font-medium text-white">Ajustar volume do background</span>
          <span class="text-zinc-500 text-sm">(dB por track)</span>
        </label>
        <label v-if="showStingers" class="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
          <input type="checkbox" :checked="includeStingers" @change="$emit('update:includeStingers', ($event.target as HTMLInputElement).checked)" class="w-5 h-5 rounded border-white/30 text-cyan-500 bg-black/40" />
          <Zap :size="18" class="text-cyan-400" />
          <span class="font-medium text-white">Incluir efeitos editoriais</span>
          <span class="text-zinc-500 text-sm">(stingers, risers, drops)</span>
        </label>
      </div>

      <!-- Caption Styles -->
      <div v-if="includeCaptions" class="mb-6">
        <h3 class="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Estilo de legenda</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            v-for="style in captionStyles"
            :key="style.id"
            @click="$emit('update:captionStyleId', style.id)"
            class="relative p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.02]"
            :class="[
              captionStyleId === style.id ? 'border-secondary bg-secondary/10' : 'border-white/10 bg-white/5 hover:border-white/20'
            ]"
          >
            <div v-if="style.isRecommended" class="absolute -top-2 -right-2 px-3 py-1 bg-secondary text-black text-xs font-black uppercase tracking-wider rounded-full">
              Recomendado
            </div>
            <div class="flex items-start gap-3 mb-3">
              <div class="p-2 rounded-lg" :class="captionStyleId === style.id ? 'bg-secondary/20' : 'bg-white/10'">
                <Subtitles :size="20" :class="captionStyleId === style.id ? 'text-secondary' : 'text-white'" />
              </div>
              <div class="flex-1">
                <h4 class="font-bold text-white">{{ style.name }}</h4>
                <p class="text-xs text-zinc-500 uppercase">{{ style.platform }}</p>
              </div>
            </div>
            <p class="text-sm text-zinc-400 leading-relaxed">{{ style.description }}</p>
            <div v-if="captionStyleId === style.id" class="absolute bottom-4 right-4">
              <CheckCircle2 :size="20" class="text-secondary" />
            </div>
          </div>
        </div>
      </div>

      <!-- Volume Controls -->
      <div v-if="adjustVolume && hasBgmData" class="mb-6">
        <h3 class="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Volume2 :size="16" />
          Volume do Background
        </h3>

        <!-- Single track (backgroundMusicPrompt) -->
        <div v-if="singleTrackMode" class="space-y-3">
          <div class="bg-black/20 p-4 rounded-xl border border-emerald-500/10">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs text-emerald-300 font-medium">Vídeo Todo</span>
              <span class="text-sm font-mono font-bold text-emerald-400">{{ bgmVolumeGlobal }}dB</span>
            </div>
            <input
              type="range"
              :value="bgmVolumeGlobal"
              @input="$emit('update:bgmVolumeGlobal', Number(($event.target as HTMLInputElement).value))"
              min="-40" max="0" step="1"
              class="w-full accent-emerald-500 cursor-pointer"
            />
            <div class="flex items-center justify-between text-xs text-zinc-600 mt-1">
              <span>-40dB (silencioso)</span>
              <span class="text-emerald-500/60">Original: {{ originalVolume }}dB</span>
              <span>0dB (máximo)</span>
            </div>
          </div>
        </div>

        <!-- Multiple tracks -->
        <div v-else-if="musicTracks?.length" class="space-y-3">
          <div
            v-for="(track, idx) in musicTracks"
            :key="'vol-' + idx"
            class="bg-black/20 p-4 rounded-xl border border-emerald-500/10"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-mono font-bold text-emerald-300">
                  {{ Number(idx) + 1 }}
                </div>
                <span class="text-xs text-emerald-300 font-medium">
                  Cenas {{ track.startScene }} → {{ track.endScene !== null && track.endScene !== undefined ? track.endScene : 'Fim' }}
                </span>
              </div>
              <span class="text-sm font-mono font-bold text-emerald-400">{{ getTrackVolume(Number(idx)) }}dB</span>
            </div>
            <input
              type="range"
              :value="getTrackVolume(Number(idx))"
              @input="$emit('setTrackVolume', Number(idx), Number(($event.target as HTMLInputElement).value))"
              min="-40" max="0" step="1"
              class="w-full accent-emerald-500 cursor-pointer"
            />
            <div class="flex items-center justify-between text-xs text-zinc-600 mt-1">
              <span>-40dB</span>
              <span class="text-emerald-500/60">Original: {{ track.volume }}dB</span>
              <span>0dB</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-6 border-t border-white/10">
        <button @click="$emit('close')" class="px-6 py-3 text-zinc-400 hover:text-white transition-colors">
          Cancelar
        </button>
        <button
          @click="$emit('confirm')"
          :disabled="rendering || (includeCaptions && !captionStyleId)"
          class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-glow-emerald flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          <span v-if="rendering" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
          <Zap v-else :size="20" />
          {{ rendering ? 'RENDERIZANDO...' : 'RENDERIZAR' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Film, X, CheckCircle2, Subtitles, Volume2, Zap } from 'lucide-vue-next'

defineProps<{
  rendering: boolean
  includeLogo: boolean
  includeCaptions: boolean
  adjustVolume: boolean
  includeStingers: boolean
  showStingers: boolean
  hasBgmData: boolean
  captionStyleId: string | null
  captionStyles: Array<{ id: string; name: string; platform: string; description: string; isRecommended?: boolean }>
  bgmVolumeGlobal: number
  originalVolume: number
  singleTrackMode: boolean
  musicTracks: Array<{ startScene: number; endScene: number | null; volume: number }> | null
  getTrackVolume: (idx: number) => number
}>()

defineEmits<{
  close: []
  confirm: []
  'update:includeLogo': [value: boolean]
  'update:includeCaptions': [value: boolean]
  'update:adjustVolume': [value: boolean]
  'update:includeStingers': [value: boolean]
  'update:captionStyleId': [value: string]
  'update:bgmVolumeGlobal': [value: number]
  setTrackVolume: [idx: number, value: number]
}>()
</script>

<style scoped>
.glass-card {
  @apply bg-black/40 backdrop-blur-xl border border-white/5;
}
</style>
