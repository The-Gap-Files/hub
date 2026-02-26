<template>
  <div v-if="(output.status === 'COMPLETED' || output.status === 'RENDERED') && !correctionMode" class="mb-12 p-6 rounded-2xl border border-white/10 bg-white/5">
    <h3 class="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">
      <Star :size="16" class="text-amber-400" />
      Opções extras
      <!-- Custos reais já gastos nessas opções -->
      <span v-if="getExtraCost('thumbnail') > 0 || getExtraCost('social_kit') > 0" class="text-xs text-zinc-600 font-normal ml-auto flex items-center gap-1.5 font-mono">
        <DollarSign :size="10" />
        <span v-if="getExtraCost('thumbnail') > 0" class="text-amber-400/60">
          Thumbnails: {{ formatCost(getExtraCost('thumbnail')) }}
        </span>
        <span v-if="getExtraCost('thumbnail') > 0 && getExtraCost('social_kit') > 0" class="text-zinc-700">•</span>
        <span v-if="getExtraCost('social_kit') > 0" class="text-violet-400/60">
          Social Kit: {{ formatCost(getExtraCost('social_kit')) }}
        </span>
      </span>
    </h3>
    <div class="flex flex-col gap-4">
      <!-- Criar thumbnails -->
      <div>
        <div v-if="!output.thumbnailProduct?.candidates?.length && !output.thumbnailProduct?.selectedStoragePath" class="space-y-3">
          <!-- Hook text sugerido -->
          <div class="flex items-center gap-2">
            <input
              :value="thumbnailHookText"
              @input="$emit('update:thumbnailHookText', ($event.target as HTMLInputElement).value)"
              type="text"
              maxlength="40"
              placeholder="Hook text sugerido (ex: ELE SABIA DEMAIS)"
              class="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 uppercase tracking-wider"
            />
            <button
              @click="$emit('generateThumbnails')"
              :disabled="generatingThumbnails"
              class="btn-secondary flex items-center gap-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 shrink-0 cursor-pointer"
            >
              <ImageIcon :size="16" :class="generatingThumbnails ? 'animate-spin' : ''" />
              {{ generatingThumbnails ? 'Gerando...' : 'Criar thumbnails' }}
            </button>
          </div>
          <p class="text-xs text-zinc-500">Gera 4 opções via Photon Flash + Claude Haiku. O hook text é opcional.</p>
        </div>
        <!-- Grid de thumbnails candidatas -->
        <div v-else-if="output.thumbnailProduct?.candidates?.length" class="space-y-3">
          <p class="text-xs text-zinc-400">Clique para ampliar e confirmar:</p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              v-for="(cand, idx) in output.thumbnailProduct?.candidates"
              :key="idx"
              @click="$emit('openThumbnailPreview', Number(idx))"
              class="relative aspect-video rounded-xl overflow-hidden border-2 border-white/10 transition-all hover:border-primary hover:scale-[1.02] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary group"
            >
              <img :src="`data:image/png;base64,${cand.base64}`" :alt="`Thumbnail ${Number(idx) + 1}`" class="w-full h-full object-cover" />
              <span v-if="cand.hookText" class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-xs font-black text-white uppercase tracking-wider text-center opacity-0 group-hover:opacity-100 transition-opacity">
                {{ cand.hookText }}
              </span>
            </button>
          </div>
        </div>
        <!-- Thumbnail selecionada -->
        <div v-else-if="!!output.thumbnailProduct?.selectedStoragePath" class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="flex items-center gap-3">
            <button
              @click="$emit('showThumbnailLightbox')"
              class="w-32 aspect-video rounded-lg overflow-hidden border-2 border-emerald-500/30 hover:border-emerald-400 transition-all hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 group relative"
            >
              <img :src="`/api/outputs/${outputId}/thumbnail?t=${thumbnailVersion}`" alt="Thumbnail escolhida" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Eye :size="20" class="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </button>
            <span class="text-xs text-emerald-400">Thumbnail selecionada</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="$emit('removeThumbnail')"
              :disabled="removingThumbnail"
              class="btn-secondary flex items-center gap-2 text-zinc-400 border-zinc-600/50 hover:border-red-500/50 hover:text-red-400 text-xs"
            >
              {{ removingThumbnail ? 'Removendo...' : 'Remover' }}
            </button>
            <button
              @click="$emit('generateThumbnails')"
              :disabled="generatingThumbnails"
              class="btn-secondary flex items-center gap-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs"
            >
              <ImageIcon :size="14" :class="generatingThumbnails ? 'animate-spin' : ''" />
              {{ generatingThumbnails ? 'Gerando...' : 'Gerar novamente' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Social Media Kit -->
      <div class="border-t border-white/5 pt-4">
        <!-- Botão gerar -->
        <button
          v-if="!output.socialKitData?.kitData"
          @click="$emit('generateSocialKit')"
          :disabled="generatingSocialKit"
          class="btn-secondary flex items-center gap-2 text-violet-400 border-violet-500/30 hover:bg-violet-500/10 cursor-pointer"
        >
          <Share2 :size="16" :class="generatingSocialKit ? 'animate-spin' : ''" />
          {{ generatingSocialKit ? 'Gerando kit de publicação...' : 'Gerar Social Media Kit' }}
        </button>
        <p v-if="!output.socialKitData?.kitData" class="text-xs text-zinc-500 mt-1">Títulos, descrições e hashtags otimizados para YouTube, TikTok, Shorts e Instagram via Claude Haiku.</p>

        <!-- Kit gerado -->
        <div v-if="output.socialKitData?.kitData" class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-violet-300 flex items-center gap-2">
              <Share2 :size="14" />
              Social Media Kit
            </span>
            <div class="flex items-center gap-2">
              <button
                @click="$emit('generateSocialKit')"
                :disabled="generatingSocialKit"
                class="text-xs text-zinc-500 hover:text-violet-400 transition-colors cursor-pointer"
              >
                {{ generatingSocialKit ? 'Gerando...' : 'Regerar' }}
              </button>
            </div>
          </div>

          <!-- Tabs de plataformas -->
          <div class="flex gap-1 bg-black/30 rounded-lg p-1">
            <button
              v-for="tab in socialKitTabs"
              :key="tab.key"
              @click="$emit('update:activeSocialTab', tab.key)"
              :class="[
                'px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer',
                activeSocialTab === tab.key
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              ]"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Conteúdo da aba ativa -->
          <div v-if="activeSocialContent" class="space-y-3">
            <!-- Título -->
            <div class="bg-black/20 rounded-xl p-3 border border-white/5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs text-zinc-500 uppercase tracking-wider font-bold">Título</span>
                <button @click="$emit('copySocialField', activeSocialContent.title)" class="text-xs text-zinc-600 hover:text-violet-400 transition-colors cursor-pointer">
                  Copiar
                </button>
              </div>
              <p class="text-sm text-white font-medium">{{ activeSocialContent.title }}</p>
            </div>

            <!-- Descrição -->
            <div class="bg-black/20 rounded-xl p-3 border border-white/5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs text-zinc-500 uppercase tracking-wider font-bold">Descrição</span>
                <button @click="$emit('copySocialField', activeSocialContent.description)" class="text-xs text-zinc-600 hover:text-violet-400 transition-colors cursor-pointer">
                  Copiar
                </button>
              </div>
              <p class="text-xs text-zinc-300 whitespace-pre-line leading-relaxed">{{ activeSocialContent.description }}</p>
            </div>

            <!-- Hashtags -->
            <div class="bg-black/20 rounded-xl p-3 border border-white/5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs text-zinc-500 uppercase tracking-wider font-bold">Hashtags</span>
                <button @click="$emit('copySocialField', activeSocialContent.hashtags?.join(' '))" class="text-xs text-zinc-600 hover:text-violet-400 transition-colors cursor-pointer">
                  Copiar todas
                </button>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="tag in activeSocialContent.hashtags"
                  :key="tag"
                  class="px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded text-xs text-violet-300 font-medium"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>

          <!-- SEO Tags -->
          <div v-if="seoTagsNormalized.length" class="bg-black/20 rounded-xl p-3 border border-white/5">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs text-zinc-500 uppercase tracking-wider font-bold">SEO Tags</span>
              <button @click="$emit('copySocialField', seoTagsForYoutubeCopy)" class="text-xs text-zinc-600 hover:text-violet-400 transition-colors cursor-pointer">
                Copiar
              </button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in seoTagsNormalized"
                :key="tag"
                class="px-2 py-0.5 bg-zinc-800 border border-white/5 rounded text-xs text-zinc-400"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Exportar Legendas (SRT/VTT) -->
      <div class="border-t border-white/5 pt-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-xs font-bold text-cyan-300 flex items-center gap-2">
              <Subtitles :size="14" /> Exportar Legendas
            </h4>
            <p class="text-xs text-zinc-500 mt-1">Arquivo de legenda com timestamps do ElevenLabs para upload no YouTube, Vimeo, etc.</p>
          </div>
          <div class="flex items-center gap-2">
            <a
              :href="`/api/outputs/${outputId}/export-subtitles?format=srt`"
              download
              class="btn-secondary flex items-center gap-1.5 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 text-xs cursor-pointer px-3 py-1.5"
            >
              <Download :size="12" /> .SRT
            </a>
            <a
              :href="`/api/outputs/${outputId}/export-subtitles?format=vtt`"
              download
              class="btn-secondary flex items-center gap-1.5 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 text-xs cursor-pointer px-3 py-1.5"
            >
              <Download :size="12" /> .VTT
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Star, DollarSign, ImageIcon, Eye, Share2, Subtitles, Download } from 'lucide-vue-next'

defineProps<{
  output: any
  outputId: string
  correctionMode: boolean
  thumbnailHookText: string
  generatingThumbnails: boolean
  removingThumbnail: boolean
  thumbnailVersion: number
  generatingSocialKit: boolean
  activeSocialTab: string
  socialKitTabs: Array<{ key: string; label: string }>
  activeSocialContent: any
  seoTagsNormalized: string[]
  seoTagsForYoutubeCopy: string
  formatCost: (v: number) => string
  getExtraCost: (type: 'thumbnail' | 'social_kit') => number
}>()

defineEmits<{
  'update:thumbnailHookText': [value: string]
  'update:activeSocialTab': [value: string]
  generateThumbnails: []
  openThumbnailPreview: [idx: number]
  showThumbnailLightbox: []
  removeThumbnail: []
  generateSocialKit: []
  copySocialField: [text: string]
}>()
</script>
