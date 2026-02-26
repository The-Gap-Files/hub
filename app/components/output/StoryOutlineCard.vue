<template>
  <div v-if="isPlanoStage && outline && !output.script" class="mb-12">
    <div class="glass-card rounded-3xl border-cyan-500/20 overflow-hidden">
      <!-- Header -->
      <div class="px-8 py-6 bg-gradient-to-r from-cyan-500/10 to-transparent border-b border-cyan-500/10 flex items-center justify-between cursor-pointer" @click="$emit('toggleExpanded')">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-cyan-500/20 rounded-xl">
            <Map :size="20" class="text-cyan-400" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-cyan-200">Plano Narrativo</h3>
            <p class="text-cyan-300/40 text-xs">Story Architect • {{ outline.risingBeats?.length || 0 }} beats • Arco: {{ outline.emotionalArc }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            v-if="!outlineApproved"
            @click.stop="$emit('approveStoryOutline')"
            :disabled="approving"
            class="px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <CheckCircle2 :size="14" />
            Aprovar plano
          </button>
          <button
            @click.stop="$emit('openOutlineFeedback')"
            :disabled="regeneratingOutline"
            class="px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-cyan-500/50 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <RotateCw :size="14" :class="regeneratingOutline ? 'animate-spin' : ''" />
            Replanejar
          </button>
          <component :is="expanded ? ChevronUp : ChevronDown" :size="20" class="text-cyan-400/50" />
        </div>
      </div>

      <!-- Informativo: Campos vazios em hook-only -->
      <div
        v-if="expanded && outline.resolutionLevel === 'none'"
        class="mx-8 mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3"
      >
        <Info :size="16" class="text-amber-400 mt-0.5 flex-shrink-0" />
        <div class="text-xs text-amber-200/70 leading-relaxed">
          <strong class="text-amber-300">Hook-Only:</strong> Este plano é pura provocação (resolutionLevel = none).
          Campos como <code class="text-amber-300/80">climaxMoment</code>, <code class="text-amber-300/80">resolutionPoints</code>,
          <code class="text-amber-300/80">emotionalArc</code> e outros ficam vazios por design — o objetivo é criar curiosidade
          sem resolver nada. Apenas o hook, beats e loops abertos são preenchidos.
        </div>
      </div>

      <!-- Body (Collapsible) -->
      <div v-if="expanded" class="p-8 space-y-6">
        <!-- Hook -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-red-500/5 p-5 rounded-2xl border border-red-500/10" :class="{ 'md:col-span-2': outline.hookVariants?.length }">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-400/80 mb-3">
              <Zap :size="12" /> Hook Strategy
            </h4>
            <p class="text-sm text-red-200/70 leading-relaxed mb-4">{{ outline.hookStrategy }}</p>

            <!-- Hook Variants (4 níveis tonais + custom) -->
            <div v-if="outline.hookVariants?.length" class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <button
                  v-for="variant in outline.hookVariants"
                  :key="variant.level"
                  @click="!outlineApproved && $emit('update:selectedHookLevel', variant.level)"
                  :class="[
                    'text-left p-4 rounded-xl border-2 transition-all duration-200 group/hook',
                    selectedHookLevel === variant.level
                      ? variant.level === 'green'
                        ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : variant.level === 'moderate'
                          ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
                          : variant.level === 'aggressive'
                            ? 'bg-red-500/10 border-red-500/40 ring-1 ring-red-500/20'
                            : 'bg-purple-900/20 border-purple-500/40 ring-1 ring-purple-500/20'
                      : 'bg-black/20 border-white/5 hover:border-white/15',
                    outlineApproved ? 'cursor-default' : 'cursor-pointer'
                  ]"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span :class="[
                      'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded',
                      variant.level === 'green' ? 'bg-emerald-500/20 text-emerald-300' :
                      variant.level === 'moderate' ? 'bg-amber-500/20 text-amber-300' :
                      variant.level === 'aggressive' ? 'bg-red-500/20 text-red-300' :
                      'bg-purple-900/30 text-purple-300'
                    ]">
                      {{ variant.level === 'green' ? '🟢 Seguro' : variant.level === 'moderate' ? '🟡 Ameno' : variant.level === 'aggressive' ? '🔴 Agressivo' : '☠️ Terra sem Lei' }}
                    </span>
                    <CheckCircle2 v-if="selectedHookLevel === variant.level" :size="16" :class="[
                      variant.level === 'green' ? 'text-emerald-400' :
                      variant.level === 'moderate' ? 'text-amber-400' :
                      variant.level === 'aggressive' ? 'text-red-400' :
                      'text-purple-400'
                    ]" />
                  </div>
                  <p class="text-sm text-white/80 italic font-serif leading-relaxed mb-2">"{{ variant.hook }}"</p>
                  <p class="text-[11px] text-zinc-500 leading-relaxed">{{ variant.rationale }}</p>
                </button>
              </div>

              <!-- Card Personalizado (custom hook) -->
              <button
                v-if="!outlineApproved"
                @click="$emit('update:selectedHookLevel', 'custom')"
                :class="[
                  'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
                  selectedHookLevel === 'custom'
                    ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/20'
                    : 'bg-black/20 border-white/5 hover:border-white/15 cursor-pointer'
                ]"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                    ✍️ Personalizado
                  </span>
                  <CheckCircle2 v-if="selectedHookLevel === 'custom'" :size="16" class="text-cyan-400" />
                </div>
                <p class="text-[11px] text-zinc-500 mb-3">Escreva seu próprio hook mesclando as variantes acima.</p>
                <textarea
                  v-if="selectedHookLevel === 'custom'"
                  :value="customHookText"
                  @input="$emit('update:customHookText', ($event.target as HTMLTextAreaElement).value)"
                  rows="3"
                  placeholder="Ex: Misture o tom do Aggressive com a sutileza do Moderate..."
                  class="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-sm text-white/90 italic font-serif placeholder-zinc-600 focus:border-cyan-500/50 outline-none transition-all resize-none"
                  @click.stop
                ></textarea>
              </button>

              <!-- Preview do hook custom quando aprovado -->
              <div
                v-if="outlineApproved && selectedHookLevel === 'custom' && customHookText"
                class="p-4 rounded-xl border-2 bg-cyan-500/10 border-cyan-500/40"
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                    ✍️ Personalizado
                  </span>
                  <CheckCircle2 :size="16" class="text-cyan-400" />
                </div>
                <p class="text-sm text-white/80 italic font-serif leading-relaxed">"{{ customHookText }}"</p>
              </div>
            </div>

            <!-- Fallback: hookCandidate antigo (compatibilidade) -->
            <div v-else-if="outline.hookCandidate" class="bg-black/30 p-3 rounded-lg border border-red-500/10">
              <p class="text-sm text-white/80 italic font-serif">"{{ outline.hookCandidate }}"</p>
            </div>
          </div>

          <!-- Cenas Personalizadas do Criador -->
          <div
            v-if="!outlineApproved || customScenes.length > 0"
            class="md:col-span-2 bg-teal-500/5 p-5 rounded-2xl border border-teal-500/10"
          >
            <div class="flex items-center justify-between mb-4">
              <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-teal-400/80">
                <Clapperboard :size="12" /> Cenas Personalizadas
                <span v-if="customScenes.length > 0" class="ml-1 px-1.5 py-0.5 bg-teal-500/20 rounded text-[10px] font-mono">
                  {{ customScenes.length }}/{{ maxCustomScenes }}
                </span>
              </h4>
              <button
                v-if="!outlineApproved && customScenes.length < maxCustomScenes"
                @click="$emit('addCustomScene')"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 text-teal-300 hover:bg-teal-500/20 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                <Plus :size="12" /> Adicionar Cena
              </button>
            </div>

            <!-- Info helper -->
            <p v-if="customScenes.length === 0 && !outlineApproved" class="text-xs text-teal-300/40 mb-3">
              Defina cenas de introdução com narração e imagem de referência. O roteirista seguirá estas cenas e depois conectará com o plano do Arquiteto.
            </p>

            <!-- Lista de cenas -->
            <div class="space-y-4">
              <div
                v-for="(scene, idx) in customScenes"
                :key="idx"
                class="relative bg-black/30 rounded-xl border border-teal-500/10 p-4 group"
              >
                <!-- Header da cena -->
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center text-xs font-mono font-bold text-teal-300">
                      {{ idx + 1 }}
                    </span>
                    <span class="text-[10px] font-black uppercase tracking-widest text-teal-400/60">Cena {{ idx + 1 }}</span>
                  </div>
                  <button
                    v-if="!outlineApproved"
                    @click="$emit('removeCustomScene', idx)"
                    class="p-1 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                  <!-- Narração + Prompt da imagem -->
                  <div class="space-y-2">
                    <textarea
                      v-if="!outlineApproved"
                      :value="scene.narration"
                      @input="$emit('updateCustomSceneNarration', idx, ($event.target as HTMLTextAreaElement).value)"
                      rows="3"
                      :placeholder="`Narração da cena ${idx + 1}... Ex: 'Um documento esquecido revela quem autorizou tudo.'`"
                      class="w-full bg-black/40 border border-teal-500/15 rounded-lg px-3 py-2 text-sm text-white/90 placeholder-zinc-600 focus:border-teal-500/40 outline-none transition-all resize-none"
                    ></textarea>
                    <p v-else class="text-sm text-white/80 italic font-serif leading-relaxed">
                      "{{ scene.narration }}"
                    </p>
                    <input
                      v-if="!outlineApproved"
                      :value="scene.imagePrompt"
                      @input="$emit('updateCustomSceneImagePrompt', idx, ($event.target as HTMLInputElement).value)"
                      type="text"
                      :placeholder="`Prompt da imagem (opcional) — ex: 'cinematic shot of a dusty abandoned factory'`"
                      class="w-full bg-black/30 border border-teal-500/10 rounded-lg px-3 py-1.5 text-xs text-white/70 placeholder-zinc-700 focus:border-teal-500/30 outline-none transition-all"
                    />
                    <p v-else-if="scene.imagePrompt" class="text-[11px] text-teal-300/40 font-mono truncate">
                      prompt: {{ scene.imagePrompt }}
                    </p>
                  </div>

                  <!-- Upload de imagem de referência -->
                  <div class="flex flex-col items-center justify-center">
                    <div
                      v-if="scene.referenceImagePreview"
                      class="relative w-full aspect-video rounded-lg overflow-hidden border border-teal-500/20"
                    >
                      <img :src="scene.referenceImagePreview" class="w-full h-full object-cover" alt="Referência visual" />
                      <button
                        v-if="!outlineApproved"
                        @click="$emit('removeSceneImage', idx)"
                        class="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <X :size="12" />
                      </button>
                    </div>
                    <label
                      v-else-if="!outlineApproved"
                      class="w-full aspect-video rounded-lg border-2 border-dashed border-teal-500/15 hover:border-teal-500/30 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Upload v-if="uploadingSceneImage !== idx" :size="16" class="text-teal-500/30" />
                      <span v-if="uploadingSceneImage !== idx" class="text-[10px] text-teal-400/30 font-bold uppercase tracking-wider">Ref. Visual</span>
                      <span v-else class="text-[10px] text-teal-300 animate-pulse">Enviando...</span>
                      <input type="file" accept="image/*" class="hidden" @change="$emit('uploadSceneReferenceImage', idx, $event)" :disabled="uploadingSceneImage !== null" />
                    </label>
                    <div v-else class="w-full aspect-video rounded-lg border border-zinc-800 flex items-center justify-center">
                      <span class="text-[10px] text-zinc-600">Sem referência</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-primary/5 p-5 rounded-2xl border border-primary/10">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/80 mb-3">
              <Target :size="12" /> Setup / Promise
            </h4>
            <p class="text-sm text-zinc-300/90 leading-relaxed">{{ outline.promiseSetup }}</p>
          </div>
        </div>

        <!-- Rising Beats -->
        <div class="bg-amber-500/5 p-5 rounded-2xl border border-amber-500/10">
          <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400/80 mb-4">
            <TrendingUp :size="12" /> Beats de Revelação ({{ outline.risingBeats?.length }})
          </h4>
          <div class="space-y-3">
            <div v-for="(beat, idx) in outline.risingBeats" :key="idx" class="flex gap-4 items-start">
              <div class="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-mono font-bold text-amber-300 shrink-0 mt-0.5">
                {{ beat.order || (Number(idx) + 1) }}
              </div>
              <div class="flex-1">
                <p class="text-sm text-white/80">{{ beat.revelation }}</p>
                <p class="text-xs text-amber-300/50 mt-1 italic">→ Levanta: "{{ beat.newQuestion }}"</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Climax + Resolution -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-purple-500/5 p-5 rounded-2xl border border-purple-500/10">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-400/80 mb-3">
              <Star :size="12" /> Clímax
            </h4>
            <div class="flex items-center gap-2 mb-3">
              <span class="px-2 py-1 bg-purple-500/20 rounded text-xs font-bold text-purple-300 uppercase">{{ outline.climaxFormula }}</span>
            </div>
            <p class="text-sm text-purple-200/70 leading-relaxed">{{ outline.climaxMoment }}</p>
          </div>

          <div class="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400/80 mb-3">
              <CheckCircle2 :size="12" /> Resolução
            </h4>
            <ul class="space-y-1 mb-3">
              <li v-for="(point, idx) in outline.resolutionPoints" :key="idx" class="text-sm text-emerald-200/70 flex gap-2">
                <span class="text-emerald-500">•</span> {{ point }}
              </li>
            </ul>
            <p class="text-xs text-emerald-300/40 italic">{{ outline.resolutionAngle }}</p>
          </div>
        </div>

        <!-- Emotional Arc + Tone -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-pink-500/5 p-4 rounded-2xl border border-pink-500/10">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-pink-400/80 mb-2">
              <Heart :size="12" /> Arco Emocional
            </h4>
            <p class="text-sm text-pink-200/70">{{ outline.emotionalArc }}</p>
          </div>
          <div class="bg-zinc-500/5 p-4 rounded-2xl border border-zinc-500/10">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400/80 mb-2">
              <Volume2 :size="12" /> Progressão de Tom
            </h4>
            <p class="text-sm text-zinc-200/70">{{ outline.toneProgression }}</p>
          </div>
        </div>

        <!-- Scene Distribution -->
        <div class="bg-cyan-500/5 p-4 rounded-2xl border border-cyan-500/10">
          <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-400/80 mb-3">
            <BarChart3 :size="12" /> Distribuição de Cenas
          </h4>
          <div class="flex flex-wrap gap-3">
            <div v-for="(count, segment) in outline.segmentDistribution" :key="segment" class="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-lg">
              <span class="text-xs font-bold uppercase tracking-widest text-cyan-300/60">{{ segment }}</span>
              <span class="text-sm font-mono font-bold text-white">{{ count }}</span>
              <span class="text-xs text-cyan-400/40">cenas</span>
            </div>
          </div>
        </div>

        <!-- Viral-First: One-Sentence Promise + Shock Contrast Beat -->
        <div v-if="outline.oneSentencePromise || outline.shockContrastBeat" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-if="outline.oneSentencePromise" class="bg-amber-500/5 p-5 rounded-2xl border border-amber-500/10">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400/80 mb-3">
              <Target :size="12" /> Promessa do Vídeo (On-Screen)
            </h4>
            <p class="text-lg font-bold text-amber-200/90 leading-relaxed">"{{ outline.oneSentencePromise }}"</p>
            <p class="text-[10px] text-amber-400/40 mt-2 uppercase tracking-wider">Aparecerá como texto overlay na primeira cena</p>
          </div>
          <div v-if="outline.shockContrastBeat" class="bg-orange-500/5 p-5 rounded-2xl border border-orange-500/10">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-400/80 mb-3">
              <Zap :size="12" /> Contraste de Choque
            </h4>
            <div class="flex items-center gap-2 mb-2">
              <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-orange-500/20 text-orange-400 border border-orange-500/20">
                {{ outline.shockContrastBeat.type?.replace('_', ' ') }}
              </span>
            </div>
            <p class="text-sm text-orange-200/70 leading-relaxed">{{ outline.shockContrastBeat.description }}</p>
            <p class="text-[10px] text-orange-400/40 mt-2 uppercase tracking-wider">Deve estar presente nas primeiras 1-2 cenas</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Map, CheckCircle2, RotateCw, ChevronUp, ChevronDown, Info, Zap,
  Target, TrendingUp, Star, Heart, Volume2, BarChart3,
  Clapperboard, Plus, Trash2, Upload, X
} from 'lucide-vue-next'

