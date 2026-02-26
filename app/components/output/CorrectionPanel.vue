<template>
  <div v-if="correctionMode" class="mb-12">
    <!-- Correction Header Banner -->
    <div class="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/30 rounded-3xl p-8 mb-8 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px]"></div>
      <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 class="text-2xl font-black text-amber-200 flex items-center gap-3 mb-2">
            <Wrench :size="24" class="text-amber-500" />
            Modo Correção Ativo
          </h2>
          <p class="text-amber-200/60 text-sm max-w-2xl">
            Corrija imagens com defeitos e reprocesse o motion das cenas afetadas.
            Após as correções, aprove as imagens e o motion para re-renderizar o vídeo.
          </p>
          <div class="flex items-center gap-4 mt-4">
            <div class="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300/80">
              <ImageIcon :size="12" />
              <span>{{ correctedScenes.size }} cena(s) com imagem corrigida</span>
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 bg-pink-500/10 border border-pink-500/20 rounded-lg text-xs text-pink-300/80">
              <Clapperboard :size="12" />
              <span>{{ motionRegeneratedScenes.size }} motion(s) reprocessado(s)</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <button
            @click="$emit('exitCorrectionMode')"
            class="px-6 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/30 font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 text-xs"
          >
            <X :size="16" />
            CANCELAR
          </button>
        </div>
      </div>
    </div>

    <!-- Correction Scenes Grid -->
    <div class="space-y-6">
      <div v-for="scene in output.scenes" :key="'correction-' + scene.id"
        class="glass-card rounded-2xl border-white/5 overflow-hidden transition-all"
        :class="{
          'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]': correctedScenes.has(scene.id),
          'border-pink-500/30': motionRegeneratedScenes.has(scene.id) && !correctedScenes.has(scene.id)
        }"
      >
        <!-- Scene Header -->
        <div class="px-6 py-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono font-bold text-zinc-400">
              {{ scene.order + 1 }}
            </div>
            <span class="mono-label text-zinc-500">CENA {{ scene.order + 1 }}</span>
            <span class="text-zinc-600 text-xs">{{ scene.estimatedDuration }}s</span>

            <!-- Status badges -->
            <span v-if="scene.imageStatus === 'restricted'"
              class="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-red-500/20 text-red-400 animate-pulse">
              🔴 Restrita
            </span>
            <span v-else-if="scene.imageStatus === 'error'"
              class="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-orange-500/20 text-orange-400">
              ⚠️ Erro
            </span>
            <span v-else-if="correctedScenes.has(scene.id) && !motionRegeneratedScenes.has(scene.id)"
              class="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-400 animate-pulse">
              Motion pendente
            </span>
            <span v-else-if="correctedScenes.has(scene.id) && motionRegeneratedScenes.has(scene.id)"
              class="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-400">
              Corrigida
            </span>
          </div>

          <p class="text-zinc-500 text-xs max-w-md truncate italic">
            "{{ scene.narration?.substring(0, 80) }}..."
          </p>
        </div>

        <!-- Scene Content: Image + Motion side by side -->
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- COLUNA 1: Imagem -->
          <div class="space-y-3">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-400/80">
              <ImageIcon :size="12" /> Imagem da Cena
            </h4>

            <!-- Has selected image -->
            <div v-if="scene.images.find((i: any) => i.role === 'start' && i.isSelected) || scene.images.find((i: any) => i.isSelected && !i.role)">
              <div class="flex flex-col gap-4">
                <!-- Start Frame -->
                <div>
                  <div class="flex justify-between items-center mb-1.5 px-0.5">
                    <span class="text-[10px] uppercase tracking-wider font-black text-blue-400/60 flex items-center gap-1.5">
                      <Play :size="10" /> Frame Inicial (Start)
                    </span>
                    <button
                      @click.stop="$emit('regenerateSceneImages', scene, 'start')"
                      :disabled="!!regeneratingSceneId"
                      class="text-[9px] uppercase tracking-tighter font-bold text-blue-400/40 hover:text-blue-400 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw :size="8" :class="{ 'animate-spin': regeneratingSceneId === scene.id + '-start' }" />
                      Regenerar Start
                    </button>
                  </div>
                  <div class="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 transition-all relative group" :class="{ 'ring-1 ring-blue-500/30': regeneratingSceneId === scene.id + '-start' }">
                    <img
                      :src="`/api/scene-images/${(scene.images.find((i: any) => i.role === 'start' && i.isSelected) || scene.images.find((i: any) => i.isSelected))?.id}?t=${imageVersions[scene.id] || 0}`"
                      class="w-full h-full object-cover"
                      :class="{ 'opacity-30 grayscale': regeneratingSceneId === scene.id + '-start' }"
                      loading="lazy"
                      alt="Start Frame"
                    />
                    <div v-if="regeneratingSceneId === scene.id + '-start'" class="absolute inset-0 flex items-center justify-center">
                      <span class="animate-spin w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full"></span>
                    </div>
                    <button
                      @click.stop="$emit('openImage', (scene.images.find((i: any) => i.role === 'start' && i.isSelected) || scene.images.find((i: any) => i.isSelected))?.id)"
                      class="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur rounded-lg text-white/70 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
                      title="Ampliar imagem"
                    >
                      <Eye :size="16" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Regenerate Image Button -->
              <button
                @click.stop="$emit('regenerateSceneImages', scene)"
                :disabled="!!regeneratingSceneId"
                class="mt-3 w-full px-4 py-3 bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
              >
                <span v-if="regeneratingSceneId === scene.id" class="animate-spin w-4 h-4 border-2 border-purple-300/30 border-t-purple-300 rounded-full"></span>
                <RotateCw v-else :size="14" />
                {{ regeneratingSceneId === scene.id ? 'GERANDO NOVA IMAGEM...' : 'REGENERAR IMAGEM' }}
              </button>
            </div>
            <!-- Cena RESTRITA pelo filtro de conteúdo -->
            <div v-else-if="scene.imageStatus === 'restricted'" class="space-y-3">
              <div class="aspect-video bg-red-500/5 rounded-xl flex flex-col items-center justify-center border border-dashed border-red-500/30 text-center p-6 gap-3">
                <ShieldAlert :size="32" class="text-red-400/60" />
                <p class="text-sm font-bold text-red-300">Imagem bloqueada pelo filtro de conteúdo</p>
                <p class="text-xs text-red-300/50 max-w-sm">
                  O modelo rejeitou o prompt visual por conter termos sensíveis.
                  Use a IA para reescrever o prompt em um nível mais seguro.
                </p>
              </div>

              <!-- Seletor de Nível de Segurança (IA) -->
              <div class="bg-white/[0.02] p-3 rounded-lg border border-white/5">
                <h4 class="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/40 mb-2.5">
                  <Sparkles :size="10" /> Reescrever com IA
                </h4>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    @click.stop="$emit('sanitizeRestrictedPrompt', scene, 'intense')"
                    :disabled="sanitizingSceneId === scene.id"
                    class="group px-3 py-2.5 bg-red-500/8 border border-red-500/20 text-red-300/80 hover:bg-red-500/15 hover:text-red-200 hover:border-red-500/40 rounded-lg transition-all flex flex-col items-center gap-1 text-center disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <span class="text-base">🔴</span>
                    <span class="text-[10px] font-bold uppercase tracking-wider">Intenso</span>
                    <span class="text-[9px] text-white/25 leading-tight">Original</span>
                  </button>
                  <button
                    @click.stop="$emit('sanitizeRestrictedPrompt', scene, 'moderate')"
                    :disabled="sanitizingSceneId === scene.id"
                    class="group px-3 py-2.5 bg-amber-500/8 border border-amber-500/20 text-amber-300/80 hover:bg-amber-500/15 hover:text-amber-200 hover:border-amber-500/40 rounded-lg transition-all flex flex-col items-center gap-1 text-center disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <span v-if="sanitizingSceneId === scene.id && sanitizingLevel === 'moderate'" class="animate-spin w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full"></span>
                    <span v-else class="text-base">🟡</span>
                    <span class="text-[10px] font-bold uppercase tracking-wider">Moderado</span>
                    <span class="text-[9px] text-white/25 leading-tight">Sem gore/violência</span>
                  </button>
                  <button
                    @click.stop="$emit('sanitizeRestrictedPrompt', scene, 'safe')"
                    :disabled="sanitizingSceneId === scene.id"
                    class="group px-3 py-2.5 bg-emerald-500/8 border border-emerald-500/20 text-emerald-300/80 hover:bg-emerald-500/15 hover:text-emerald-200 hover:border-emerald-500/40 rounded-lg transition-all flex flex-col items-center gap-1 text-center disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <span v-if="sanitizingSceneId === scene.id && sanitizingLevel === 'safe'" class="animate-spin w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full"></span>
                    <span v-else class="text-base">🟢</span>
                    <span class="text-[10px] font-bold uppercase tracking-wider">Seguro</span>
                    <span class="text-[9px] text-white/25 leading-tight">Abstrato/atmosférico</span>
                  </button>
                </div>
              </div>

              <!-- Prompt editável -->
              <div class="bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                <div class="flex items-center justify-between mb-1.5">
                  <h4 class="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-red-400/60">
                    <AlertTriangle :size="10" />
                    {{ restrictedPromptEdits[scene.id] && restrictedPromptEdits[scene.id] !== scene.visualDescription ? 'Prompt Reescrito' : 'Prompt Bloqueado' }}
                  </h4>
                  <span
                    v-if="restrictedPromptEdits[scene.id] && restrictedPromptEdits[scene.id] !== scene.visualDescription"
                    class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-amber-500/15 text-amber-300/70': lastSanitizeLevel[scene.id] === 'moderate',
                      'bg-emerald-500/15 text-emerald-300/70': lastSanitizeLevel[scene.id] === 'safe',
                      'bg-purple-500/15 text-purple-300/70': !lastSanitizeLevel[scene.id]
                    }"
                  >
                    {{ lastSanitizeLevel[scene.id] === 'moderate' ? '🟡 Moderado' : lastSanitizeLevel[scene.id] === 'safe' ? '🟢 Seguro' : '✏️ Editado' }}
                  </span>
                </div>
                <textarea
                  :value="restrictedPromptEdits[scene.id]"
                  @input="$emit('updateRestrictedPrompt', scene.id, ($event.target as HTMLTextAreaElement).value)"
                  class="w-full bg-black/40 border border-red-500/20 rounded-lg p-2.5 text-xs text-white/80 leading-relaxed focus:border-red-500/50 focus:outline-none resize-y min-h-[60px]"
                  rows="3"
                  :placeholder="scene.visualDescription"
                ></textarea>
              </div>

              <!-- Botões de retry -->
              <div class="flex gap-2">
                <button
                  @click.stop="$emit('retryRestrictedImage', scene, 'same')"
                  :disabled="!!regeneratingSceneId"
                  class="flex-1 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <span v-if="regeneratingSceneId === scene.id && !restrictedPromptEdits[scene.id]" class="animate-spin w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full"></span>
                  <RotateCw v-else :size="14" />
                  TENTAR ORIGINAL
                </button>
                <button
                  v-if="restrictedPromptEdits[scene.id] && restrictedPromptEdits[scene.id] !== scene.visualDescription"
                  @click.stop="$emit('retryRestrictedImage', scene, 'edited')"
                  :disabled="!!regeneratingSceneId"
                  class="flex-1 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <span v-if="regeneratingSceneId === scene.id && restrictedPromptEdits[scene.id]" class="animate-spin w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full"></span>
                  <Sparkles v-else :size="14" />
                  {{ regeneratingSceneId === scene.id ? 'GERANDO...' : 'GERAR COM PROMPT EDITADO' }}
                </button>
              </div>
            </div>
            <!-- Sem imagem (genérico) -->
            <div v-else class="aspect-video bg-white/5 rounded-xl flex items-center justify-center border border-dashed border-white/10 text-zinc-600 text-sm">
              Sem imagem
            </div>

            <!-- Image History -->
            <div v-if="scene.images?.length > 1" class="mt-2">
              <span class="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1.5 block">Histórico</span>
              <div class="flex gap-2 overflow-x-auto pb-1">
                <div
                  v-for="img in scene.images.filter((i: any) => !i.isSelected)"
                  :key="img.id"
                  class="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 cursor-pointer opacity-50 hover:opacity-100 transition-all"
                  @click="$emit('openImage', img.id)"
                >
                  <img
                    :src="`/api/scene-images/${img.id}`"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            <!-- Visual Description (editável no modo correção) -->
            <div class="bg-primary/5 p-3 rounded-lg border border-primary/10">
              <div class="flex items-center justify-between mb-1.5">
                <h4 class="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary/60">
                  <Eye :size="10" /> Visual Prompt
                </h4>
                <button
                  v-if="!editingPromptSceneId || editingPromptSceneId !== scene.id"
                  @click="$emit('startEditPrompt', scene)"
                  class="text-xs text-primary/40 hover:text-primary/70 transition-colors flex items-center gap-1 uppercase tracking-wider"
                >
                  <Edit :size="10" /> Editar
                </button>
                <div v-else class="flex items-center gap-2">
                  <button @click="$emit('cancelEditPrompt', scene)" class="text-xs text-zinc-500 hover:text-white transition-colors uppercase tracking-wider">
                    Cancelar
                  </button>
                  <button @click="$emit('saveEditPrompt', scene)" class="text-xs text-primary hover:text-primary/80 transition-colors uppercase tracking-wider font-bold">
                    Salvar
                  </button>
                </div>
              </div>
              <div v-if="editingPromptSceneId === scene.id" class="space-y-3">
                <div>
                  <span class="text-[9px] font-black uppercase tracking-widest text-blue-400/40 mb-1 block">Start Prompt</span>
                  <textarea
                    :value="editingPromptText"
                    @input="$emit('update:editingPromptText', ($event.target as HTMLTextAreaElement).value)"
                    class="w-full bg-black/40 border border-primary/20 rounded-lg p-2.5 text-xs text-white/80 leading-relaxed focus:border-primary/50 focus:outline-none resize-y min-h-[60px]"
                    rows="3"
                  ></textarea>
                </div>
              </div>
              <div v-else class="space-y-3">
                <div>
                  <span class="text-[9px] font-black uppercase tracking-widest text-blue-400/40 mb-0.5 block">Visual Prompt</span>
                  <p class="text-xs text-zinc-300/80 leading-relaxed">{{ scene.visualDescription }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- COLUNA 2: Motion -->
          <div class="space-y-3">
            <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-pink-400/80">
              <Clapperboard :size="12" /> Motion da Cena
            </h4>

            <!-- Motion Preview -->
            <div v-if="getSelectedVideo(scene)" class="relative group/video">
              <div class="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 hover:border-pink-500/30 transition-all">
                <video
                  controls loop
                  class="w-full h-full object-cover"
                  :src="`/api/scene-videos/${getSelectedVideo(scene).id}/stream?t=${motionVersions[scene.id] || 0}`"
                  :key="'motion-' + scene.id + '-' + (motionVersions[scene.id] || 0)"
                ></video>
                <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-xs text-white/80 font-mono pointer-events-none">
                  {{ getSelectedVideo(scene).provider }} • {{ getSelectedVideo(scene).duration?.toFixed(1) }}s
                </div>
              </div>

              <!-- Regenerate Motion Button -->
              <button
                @click="$emit('regenerateMotionCorrection', scene)"
                :disabled="regeneratingMotionSceneIds.has(scene.id)"
                class="mt-3 w-full px-4 py-3 bg-pink-500/10 border border-pink-500/30 text-pink-300 hover:bg-pink-500/20 hover:text-pink-200 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
              >
                <span v-if="regeneratingMotionSceneIds.has(scene.id)" class="animate-spin w-4 h-4 border-2 border-pink-300/30 border-t-pink-300 rounded-full"></span>
                <RotateCw v-else :size="14" />
                {{ regeneratingMotionSceneIds.has(scene.id) ? 'REPROCESSANDO MOTION...' : 'REGENERAR MOTION' }}
              </button>
            </div>
            <div v-else class="relative">
              <div class="aspect-video bg-pink-500/5 rounded-xl flex flex-col items-center justify-center gap-3 border border-dashed border-pink-500/20 text-pink-500/50">
                <Clapperboard :size="32" class="opacity-40" />
                <span class="text-xs uppercase tracking-wider">Sem motion gerado</span>
              </div>

              <!-- Generate Motion Button (quando não tem) -->
              <button
                v-if="scene.images?.length > 0"
                @click="$emit('regenerateMotionCorrection', scene)"
                :disabled="regeneratingMotionSceneIds.has(scene.id)"
                class="mt-3 w-full px-4 py-3 bg-pink-500/10 border border-pink-500/30 text-pink-300 hover:bg-pink-500/20 hover:text-pink-200 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
              >
                <span v-if="regeneratingMotionSceneIds.has(scene.id)" class="animate-spin w-4 h-4 border-2 border-pink-300/30 border-t-pink-300 rounded-full"></span>
                <Zap v-else :size="14" />
                {{ regeneratingMotionSceneIds.has(scene.id) ? 'GERANDO MOTION...' : 'GERAR MOTION' }}
              </button>
            </div>

            <!-- Warning: imagem corrigida mas motion não reprocessado -->
            <div v-if="correctedScenes.has(scene.id) && !motionRegeneratedScenes.has(scene.id)"
              class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2"
            >
              <AlertTriangle :size="14" class="text-amber-400 shrink-0 mt-0.5" />
              <p class="text-amber-200/70 text-xs">
                A imagem foi corrigida mas o motion ainda usa a imagem anterior.
                <strong>Reprocesse o motion</strong> para sincronizar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Correction Actions Footer -->
    <div class="mt-8 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/30 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
      <div>
        <h3 class="text-xl font-bold text-emerald-200 flex items-center gap-2 mb-2">
          <CheckCircle2 :size="20" class="text-emerald-500" />
          Finalizar Correções
        </h3>
        <p class="text-emerald-200/60 text-sm max-w-xl">
          Quando terminar as correções, aprove para re-renderizar o vídeo com as cenas atualizadas.
          <span v-if="pendingMotionScenes.length > 0" class="text-amber-400">
            Atenção: {{ pendingMotionScenes.length }} cena(s) com imagem corrigida sem motion reprocessado.
          </span>
        </p>
      </div>
      <button
        @click="$emit('finishCorrectionsAndRender')"
        :disabled="rendering || pendingMotionScenes.length > 0"
        class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
      >
        <span v-if="rendering" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
        <Zap v-else :size="20" />
        {{ rendering ? 'RENDERIZANDO...' : 'APROVAR E RE-RENDERIZAR' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Wrench, ImageIcon, Clapperboard, X, RotateCw, Eye, Edit, Play, ShieldAlert, Sparkles, AlertTriangle, Zap, CheckCircle2 } from 'lucide-vue-next'

defineProps<{
  output: any
  correctionMode: boolean
  rendering: boolean
  correctedScenes: Set<string>
  motionRegeneratedScenes: Set<string>
  regeneratingSceneId: string | null
  regeneratingMotionSceneIds: Set<string>
  imageVersions: Record<string, number>
  motionVersions: Record<string, number>
  pendingMotionScenes: any[]
  editingPromptSceneId: string | null
  editingPromptText: string
  sanitizingSceneId: string | null
  sanitizingLevel: string | null
  restrictedPromptEdits: Record<string, string>
  lastSanitizeLevel: Record<string, string>
  getSelectedVideo: (scene: any) => any
}>()

defineEmits<{
  exitCorrectionMode: []
  finishCorrectionsAndRender: []
  regenerateSceneImages: [scene: any, role?: 'start' | 'end']
  regenerateMotionCorrection: [scene: any]
  openImage: [id: string]
  startEditPrompt: [scene: any]
  cancelEditPrompt: [scene: any]
  saveEditPrompt: [scene: any]
  'update:editingPromptText': [value: string]
  sanitizeRestrictedPrompt: [scene: any, level: 'intense' | 'moderate' | 'safe']
  retryRestrictedImage: [scene: any, mode: 'same' | 'edited']
  updateRestrictedPrompt: [sceneId: string, value: string]
}>()
</script>

<style scoped>
.glass-card {
  @apply bg-black/40 backdrop-blur-xl border border-white/5;
}
</style>
