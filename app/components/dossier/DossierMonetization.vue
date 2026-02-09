<template>
  <div class="space-y-8">

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- FASE 1: Configuração + Trigger                        -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- Loading Existing Plan -->
    <section v-if="loadingExisting" class="glass-card p-1">
      <div class="p-12 flex flex-col items-center justify-center space-y-4">
        <div class="relative w-12 h-12">
          <div class="absolute inset-0 border-3 border-emerald-500/20 rounded-full"></div>
          <div class="absolute inset-0 border-3 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
        <p class="text-xs text-zinc-500 font-mono uppercase tracking-widest">Verificando planos salvos...</p>
      </div>
    </section>

    <section v-if="!plan && !generating && !loadingExisting" class="glass-card p-1 overflow-hidden">
      <div class="p-8 pb-6 flex justify-between items-center border-b border-white/5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <TrendingUp :size="22" />
          </div>
          <div>
            <h3 class="text-sm font-black uppercase tracking-widest text-white">Plano de Monetização</h3>
            <p class="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">Document-First Strategy</p>
          </div>
        </div>
      </div>

      <div class="p-8 space-y-8">
        <!-- Descrição do que vai acontecer -->
        <div class="flex items-start gap-4 p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
          <Sparkles :size="20" class="text-emerald-400 mt-0.5 flex-shrink-0" />
          <div class="space-y-1">
            <p class="text-sm text-white font-semibold">Análise de monetização inteligente</p>
            <p class="text-xs text-zinc-400 leading-relaxed">
              A IA analisará o dossiê e sugerirá um pacote completo:
              <strong class="text-white">1 vídeo completo</strong> (YouTube) +
              <strong class="text-white">4-6 teasers</strong> (TikTok/Shorts/Reels),
              cada um com ângulo narrativo diferente para maximizar alcance e conversão.
            </p>
          </div>
        </div>

        <!-- Seleção de durações -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Duração dos Teasers -->
          <div class="space-y-4">
            <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
              <Clock :size="12" />
              Duração dos Teasers
            </label>
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="opt in teaserOptions"
                :key="opt.value"
                @click="selectedTeaserDuration = opt.value"
                :class="[
                  'relative px-4 py-4 rounded-xl border text-center transition-all duration-300 cursor-pointer group/opt',
                  selectedTeaserDuration === opt.value
                    ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                ]"
              >
                <div class="text-lg font-black text-white tracking-tight">{{ opt.label }}</div>
                <div class="text-[9px] text-zinc-500 font-mono uppercase tracking-wider mt-1">{{ opt.description }}</div>
                <div v-if="selectedTeaserDuration === opt.value" class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check :size="10" class="text-white" />
                </div>
              </button>
            </div>
          </div>

          <!-- Duração do Full Video -->
          <div class="space-y-4">
            <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
              <Film :size="12" />
              Duração do Full Video
            </label>
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="opt in fullVideoOptions"
                :key="opt.value"
                @click="selectedFullDuration = opt.value"
                :class="[
                  'relative px-4 py-4 rounded-xl border text-center transition-all duration-300 cursor-pointer group/opt',
                  selectedFullDuration === opt.value
                    ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                ]"
              >
                <div class="text-lg font-black text-white tracking-tight">{{ opt.label }}</div>
                <div class="text-[9px] text-zinc-500 font-mono uppercase tracking-wider mt-1">{{ opt.description }}</div>
                <div v-if="selectedFullDuration === opt.value" class="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check :size="10" class="text-white" />
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Botão Gerar -->
        <button
          @click="generatePlan"
          class="w-full px-8 py-5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.35)] flex items-center justify-center gap-3 group"
        >
          <Sparkles :size="18" class="group-hover:rotate-12 transition-transform duration-500" />
          GERAR PLANO DE MONETIZAÇÃO
          <ArrowRight :size="18" class="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- FASE 2: Loading                                        -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <section v-if="generating" class="glass-card p-1">
      <div class="p-16 flex flex-col items-center justify-center space-y-8">
        <div class="relative w-20 h-20">
          <div class="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
          <div class="absolute inset-0 border-4 border-t-emerald-500 rounded-full animate-spin"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <TrendingUp :size="24" class="text-emerald-400 animate-pulse" />
          </div>
        </div>
        <div class="text-center space-y-3">
          <p class="text-lg font-black text-white uppercase tracking-wider animate-pulse">
            Analisando Dossiê...
          </p>
          <p class="text-xs text-zinc-500 font-mono uppercase tracking-widest">
            Identificando ângulos narrativos · Calculando ROI
          </p>
          <div class="flex items-center justify-center gap-2 pt-4">
            <div class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- FASE 3: Resultado — Plano Gerado                      -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <template v-if="plan">

      <!-- Header do resultado -->
      <section class="glass-card p-1 overflow-hidden">
        <div class="p-8 bg-gradient-to-r from-emerald-500/5 via-transparent to-blue-500/5">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <TrendingUp :size="24" />
              </div>
              <div>
                <h3 class="text-lg font-black uppercase tracking-widest text-white">Plano Gerado</h3>
                <p class="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">
                  1 Full Video + {{ plan.teasers.length }} Teasers · Receita estimada: {{ plan.estimatedTotalRevenue }}
                  <span v-if="planCreatedAt" class="ml-2 text-zinc-600">· {{ formatPlanDate(planCreatedAt) }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="planSavedInDb" class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[8px] font-black text-emerald-400 uppercase tracking-wider">
                💾 Salvo
              </span>
              <span v-if="planCost > 0" class="mono-label !text-[9px] text-emerald-400">
                Custo: {{ formatCost(planCost) }}
              </span>
              <span v-if="usage" class="mono-label !text-[9px] text-zinc-600">
                {{ usage.totalTokens?.toLocaleString() }} tokens · {{ provider }}
              </span>
              <button
                @click="resetPlan"
                class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
              >
                <RefreshCw :size="12" />
                Regenerar
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════ FULL VIDEO ════════════ -->
      <section class="glass-card p-1 overflow-hidden border-blue-500/10">
        <div class="p-6 pb-4 flex items-center gap-3 border-b border-white/5">
          <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Film :size="18" />
          </div>
          <h4 class="text-xs font-black uppercase tracking-widest text-white">Full Video · YouTube</h4>
          <span class="mono-label !text-[9px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
            {{ selectedFullDuration / 60 }}min
          </span>
        </div>

        <div class="p-6 space-y-5">
          <div>
            <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">Título</label>
            <p class="text-lg font-bold text-white leading-tight">{{ plan.fullVideo.title }}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">Hook de Abertura</label>
              <p class="text-sm text-emerald-300 italic leading-relaxed">"{{ plan.fullVideo.hook }}"</p>
            </div>
            <div>
              <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">Ângulo Narrativo</label>
              <p class="text-sm text-zinc-300">{{ plan.fullVideo.angle }}</p>
            </div>
          </div>

          <div>
            <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">Arco Emocional</label>
            <p class="text-sm text-zinc-400">{{ plan.fullVideo.emotionalArc }}</p>
          </div>

          <div>
            <label class="mono-label !text-[9px] text-zinc-600 mb-2 block">Pontos-Chave</label>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(point, i) in plan.fullVideo.keyPoints"
                :key="i"
                class="px-3 py-1.5 bg-blue-500/10 border border-blue-500/15 text-blue-300 text-[10px] font-medium rounded-lg"
              >
                {{ point }}
              </span>
            </div>
          </div>

          <div>
            <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">Estrutura Narrativa</label>
            <p class="text-xs text-zinc-500 leading-relaxed">{{ plan.fullVideo.structure }}</p>
          </div>

          <div class="pt-3 border-t border-white/5 flex items-center justify-between">
            <span class="mono-label !text-[9px] text-zinc-600">Views estimadas</span>
            <span class="text-sm font-bold text-blue-400">{{ plan.fullVideo.estimatedViews?.toLocaleString() }}</span>
          </div>
        </div>
      </section>

      <!-- ════════════ TEASERS ════════════ -->
      <div class="space-y-4">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Scissors :size="18" />
          </div>
          <h4 class="text-xs font-black uppercase tracking-widest text-white">
            Teasers · {{ plan.teasers.length }} ângulos
          </h4>
          <span class="mono-label !text-[9px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
            {{ selectedTeaserDuration }}s cada
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <div
            v-for="(teaser, index) in plan.teasers"
            :key="index"
            class="glass-card p-1 overflow-hidden group hover:border-purple-500/30 transition-all duration-500"
          >
            <!-- Teaser Header -->
            <div class="px-5 py-4 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300 text-[10px] font-black">
                  {{ Number(index) + 1 }}
                </span>
                <span class="mono-label !text-[9px] text-zinc-500 uppercase">{{ teaser.platform }}</span>
              </div>
              <span :class="[
                'px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider',
                angleCategoryColor(teaser.angleCategory)
              ]">
                {{ teaser.angleCategory }}
              </span>
            </div>

            <!-- Teaser Body -->
            <div class="p-5 space-y-4">
              <div>
                <p class="text-sm font-bold text-white leading-snug mb-2">{{ teaser.title }}</p>
                <p class="text-xs text-emerald-300 italic leading-relaxed">"{{ teaser.hook }}"</p>
              </div>

              <div>
                <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">Ângulo</label>
                <p class="text-xs text-zinc-400">{{ teaser.angle }}</p>
              </div>

              <div>
                <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">Estrutura</label>
                <p class="text-[10px] text-zinc-500 leading-relaxed">{{ teaser.scriptOutline }}</p>
              </div>

              <div>
                <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">Visual Sugerido</label>
                <p class="text-[10px] text-zinc-500 leading-relaxed">{{ teaser.visualSuggestion }}</p>
              </div>

              <div>
                <label class="mono-label !text-[9px] text-zinc-600 mb-1 block">CTA</label>
                <p class="text-[10px] text-purple-300 italic">{{ teaser.cta }}</p>
              </div>

              <div class="pt-3 border-t border-white/5 flex items-center justify-between">
                <span class="mono-label !text-[9px] text-zinc-600">Views est.</span>
                <span class="text-xs font-bold text-purple-400">{{ teaser.estimatedViews?.toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ════════════ CRONOGRAMA DE PUBLICAÇÃO ════════════ -->
      <section class="glass-card p-1 overflow-hidden">
        <div class="p-6 pb-4 flex items-center gap-3 border-b border-white/5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Calendar :size="18" />
          </div>
          <h4 class="text-xs font-black uppercase tracking-widest text-white">Cronograma de Publicação</h4>
        </div>

        <div class="p-6">
          <div class="space-y-3">
            <div
              v-for="(entry, index) in plan.publicationSchedule"
              :key="index"
              class="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <span class="w-20 text-[10px] font-black text-amber-400 uppercase tracking-wider flex-shrink-0">
                {{ entry.dayOfWeek }}
              </span>
              <div class="w-px h-8 bg-white/10"></div>
              <div class="flex-1">
                <p class="text-xs text-white font-medium">{{ entry.content }}</p>
                <p v-if="entry.notes" class="text-[10px] text-zinc-500 mt-0.5">{{ entry.notes }}</p>
              </div>
              <span class="mono-label !text-[9px] text-zinc-500">{{ entry.platform }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════ NOTAS ESTRATÉGICAS ════════════ -->
      <section v-if="plan.strategicNotes" class="glass-card p-1 overflow-hidden">
        <div class="p-6 pb-4 flex items-center gap-3 border-b border-white/5">
          <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Lightbulb :size="18" />
          </div>
          <h4 class="text-xs font-black uppercase tracking-widest text-white">Notas Estratégicas</h4>
        </div>
        <div class="p-6">
          <p class="text-sm text-zinc-400 leading-relaxed">{{ plan.strategicNotes }}</p>
        </div>
      </section>
    </template>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- ERROR STATE                                            -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <section v-if="errorMessage" class="glass-card p-1 overflow-hidden border-red-500/20">
      <div class="p-8 flex items-start gap-4">
        <div class="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
          <AlertTriangle :size="20" />
        </div>
        <div class="space-y-2">
          <h4 class="text-sm font-black text-red-400 uppercase tracking-wider">Erro na Geração</h4>
          <p class="text-xs text-zinc-400">{{ errorMessage }}</p>
          <button
            @click="errorMessage = ''; generating = false"
            class="text-[10px] font-black text-primary uppercase tracking-widest hover:underline mt-2"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import {
  TrendingUp, Sparkles, Clock, Film, Check, ArrowRight,
  RefreshCw, Scissors, Calendar, Lightbulb, AlertTriangle
} from 'lucide-vue-next'

const props = defineProps<{
  dossierId: string
}>()

// ───── State ─────
const selectedTeaserDuration = ref<60 | 120 | 180>(60)
const selectedFullDuration = ref<300 | 600 | 900>(600)
const generating = ref(false)
const loadingExisting = ref(true)
const errorMessage = ref('')
const plan = ref<any>(null)
const usage = ref<any>(null)
const provider = ref('')
const planCreatedAt = ref<string | null>(null)
const planSavedInDb = ref(false)
const planCost = ref(0)

// ───── Options ─────
const teaserOptions = [
  { value: 60 as const, label: '60s', description: 'Curto' },
  { value: 120 as const, label: '120s', description: 'Médio' },
  { value: 180 as const, label: '180s', description: 'Longo' }
]

const fullVideoOptions = [
  { value: 300 as const, label: '5min', description: 'Compacto' },
  { value: 600 as const, label: '10min', description: 'Clássico' },
  { value: 900 as const, label: '15min', description: 'Completo' }
]

// ───── Actions ─────
async function loadExistingPlan() {
  loadingExisting.value = true
  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/monetization-plans`) as any
    if (data?.data?.length > 0) {
      const saved = data.data[0]
      plan.value = saved.planData
      usage.value = { inputTokens: saved.inputTokens, outputTokens: saved.outputTokens, totalTokens: saved.inputTokens + saved.outputTokens }
      provider.value = saved.provider
      selectedTeaserDuration.value = saved.teaserDuration as 60 | 120 | 180
      selectedFullDuration.value = saved.fullVideoDuration as 300 | 600 | 900
      planCreatedAt.value = saved.createdAt
      planSavedInDb.value = true
      planCost.value = saved.cost ?? 0
    }
  } catch (err) {
    // Se falhar ao carregar, só mostra o formulário
    console.warn('[DossierMonetization] Nenhum plano salvo encontrado')
  } finally {
    loadingExisting.value = false
  }
}

async function generatePlan() {
  generating.value = true
  errorMessage.value = ''
  plan.value = null
  planSavedInDb.value = false

  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/suggest-monetization`, {
      method: 'POST',
      body: {
        teaserDuration: selectedTeaserDuration.value,
        fullVideoDuration: selectedFullDuration.value
      }
    }) as any

    plan.value = data.plan
    usage.value = data.usage
    provider.value = data.provider
    planCreatedAt.value = data.createdAt
    planSavedInDb.value = true
    planCost.value = data.cost ?? 0
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Erro desconhecido ao gerar plano'
  } finally {
    generating.value = false
  }
}

function resetPlan() {
  plan.value = null
  usage.value = null
  provider.value = ''
  errorMessage.value = ''
  planCreatedAt.value = null
  planSavedInDb.value = false
  planCost.value = 0
}

// ───── Utils ─────
function angleCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    cronológico: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    econômico: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    religioso: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    político: 'bg-red-500/10 text-red-400 border border-red-500/20',
    humano: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
    conspirativo: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    científico: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    geopolítico: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    cultural: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    paradoxal: 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20'
  }
  return colors[category] || 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
}

function formatPlanDate(dateString: string): string {
  if (!dateString) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString))
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

// ───── Lifecycle ─────
onMounted(() => {
  loadExistingPlan()
})
</script>
