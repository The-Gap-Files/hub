<script setup lang="ts">
import {
  Radio, RotateCw, Edit, Eye, Music, X, Mic, Clapperboard, Zap,
  ShieldAlert, AlertTriangle, Check, Sparkles, ArrowDown, Play, Square, AudioWaveform
} from 'lucide-vue-next'

defineProps<{
  output: any
  pipelineStage: string | null
  editingPromptSceneId: string | null
  editingPromptText: string
  regeneratingSceneId: string | null
  regeneratingMotionSceneIds: Set<string>
  expandedPromptScenes: Set<string>
  sanitizingSceneId: string | null
  sanitizingLevel: string | null
  motionVersions: Record<string, number>
  ttsTextForScene: (narration: string) => string
  getSelectedVideo: (scene: any) => any
}>()

defineEmits<{
  regenerateImage: [scene: any]
  startEditPrompt: [scene: any]
  cancelEditPrompt: [scene: any]
  saveEditPrompt: [scene: any]
  saveAndRegenerateImage: [scene: any]
  sanitizeAndFillEdit: [scene: any, level: 'intense' | 'moderate' | 'safe']
  'update:editingPromptText': [value: string]
  openImage: [id: string]
  regenerateMotionCorrection: [scene: any]
  toggleExpandedPrompt: [sceneId: string]
}>()

function isGateApproved(o: any, stage: string): boolean {
  if (!o?.stageGates) return false
  const gate = o.stageGates.find((g: any) => g.stage === stage)
  return gate?.status === 'APPROVED'
}
</script>

