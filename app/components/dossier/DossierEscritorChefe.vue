<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <BookOpen :size="18" class="text-amber-400" />
          Escritor Chefe
        </h2>
        <p class="text-xs text-zinc-500 mt-1">
          Prosa narrativa densa por episódio. Gere EP1 primeiro, depois EP2 e EP3.
        </p>
      </div>
      <span v-if="updatedAt" class="text-[10px] text-zinc-600">
        Atualizado: {{ new Date(updatedAt).toLocaleString('pt-BR') }}
      </span>
    </div>

    <!-- Loading initial -->
    <div v-if="loadingBundle" class="flex items-center justify-center py-12 text-zinc-500 text-sm">
      <Loader2 :size="16" class="animate-spin mr-2" />
      Carregando...
    </div>

    <!-- Episode Cards -->
    <div v-else class="space-y-4">
      <div
        v-for="ep in episodes"
        :key="ep.number"
        class="rounded-lg border bg-zinc-900/50 overflow-hidden"
        :class="ep.prose ? 'border-zinc-700/60' : 'border-zinc-800/40'"
      >
        <!-- Episode Header -->
        <div class="flex items-center justify-between px-4 py-3 bg-zinc-800/40">
          <div class="flex items-center gap-3">
            <span
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              :class="ep.prose
                ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50'
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700/30'"
            >
              {{ ep.number }}
            </span>
            <div>
              <h3 class="text-sm font-medium text-zinc-200">
                {{ ep.label }}
              </h3>
              <p class="text-[11px] text-zinc-500">
                {{ ep.territory }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <!-- Word count badge -->
            <span v-if="ep.wordCount" class="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
              {{ ep.wordCount.toLocaleString() }} palavras
            </span>

            <!-- Generate/Regenerate button -->
            <button
              @click="generateEpisode(ep.number)"
              :disabled="!ep.canGenerate || generatingEp === ep.number"
              class="px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5"
              :class="generatingEp === ep.number
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : !ep.canGenerate
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : ep.prose
                    ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'"
            >
              <Loader2 v-if="generatingEp === ep.number" :size="12" class="animate-spin" />
              <RotateCw v-else-if="ep.prose" :size="12" />
              <Sparkles v-else :size="12" />
              <span>{{ generatingEp === ep.number ? 'Gerando...' : ep.prose ? 'Regenerar' : 'Gerar' }}</span>
            </button>

            <!-- Expand/collapse -->
            <button
              v-if="ep.prose"
              @click="toggleExpand(ep.number)"
              class="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ChevronDown
                :size="14"
                class="transition-transform"
                :class="expandedEps.has(ep.number) ? 'rotate-180' : ''"
              />
            </button>
          </div>
        </div>

        <!-- Error -->
        <div v-if="episodeErrors[ep.number]" class="px-4 py-2 bg-red-900/20 border-t border-red-800/30">
          <p class="text-xs text-red-400">{{ episodeErrors[ep.number] }}</p>
        </div>

        <!-- Prose Content (expandable) -->
        <div
          v-if="ep.prose && expandedEps.has(ep.number)"
          class="border-t border-zinc-800/50"
        >
          <div class="px-4 py-3 max-h-[600px] overflow-y-auto">
            <div class="prose-content text-sm text-zinc-300 leading-relaxed" v-html="renderMarkdown(ep.prose)" />
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!ep.prose && !generatingEp" class="px-4 py-4">
          <p class="text-xs text-zinc-600 italic">
            {{ !ep.canGenerate ? `Gere o EP${ep.number - 1} primeiro.` : 'Prosa ainda n\u00e3o gerada.' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BookOpen, Loader2, RotateCw, Sparkles, ChevronDown } from 'lucide-vue-next'

const props = defineProps<{
  dossierId: string
}>()

interface EpisodeBundle {
  episodeNumber: number
  prose: string
  proseWordCount?: number
  narrativeFunction?: string
  emotionalArc?: string
  resolutionLevel?: string
}

const loadingBundle = ref(true)
const updatedAt = ref<string | null>(null)
const generatingEp = ref<number | null>(null)
const expandedEps = ref(new Set<number>())
const episodeErrors = ref<Record<number, string>>({})

// Episode prose data
const ep1Prose = ref('')
const ep1WordCount = ref(0)
const ep2Prose = ref('')
const ep2WordCount = ref(0)
const ep3Prose = ref('')
const ep3WordCount = ref(0)

const episodes = computed(() => [
  {
    number: 1 as const,
    label: 'Epis\u00f3dio 1',
    territory: 'Origem + Ascens\u00e3o \u2022 Resolu\u00e7\u00e3o: Nenhuma',
    prose: ep1Prose.value,
    wordCount: ep1WordCount.value,
    canGenerate: true,
  },
  {
    number: 2 as const,
    label: 'Epis\u00f3dio 2',
    territory: 'Grande Virada \u2022 Resolu\u00e7\u00e3o: Parcial',
    prose: ep2Prose.value,
    wordCount: ep2WordCount.value,
    canGenerate: !!ep1Prose.value,
  },
  {
    number: 3 as const,
    label: 'Epis\u00f3dio 3',
    territory: 'Desfecho + Legado \u2022 Resolu\u00e7\u00e3o: Total',
    prose: ep3Prose.value,
    wordCount: ep3WordCount.value,
    canGenerate: !!ep1Prose.value && !!ep2Prose.value,
  },
])

function toggleExpand(epNumber: number) {
  if (expandedEps.value.has(epNumber)) {
    expandedEps.value.delete(epNumber)
  } else {
    expandedEps.value.add(epNumber)
  }
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-zinc-200 mt-4 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-bold text-amber-400/90 mt-5 mb-2 border-b border-zinc-800 pb-1">$1</h3>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/^(?!<[hp])(.+)$/gm, '<p class="mb-2">$1</p>')
}

function applyBundle(bundle: any) {
  if (!bundle?.episodes) return

  const eps = bundle.episodes
  if (eps.ep1?.prose) {
    ep1Prose.value = eps.ep1.prose
    ep1WordCount.value = eps.ep1.proseWordCount || eps.ep1.prose.split(/\s+/).length
  }
  if (eps.ep2?.prose) {
    ep2Prose.value = eps.ep2.prose
    ep2WordCount.value = eps.ep2.proseWordCount || eps.ep2.prose.split(/\s+/).length
  }
  if (eps.ep3?.prose) {
    ep3Prose.value = eps.ep3.prose
    ep3WordCount.value = eps.ep3.proseWordCount || eps.ep3.prose.split(/\s+/).length
  }
}

async function loadBundle() {
  loadingBundle.value = true
  try {
    const res = await $fetch(`/api/dossiers/${props.dossierId}/escritor-chefe-bundle`) as any
    if (res.bundle) {
      applyBundle(res.bundle)
      updatedAt.value = res.updatedAt
    }
  } catch (e: any) {
    console.error('[EscritorChefe] Load error:', e)
  } finally {
    loadingBundle.value = false
  }
}

async function generateEpisode(epNumber: number) {
  generatingEp.value = epNumber
  episodeErrors.value[epNumber] = ''

  try {
    const res = await $fetch(`/api/dossiers/${props.dossierId}/generate-escritor-chefe-episode`, {
      method: 'POST',
      body: { episodeNumber: epNumber, force: true },
    }) as any

    // Apply full bundle (may update word counts)
    if (res.bundle) {
      applyBundle(res.bundle)
    }

    // Auto-expand generated episode
    expandedEps.value.add(epNumber)
    updatedAt.value = new Date().toISOString()
  } catch (e: any) {
    episodeErrors.value[epNumber] = e?.data?.message || e?.message || 'Erro ao gerar epis\u00f3dio.'
  } finally {
    generatingEp.value = null
  }
}

onMounted(() => {
  loadBundle()
})
</script>

<style scoped>
.prose-content :deep(h3) {
  font-size: 0.875rem;
  font-weight: 700;
  color: rgb(251 191 36 / 0.9);
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.5);
  padding-bottom: 0.25rem;
}

.prose-content :deep(h4) {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(228 228 231);
  margin-top: 1rem;
  margin-bottom: 0.25rem;
}

.prose-content :deep(p) {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}
</style>