function isOutlineApproved(output: any): boolean {
  if (!output?.stageGates) return false
  const gate = output.stageGates.find((g: any) => g.stage === 'STORY_OUTLINE')
  return gate?.status === 'APPROVED'
}

const props = defineProps<{
  output: any
  isPlanoStage: boolean
  expanded: boolean
  approving: boolean
  regeneratingOutline: boolean
  selectedHookLevel: string
  customHookText: string
  customScenes: Array<{ narration: string; imagePrompt: string; referenceImagePreview: string | null }>
  maxCustomScenes: number
  uploadingSceneImage: number | null
}>()

const outline = computed(() => props.output?.storyOutlineData?.outlineData)
const outlineApproved = computed(() => isOutlineApproved(props.output))

defineEmits<{
  toggleExpanded: []
  approveStoryOutline: []
  openOutlineFeedback: []
  'update:selectedHookLevel': [value: string]
  'update:customHookText': [value: string]
  addCustomScene: []
  removeCustomScene: [idx: number]
  updateCustomSceneNarration: [idx: number, value: string]
  updateCustomSceneImagePrompt: [idx: number, value: string]
  uploadSceneReferenceImage: [idx: number, event: Event]
  removeSceneImage: [idx: number]
}>()
</script>

<style scoped>
.glass-card {
  @apply bg-black/40 backdrop-blur-xl border border-white/5;
}
</style>