<template>
  <!-- Script Viewer: only render when script exists -->
  <main v-if="output.script" class="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">

    <!-- Sidebar: Background Music -->
    <aside class="space-y-6 lg:sticky lg:top-24 lg:self-start">
      <section v-if="output.script?.backgroundMusicPrompt || output.script?.backgroundMusicTracks?.length" class="glass-card p-6 rounded-2xl border-emerald-500/10 bg-emerald-500/5">
        <h3 class="flex items-center gap-2 mono-label mb-4 text-emerald-400">
          <Radio :size="14" /> Background Music
        </h3>

        <!-- Single track (TikTok/Instagram) -->
        <div v-if="output.script?.backgroundMusicPrompt" class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-1 bg-emerald-500/20 rounded text-emerald-300 font-mono uppercase tracking-widest">Video Todo</span>
            <span class="text-xs px-2 py-1 bg-emerald-500/10 rounded text-emerald-400/60 font-mono">{{ output.script.backgroundMusicVolume || -18 }}dB</span>
          </div>
          <p class="text-sm text-emerald-200/80 leading-relaxed italic">
            {{ output.script.backgroundMusicPrompt }}
          </p>
        </div>

        <!-- Multi-track list with timestamps (YouTube Cinematic) -->
        <div v-else-if="output.script?.backgroundMusicTracks?.length" class="space-y-3">
          <div v-for="(track, idx) in output.script.backgroundMusicTracks" :key="idx" class="bg-black/20 p-3 rounded-xl border border-emerald-500/10">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs px-2 py-1 bg-emerald-500/20 rounded text-emerald-300 font-mono">
                Cenas {{ track.startScene }} → {{ track.endScene !== null && track.endScene !== undefined ? track.endScene : 'Fim' }}
              </span>
              <span class="text-xs px-2 py-1 bg-emerald-500/10 rounded text-emerald-400/60 font-mono">{{ track.volume }}dB</span>
            </div>
            <p class="text-xs text-emerald-200/60 leading-relaxed">
              {{ track.prompt }}
            </p>
          </div>
        </div>
      </section>
    </aside>

    <!-- Scenes Grid (scrollable) -->
    <section class="lg:col-span-2 flex flex-col">
      <!-- Scene Header -->
      <div class="flex items-center justify-between mb-4 sticky top-0 z-10 bg-black/80 backdrop-blur-xl py-3 px-4 -mx-1 rounded-xl border border-white/5">
        <div class="flex items-center gap-3">
          <h3 class="text-xs font-black uppercase tracking-widest text-zinc-400">Cenas</h3>
          <span class="text-xs px-2 py-0.5 bg-white/5 rounded-full text-zinc-500 font-mono">{{ output.scenes?.length || 0 }}</span>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
          <span>Scroll para navegar</span>
        </div>
      </div>

      <!-- Scrollable Scene List -->
      <div class="max-h-[calc(100vh-12rem)] overflow-y-auto space-y-6 pr-2">
        <div v-for="scene in output.scenes" :key="scene.id" class="glass-card p-6 rounded-2xl border-white/5 group hover:border-primary/20 transition-all">
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-mono font-bold text-zinc-400 group-hover:bg-primary group-hover:text-black transition-colors">
                {{ scene.order + 1 }}
              </div>
              <span class="mono-label text-zinc-500">{{ scene.estimatedDuration }}s</span>
              <!-- Viral badges -->
              <span v-if="scene.brollPriority >= 4" class="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/20">HERO</span>
              <span v-else-if="scene.brollPriority <= 1" class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-zinc-500/10 text-zinc-500 border border-zinc-500/10">simple</span>
              <span v-if="scene.patternInterruptType" class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-pink-500/15 text-pink-400 border border-pink-500/15">{{ scene.patternInterruptType }}</span>
              <span v-for="flag in (scene.riskFlags || [])" :key="flag" class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-red-500/15 text-red-400/80 border border-red-500/15">{{ flag }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="$emit('regenerateImage', scene)"
                :disabled="!!regeneratingSceneId"
                class="text-zinc-600 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                title="Regenerar Imagem"
              >
                <span v-if="regeneratingSceneId === scene.id" class="animate-spin block">
                  <RotateCw :size="14" />
                </span>
                <RotateCw v-else :size="14" />
              </button>
              <button
                @click="editingPromptSceneId === scene.id ? $emit('cancelEditPrompt', scene) : $emit('startEditPrompt', scene)"
                class="text-zinc-600 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                :class="{ 'text-primary bg-primary/10': editingPromptSceneId === scene.id }"
                title="Editar Visual Prompt"
              >
                <X v-if="editingPromptSceneId === scene.id" :size="14" />
                <Edit v-else :size="14" />
              </button>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <!-- TTS Text -->
            <div class="bg-black/20 p-4 rounded-xl border border-white/5">
              <div class="flex justify-between items-center mb-2">
                <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500">
                  <Mic :size="10" /> TTS Text → ElevenLabs ({{ output.narrationLanguage || 'PT-BR' }})
                </h4>
                <span v-if="output.status === 'IN_PROGRESS' && !output.audioTracks?.some((a: any) => a.type === 'narration')" class="text-xs text-orange-400 animate-pulse">Gerando Audio...</span>
              </div>

              <p class="text-lg font-serif text-white/90 leading-relaxed mb-4">
                "{{ ttsTextForScene(scene.narration) }}"
              </p>

              <!-- Mini Player (Scene Narration Audio) -->
              <div v-if="scene.audioTracks?.some((a: any) => a.type === 'scene_narration')" class="mt-4 pt-4 border-t border-white/5">
                <audio
                  controls
                  class="w-full h-8 opacity-50 hover:opacity-100 transition-opacity"
                  :src="`/api/scenes/${scene.id}/audio`"
                >
                  Seu navegador nao suporta audio.
                </audio>
              </div>

              <!-- Mini Player (Scene SFX Audio) -->
              <div v-if="scene.audioTracks?.some((a: any) => a.type === 'scene_sfx')" class="mt-3 pt-3 border-t border-purple-500/10">
                <div class="flex items-center gap-2 mb-2">
                  <AudioWaveform :size="12" class="text-purple-400/70" />
                  <span class="text-[10px] font-black uppercase tracking-widest text-purple-400/60">SFX</span>
                  <span v-if="scene.audioDescription" class="text-[10px] text-purple-300/40 truncate max-w-[200px]">{{ scene.audioDescription }}</span>
                </div>
                <audio
                  controls
                  class="w-full h-8 opacity-40 hover:opacity-100 transition-opacity"
                  :src="`/api/scenes/${scene.id}/sfx-audio`"
                >
                  Seu navegador nao suporta audio.
                </audio>
              </div>

              <!-- Viral Metadata -->
              <div v-if="scene.onScreenText" class="mt-3 pt-3 border-t border-amber-500/10 space-y-2">
                <div v-if="scene.onScreenText" class="flex items-start gap-2">
                  <span class="text-[9px] font-black uppercase tracking-widest text-amber-400/60 whitespace-nowrap mt-0.5">ON-SCREEN</span>
                  <span class="text-xs text-amber-200/80 font-medium">"{{ scene.onScreenText }}"</span>
                </div>
              </div>
            </div>

            <!-- Visual -->
            <div class="space-y-4">
              <div class="bg-primary/5 p-4 rounded-xl border border-primary/10" :class="{ 'border-primary/30': editingPromptSceneId === scene.id }">
                <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-400/70 mb-2">
                  <Eye :size="10" /> Visual Prompt
                  <span v-if="scene.imageStatus === 'restricted'" class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-red-500/20 text-red-400">Restrita</span>
                </h4>

                <!-- View mode -->
                <div v-if="editingPromptSceneId !== scene.id" class="space-y-4">
                  <div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-blue-400/40 mb-1 block">Start Prompt</span>
                    <p class="text-sm text-white/80 leading-relaxed font-light">
                      {{ expandedPromptScenes.has(scene.id) || (scene.visualDescription?.length ?? 0) <= 180 ? scene.visualDescription : scene.visualDescription?.slice(0, 180) }}
                      <button
                        v-if="(scene.visualDescription?.length ?? 0) > 180"
                        @click="$emit('toggleExpandedPrompt', scene.id)"
                        class="text-blue-400/60 hover:text-blue-400 transition-colors text-xs ml-1 cursor-pointer"
                      >{{ expandedPromptScenes.has(scene.id) ? '<- recolher' : '{...}' }}</button>
                    </p>
                  </div>
                </div>

                <!-- Edit mode -->
                <div v-else class="space-y-4">
                  <!-- AI rewrite selector (restricted scenes) -->
                  <div v-if="scene.imageStatus === 'restricted'" class="bg-white/[0.02] p-3 rounded-lg border border-white/5">
                    <h5 class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                      <Sparkles :size="9" /> Reescrever com IA
                    </h5>
                    <div class="grid grid-cols-3 gap-1.5">
                      <button
                        @click.stop="$emit('sanitizeAndFillEdit', scene, 'intense')"
                        :disabled="sanitizingSceneId === scene.id"
                        class="px-2 py-2 bg-red-500/8 border border-red-500/20 text-red-300/80 hover:bg-red-500/15 hover:border-red-500/40 rounded-lg transition-all flex flex-col items-center gap-0.5 text-center disabled:opacity-50 cursor-pointer"
                      >
                        <span class="text-sm">&#x1F534;</span>
                        <span class="text-[9px] font-bold uppercase tracking-wider">Intenso</span>
                      </button>
                      <button
                        @click.stop="$emit('sanitizeAndFillEdit', scene, 'moderate')"
                        :disabled="sanitizingSceneId === scene.id"
                        class="px-2 py-2 bg-amber-500/8 border border-amber-500/20 text-amber-300/80 hover:bg-amber-500/15 hover:border-amber-500/40 rounded-lg transition-all flex flex-col items-center gap-0.5 text-center disabled:opacity-50 cursor-pointer"
                      >
                        <span v-if="sanitizingSceneId === scene.id && sanitizingLevel === 'moderate'" class="animate-spin w-3.5 h-3.5 border-2 border-amber-300/30 border-t-amber-300 rounded-full"></span>
                        <span v-else class="text-sm">&#x1F7E1;</span>
                        <span class="text-[9px] font-bold uppercase tracking-wider">Moderado</span>
                      </button>
                      <button
                        @click.stop="$emit('sanitizeAndFillEdit', scene, 'safe')"
                        :disabled="sanitizingSceneId === scene.id"
                        class="px-2 py-2 bg-emerald-500/8 border border-emerald-500/20 text-emerald-300/80 hover:bg-emerald-500/15 hover:border-emerald-500/40 rounded-lg transition-all flex flex-col items-center gap-0.5 text-center disabled:opacity-50 cursor-pointer"
                      >
                        <span v-if="sanitizingSceneId === scene.id && sanitizingLevel === 'safe'" class="animate-spin w-3.5 h-3.5 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full"></span>
                        <span v-else class="text-sm">&#x1F7E2;</span>
                        <span class="text-[9px] font-bold uppercase tracking-wider">Seguro</span>
                      </button>
                    </div>
                  </div>

                  <!-- Edit textarea -->
                  <div class="space-y-3">
                    <div>
                      <span class="text-[10px] font-black uppercase tracking-widest text-blue-400/40 mb-1.5 block">Visual Prompt</span>
                      <textarea
                        :value="editingPromptText"
                        @input="$emit('update:editingPromptText', ($event.target as HTMLTextAreaElement).value)"
                        class="w-full bg-black/40 border border-primary/20 rounded-lg p-3 text-sm text-white/90 leading-relaxed focus:border-primary/50 focus:outline-none resize-y min-h-[80px]"
                        rows="3"
                      ></textarea>
                    </div>
                  </div>

                  <!-- Save / Cancel / Regenerate buttons -->
                  <div class="flex gap-2">
                    <button
                      @click="$emit('saveEditPrompt', scene)"
                      class="flex-1 px-3 py-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <Check :size="12" /> Salvar
                    </button>
                    <button
                      v-if="editingPromptText !== scene.visualDescription"
                      @click="$emit('saveAndRegenerateImage', scene)"
                      :disabled="!!regeneratingSceneId"
                      class="flex-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                    >
                      <span v-if="regeneratingSceneId === scene.id" class="animate-spin w-3 h-3 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full"></span>
                      <Sparkles v-else :size="12" />
                      Salvar & Gerar
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="scene.audioDescription" class="bg-purple-500/5 p-3 rounded-xl border border-purple-500/10">
                <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-400/70 mb-2">
                  <Music :size="10" /> Audio SFX
                </h4>
                <p class="text-xs text-purple-200/60 leading-relaxed">
                  {{ scene.audioDescription }}
                </p>
              </div>
            </div>
          </div>

          <!-- Video/Motion Preview -->
          <div v-if="isGateApproved(output, 'MOTION') || output.scenes?.some((s:any) => s.videos?.length)" class="mt-4 pt-4 border-t border-white/5">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-pink-500/70 mb-2">
              <Clapperboard :size="10" /> Motion Preview
            </h4>

            <div v-if="getSelectedVideo(scene)">
              <div class="aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative group/video">
                <video
                  controls
                  loop
                  class="w-full h-full object-cover"
                  :src="`/api/scene-videos/${getSelectedVideo(scene).id}/stream?t=${motionVersions[scene.id] || 0}`"
                  :key="'motion-main-' + scene.id + '-' + (motionVersions[scene.id] || 0)"
                ></video>

                <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-xs text-white/80 font-mono pointer-events-none">
                  {{ getSelectedVideo(scene).provider }} &bull; {{ getSelectedVideo(scene).duration?.toFixed(1) }}s
                </div>
              </div>

              <!-- Regenerate Motion (individual) -->
              <button
                v-if="pipelineStage === 'MOTION'"
                @click="$emit('regenerateMotionCorrection', scene)"
                :disabled="regeneratingMotionSceneIds.has(scene.id)"
                class="mt-2 w-full px-3 py-2 bg-pink-500/10 border border-pink-500/20 text-pink-300 hover:bg-pink-500/20 hover:text-pink-200 hover:border-pink-500/40 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <span v-if="regeneratingMotionSceneIds.has(scene.id)" class="animate-spin w-3.5 h-3.5 border-2 border-pink-300/30 border-t-pink-300 rounded-full"></span>
                <RotateCw v-else :size="12" />
                {{ regeneratingMotionSceneIds.has(scene.id) ? 'REGENERANDO...' : 'REGENERAR MOTION' }}
              </button>
            </div>
            <div v-else class="space-y-2">
              <div class="h-24 bg-pink-500/5 rounded-lg flex flex-col items-center justify-center gap-2 border border-dashed border-pink-500/20 text-pink-500/50">
                <Clapperboard :size="16" class="animate-pulse" />
                <span class="text-xs uppercase tracking-wider">{{ isGateApproved(output, 'AUDIO') ? 'Aguardando Motion...' : 'Pendente de Audio' }}</span>
              </div>
              <!-- Generate Motion (individual, no video yet) -->
              <button
                v-if="pipelineStage === 'MOTION'"
                @click="$emit('regenerateMotionCorrection', scene)"
                :disabled="regeneratingMotionSceneIds.has(scene.id)"
                class="w-full px-3 py-2 bg-pink-500/10 border border-pink-500/20 text-pink-300 hover:bg-pink-500/20 hover:text-pink-200 hover:border-pink-500/40 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <span v-if="regeneratingMotionSceneIds.has(scene.id)" class="animate-spin w-3.5 h-3.5 border-2 border-pink-300/30 border-t-pink-300 rounded-full"></span>
                <Zap v-else :size="12" />
                {{ regeneratingMotionSceneIds.has(scene.id) ? 'GERANDO...' : 'GERAR MOTION' }}
              </button>
            </div>
          </div>

          <!-- Image Keyframes Preview -->
          <div v-if="(isGateApproved(output, 'IMAGES') || isGateApproved(output, 'SCRIPT')) && scene.images?.length > 0" class="mt-6 pt-6 border-t border-white/5">
            <div class="flex flex-col gap-6">
              <!-- Start Image Block -->
              <div v-if="scene.images.some((i: any) => i.role === 'start' || !i.role)">
                <h5 class="text-[10px] font-black uppercase tracking-widest text-blue-400/50 mb-2 flex items-center gap-1.5">
                  <Play :size="10" /> Frame Inicial (Start)
                </h5>
                <div class="flex gap-3 overflow-x-auto pb-1">
                  <div
                    v-for="img in scene.images.filter((i: any) => (i.role === 'start' || !i.role) && i.isSelected)"
                    :key="img.id"
                    class="w-40 aspect-video flex-shrink-0 rounded-lg overflow-hidden relative group/img cursor-pointer border border-white/10 hover:border-primary/50 transition-all"
                    @click="$emit('openImage', img.id)"
                  >
                    <img :src="`/api/scene-images/${img.id}`" class="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" loading="lazy" />
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye :size="16" class="text-white drop-shadow-lg" />
                    </div>
                    <div class="absolute bottom-2 left-2 px-1.5 py-0.5 bg-blue-500/80 backdrop-blur rounded text-[8px] font-black text-white uppercase tracking-tighter">START</div>
                  </div>
                </div>
              </div>

              <!-- Transition Arrow -->
              <div v-if="scene.images.some((i: any) => i.role === 'end')" class="flex justify-center -my-2 opacity-20">
                <ArrowDown :size="16" class="text-white" />
              </div>

              <!-- End Image Block -->
              <div v-if="scene.images.some((i: any) => i.role === 'end')">
                <h5 class="text-[10px] font-black uppercase tracking-widest text-emerald-400/50 mb-2 flex items-center gap-1.5">
                  <Square :size="10" /> Frame Final (End Keyframe)
                </h5>
                <div class="flex gap-3 overflow-x-auto pb-1">
                  <div
                    v-for="img in scene.images.filter((i: any) => i.role === 'end' && i.isSelected)"
                    :key="img.id"
                    class="w-40 aspect-video flex-shrink-0 rounded-lg overflow-hidden relative group/img cursor-pointer border border-emerald-500/10 hover:border-emerald-500/50 transition-all"
                    @click="$emit('openImage', img.id)"
                  >
                    <img :src="`/api/scene-images/${img.id}`" class="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" loading="lazy" />
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye :size="16" class="text-white drop-shadow-lg" />
                    </div>
                    <div class="absolute bottom-2 left-2 px-1.5 py-0.5 bg-emerald-500/80 backdrop-blur rounded text-[8px] font-black text-white uppercase tracking-tighter">END KEYFRAME</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Fallback: Pending / Error -->
          <div v-else-if="isGateApproved(output, 'IMAGES') || isGateApproved(output, 'SCRIPT')" class="mt-6 pt-6 border-t border-white/5">
            <div v-if="scene.imageStatus === 'restricted'" class="h-16 bg-red-500/5 rounded-lg flex items-center justify-center gap-3 text-xs border border-dashed border-red-500/20">
              <ShieldAlert :size="16" class="text-red-400/60" />
              <span class="text-red-300/70">Imagem bloqueada pelo filtro de conteudo</span>
            </div>
            <div v-else-if="scene.imageStatus === 'error'" class="h-16 bg-orange-500/5 rounded-lg flex items-center justify-center gap-3 text-xs border border-dashed border-orange-500/20">
              <AlertTriangle :size="16" class="text-orange-400/60" />
              <span class="text-orange-300/70">Erro ao gerar imagem</span>
            </div>
            <div v-else class="h-12 bg-white/5 rounded-lg flex items-center justify-center text-xs text-zinc-500 uppercase tracking-widest border border-dashed border-white/5">
              {{ isGateApproved(output, 'SCRIPT') ? 'Aguardando Geracao das Imagens...' : 'Imagens Pendentes' }}
            </div>
          </div>

        </div>
      </div>
    </section>

  </main>
</template>
