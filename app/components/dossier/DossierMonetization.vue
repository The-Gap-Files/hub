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
            <p class="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-0.5">Document-First Strategy</p>
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
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
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
                <div class="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">{{ opt.description }}</div>
                <div v-if="selectedTeaserDuration === opt.value" class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check :size="10" class="text-white" />
                </div>
              </button>
            </div>
          </div>

          <!-- Duração do Full Video -->
          <div class="space-y-4">
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
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
                <div class="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">{{ opt.description }}</div>
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
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    1 Full Video + {{ plan.teasers.length }} Teasers · Receita estimada: {{ plan.estimatedTotalRevenue }}
                    <span v-if="planCreatedAt" class="ml-2 text-zinc-600">· {{ formatPlanDate(planCreatedAt) }}</span>
                  </span>
                  <span v-if="plan.visualStyleId" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/15 text-[10px] font-bold text-pink-300" title="Estilo Visual do Plano">
                    <Palette :size="10" class="text-pink-400" />
                    {{ plan.visualStyleName || plan.visualStyleId }}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="planSavedInDb" class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs font-black text-emerald-400 uppercase tracking-wider">
                💾 Salvo
              </span>
              <span v-if="planCost > 0" class="mono-label text-xs text-emerald-400">
                Custo: {{ formatCost(planCost) }}
              </span>
              <span v-if="usage" class="mono-label text-xs text-zinc-600">
                {{ usage.totalTokens?.toLocaleString() }} tokens · {{ provider }}
              </span>
              <button
                @click="resetPlan"
                class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
              >
                <RefreshCw :size="12" />
                Regenerar
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════ FULL VIDEO ════════════ -->
      <section class="glass-card p-1 overflow-hidden border-blue-500/10" :class="{ 'opacity-60 pointer-events-none': regeneratingFullVideo }">
        <div class="p-6 pb-4 flex items-center justify-between border-b border-white/5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Film :size="18" />
            </div>
            <h4 class="text-xs font-black uppercase tracking-widest text-white">Full Video · YouTube</h4>
            <span class="mono-label text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
              {{ selectedFullDuration / 60 }}min
            </span>
          </div>
          <button
            @click="showFullVideoRegenForm = !showFullVideoRegenForm"
            :disabled="regeneratingFullVideo"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/8 border border-blue-500/15 text-blue-400 hover:bg-blue-500/15 hover:border-blue-500/30 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-wait"
            title="Gerar alternativa diferente"
          >
            <Loader2 v-if="regeneratingFullVideo" :size="13" class="animate-spin" />
            <RotateCcw v-else :size="13" />
            <span class="hidden sm:inline">{{ regeneratingFullVideo ? 'Gerando...' : 'Outro ângulo' }}</span>
          </button>
        </div>

        <!-- Formulário de regeneração -->
        <Transition name="slide-down">
          <div v-if="showFullVideoRegenForm && !regeneratingFullVideo" class="px-6 py-5 border-b border-white/5 bg-blue-500/[0.03] space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div class="flex items-center justify-between">
              <p class="text-xs font-bold text-blue-400 uppercase tracking-wider">Configurar novo ângulo</p>
              <button @click="showFullVideoRegenForm = false" class="text-zinc-600 hover:text-white transition-colors">
                <X :size="14" />
              </button>
            </div>

            <!-- Seletor de duração -->
            <div class="space-y-2">
              <label class="text-xs text-zinc-500 font-medium">Duração do novo vídeo</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="opt in fullVideoOptions"
                  :key="opt.value"
                  @click="regenFullVideoDuration = opt.value"
                  :class="[
                    'px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer',
                    regenFullVideoDuration === opt.value
                      ? 'border-blue-500/50 bg-blue-500/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20'
                  ]"
                >
                  <div class="text-sm font-black">{{ opt.label }}</div>
                  <div class="text-xs text-zinc-500 mt-0.5">{{ opt.description }}</div>
                </button>
              </div>
            </div>

            <!-- Campo de sugestão -->
            <div class="space-y-2">
              <label class="text-xs text-zinc-500 font-medium">
                Sugestão para a IA
                <span class="text-zinc-600 font-normal ml-1">(opcional — a IA decide se segue ou não)</span>
              </label>
              <textarea
                v-model="regenFullVideoSuggestion"
                rows="2"
                placeholder="Ex: Focar mais no aspecto conspirativo, usar tom mais sombrio, explorar a timeline de eventos..."
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-blue-500/40 outline-none transition-all resize-none"
              ></textarea>
            </div>

            <!-- Botão de confirmar -->
            <button
              @click="confirmRegenerateFullVideo"
              class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 hover:border-blue-500/30 text-blue-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
            >
              <Send :size="14" />
              Gerar novo Full Video
            </button>
          </div>
        </Transition>

        <div class="p-6 space-y-5">
          <div>
            <label class="mono-label text-xs text-zinc-600 mb-1 block">Título</label>
            <p class="text-lg font-bold text-white leading-tight">{{ plan.fullVideo.title }}</p>
          </div>

          <!-- ── Creative Direction Badges ── -->
          <div v-if="plan.fullVideo.scriptStyleId" class="flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/15 text-xs font-medium text-violet-300" title="Estilo de Roteiro">
              <BookOpen :size="12" class="text-violet-400" />
              {{ plan.fullVideo.scriptStyleName || plan.fullVideo.scriptStyleId }}
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15 text-xs font-medium text-amber-300" title="Objetivo Editorial">
              <Target :size="12" class="text-amber-400" />
              {{ plan.fullVideo.editorialObjectiveName || plan.fullVideo.editorialObjectiveId }}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="mono-label text-xs text-zinc-600 mb-1 block">Hook de Abertura</label>
              <p class="text-sm text-emerald-300 italic leading-relaxed">"{{ plan.fullVideo.hook }}"</p>
            </div>
            <div>
              <label class="mono-label text-xs text-zinc-600 mb-1 block">Ângulo Narrativo</label>
              <p class="text-sm text-zinc-300">{{ plan.fullVideo.angle }}</p>
            </div>
          </div>

          <div>
            <label class="mono-label text-xs text-zinc-600 mb-1 block">Arco Emocional</label>
            <p class="text-sm text-zinc-400">{{ plan.fullVideo.emotionalArc }}</p>
          </div>

          <div>
            <label class="mono-label text-xs text-zinc-600 mb-2 block">Pontos-Chave</label>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(point, i) in plan.fullVideo.keyPoints"
                :key="i"
                class="px-3 py-1.5 bg-blue-500/10 border border-blue-500/15 text-blue-300 text-xs font-medium rounded-lg"
              >
                {{ point }}
              </span>
            </div>
          </div>

          <div>
            <label class="mono-label text-xs text-zinc-600 mb-1 block">Estrutura Narrativa</label>
            <p class="text-xs text-zinc-500 leading-relaxed">{{ plan.fullVideo.structure }}</p>
          </div>

          <div class="pt-3 border-t border-white/5 flex items-center justify-between">
            <span class="mono-label text-xs text-zinc-600">Views estimadas</span>
            <span class="text-sm font-bold text-blue-400">{{ plan.fullVideo.estimatedViews?.toLocaleString() }}</span>
          </div>

          <!-- ── Style Preview (Gerar Mundo) ── -->
          <div v-if="plan.fullVideo.visualPrompt" class="pt-4 border-t border-white/5 space-y-4">
            <!-- Preview Image (if already generated) -->
            <div v-if="plan.fullVideo.stylePreview?.base64" class="space-y-3">
              <label class="mono-label text-xs text-zinc-600 mb-1 block">Prévia do Mundo Visual</label>
              <div class="relative rounded-xl overflow-hidden border border-white/10 group/preview">
                <img
                  :src="'data:' + (plan.fullVideo.stylePreview.mimeType || 'image/png') + ';base64,' + plan.fullVideo.stylePreview.base64"
                  alt="Style preview"
                  class="w-full h-auto object-cover"
                />
                <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-mono text-zinc-400">
                      Seed: {{ plan.fullVideo.stylePreview.seedValue }}
                    </span>
                    <!-- Confirmado -->
                    <span v-if="plan.fullVideo.stylePreview.confirmed" class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono rounded-lg">
                      🧬 Registrada
                    </span>
                    <!-- Pendente -->
                    <span v-else class="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono rounded-lg animate-pulse">
                      ⏳ Pendente
                    </span>
                  </div>
                </div>
              </div>

              <!-- Botões de ação para preview pendente -->
              <div v-if="!plan.fullVideo.stylePreview.confirmed" class="flex items-center gap-2">
                <button
                  @click="confirmStylePreview('fullVideo')"
                  :disabled="confirmingPreviewFor !== null"
                  class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                >
                  <Loader2 v-if="confirmingPreviewFor === 'fullVideo'" :size="14" class="animate-spin" />
                  <Check v-else :size="14" />
                  {{ confirmingPreviewFor === 'fullVideo' ? 'Confirmando...' : '✓ Confirmar Mundo' }}
                </button>
                <button
                  @click="generateStylePreview('fullVideo')"
                  :disabled="generatingPreviewFor !== null"
                  class="flex items-center gap-2 px-4 py-2.5 bg-zinc-500/10 hover:bg-zinc-500/20 border border-white/10 hover:border-white/20 text-zinc-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-wait"
                >
                  <Loader2 v-if="generatingPreviewFor === 'fullVideo'" :size="14" class="animate-spin" />
                  <RefreshCw v-else :size="14" />
                  {{ generatingPreviewFor === 'fullVideo' ? 'Gerando...' : 'Regenerar' }}
                </button>
              </div>
            </div>

            <!-- Generate Button (primeira geração ou após confirmação) -->
            <div v-if="!plan.fullVideo.stylePreview?.base64 || plan.fullVideo.stylePreview?.confirmed" class="flex items-center gap-3">
              <!-- Seed Selector -->
              <div class="flex-1 flex items-center gap-2">
                <select
                  v-model="selectedSeedMode"
                  class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-blue-500/40 outline-none flex-1"
                >
                  <option value="random">🎲 Seed Aleatória</option>
                  <option v-for="s in availableSeeds" :key="s.id" :value="s.id">
                    🧬 {{ s.value }}
                  </option>
                </select>
              </div>
              <button
                @click="generateStylePreview('fullVideo')"
                :disabled="generatingPreviewFor !== null"
                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600/80 to-violet-600/80 hover:from-pink-500 hover:to-violet-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] disabled:opacity-50 disabled:cursor-wait"
              >
                <Loader2 v-if="generatingPreviewFor === 'fullVideo'" :size="14" class="animate-spin" />
                <Globe v-else :size="14" />
                {{ generatingPreviewFor === 'fullVideo' ? 'Gerando...' : (plan.fullVideo.stylePreview?.confirmed ? 'Novo Mundo' : 'Gerar Mundo') }}
              </button>
            </div>
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
          <span class="mono-label text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
            {{ selectedTeaserDuration }}s cada
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <div
            v-for="(teaser, index) in plan.teasers"
            :key="index"
            class="glass-card p-1 overflow-hidden group hover:border-purple-500/30 transition-all duration-500"
            :class="{ 'opacity-60 pointer-events-none': regeneratingTeaserIndex === Number(index) }"
          >
            <!-- Teaser Header -->
            <div class="px-5 py-4 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300 text-xs font-black">
                  {{ Number(index) + 1 }}
                </span>
                <span class="mono-label text-xs text-zinc-500 uppercase">{{ teaser.platform }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span :class="[
                  'px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider',
                  angleCategoryColor(teaser.angleCategory)
                ]">
                  {{ teaser.angleCategory }}
                </span>
                <button
                  @click="regenerateTeaser(Number(index))"
                  :disabled="regeneratingTeaserIndex !== null"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Regenerar este teaser com ângulo diferente"
                >
                  <Loader2 v-if="regeneratingTeaserIndex === Number(index)" :size="13" class="animate-spin text-purple-400" />
                  <RotateCcw v-else :size="13" />
                </button>
              </div>
            </div>

            <!-- Teaser Body -->
            <div class="p-5 space-y-4">
              <div>
                <p class="text-sm font-bold text-white leading-snug mb-2">{{ teaser.title }}</p>
                <p class="text-xs text-emerald-300 italic leading-relaxed">"{{ teaser.hook }}"</p>
              </div>

              <div>
                <label class="mono-label text-xs text-zinc-600 mb-1 block">Ângulo</label>
                <p class="text-xs text-zinc-400">{{ teaser.angle }}</p>
              </div>

              <div>
                <label class="mono-label text-xs text-zinc-600 mb-1 block">Estrutura</label>
                <p class="text-xs text-zinc-500 leading-relaxed">{{ teaser.scriptOutline }}</p>
              </div>

              <div>
                <label class="mono-label text-xs text-zinc-600 mb-1 block">Visual Sugerido</label>
                <p class="text-xs text-zinc-500 leading-relaxed">{{ teaser.visualSuggestion }}</p>
              </div>

              <div>
                <label class="mono-label text-xs text-zinc-600 mb-1 block">CTA</label>
                <p class="text-xs text-purple-300 italic">{{ teaser.cta }}</p>
              </div>

              <!-- ── Creative Direction Badges (por teaser) ── -->
              <div v-if="teaser.scriptStyleId" class="flex flex-wrap gap-1.5">
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/8 border border-violet-500/10 text-[10px] font-medium text-violet-300/80" title="Roteiro">
                  <BookOpen :size="10" />
                  {{ teaser.scriptStyleName || teaser.scriptStyleId }}
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/8 border border-amber-500/10 text-[10px] font-medium text-amber-300/80" title="Editorial">
                  <Target :size="10" />
                  {{ teaser.editorialObjectiveName || teaser.editorialObjectiveId }}
                </span>
              </div>

              <div class="pt-3 border-t border-white/5 flex items-center justify-between">
                <span class="mono-label text-xs text-zinc-600">Views est.</span>
                <span class="text-xs font-bold text-purple-400">{{ teaser.estimatedViews?.toLocaleString() }}</span>
              </div>

              <!-- ── Style Preview Mini (Teaser) ── -->
              <div v-if="teaser.visualPrompt" class="pt-3 border-t border-white/5 space-y-3">
                <!-- Preview image -->
                <div v-if="teaser.stylePreview?.base64" class="space-y-2">
                  <div class="relative rounded-lg overflow-hidden border border-white/10">
                    <img
                      :src="'data:' + (teaser.stylePreview.mimeType || 'image/png') + ';base64,' + teaser.stylePreview.base64"
                      alt="Teaser style preview"
                      class="w-full h-auto object-cover"
                    />
                    <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 flex items-center justify-between">
                      <span class="text-[10px] font-mono text-zinc-400">Seed: {{ teaser.stylePreview.seedValue }}</span>
                      <span v-if="teaser.stylePreview.confirmed" class="text-[10px] text-emerald-400 font-mono">🧬 Registrada</span>
                      <span v-else class="text-[10px] text-amber-400 font-mono animate-pulse">⏳ Pendente</span>
                    </div>
                  </div>

                  <!-- Botões para preview pendente (teaser) -->
                  <div v-if="!teaser.stylePreview.confirmed" class="flex items-center gap-1.5">
                    <button
                      @click="confirmStylePreview('teaser', Number(index))"
                      :disabled="confirmingPreviewFor !== null"
                      class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-50"
                    >
                      <Loader2 v-if="confirmingPreviewFor === `teaser-${index}`" :size="10" class="animate-spin" />
                      <Check v-else :size="10" />
                      {{ confirmingPreviewFor === `teaser-${index}` ? '...' : '✓ Confirmar' }}
                    </button>
                    <button
                      @click="generateStylePreview('teaser', Number(index))"
                      :disabled="generatingPreviewFor !== null"
                      class="flex items-center gap-1 px-2 py-1.5 bg-zinc-500/10 hover:bg-zinc-500/20 border border-white/10 text-zinc-400 text-[10px] font-bold uppercase rounded-lg transition-all disabled:opacity-40 disabled:cursor-wait"
                    >
                      <Loader2 v-if="generatingPreviewFor === `teaser-${index}`" :size="10" class="animate-spin" />
                      <RefreshCw v-else :size="10" />
                      {{ generatingPreviewFor === `teaser-${index}` ? '...' : 'Regenerar' }}
                    </button>
                  </div>
                </div>
                <!-- Generate button (primeira geração ou após confirmação) -->
                <button
                  v-if="!teaser.stylePreview?.base64 || teaser.stylePreview?.confirmed"
                  @click="generateStylePreview('teaser', Number(index))"
                  :disabled="generatingPreviewFor !== null"
                  class="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-500/8 hover:bg-violet-500/15 border border-violet-500/15 hover:border-violet-500/30 text-violet-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 disabled:cursor-wait"
                >
                  <Loader2 v-if="generatingPreviewFor === `teaser-${index}`" :size="11" class="animate-spin" />
                  <Globe v-else :size="11" />
                  {{ generatingPreviewFor === `teaser-${index}` ? 'Gerando...' : (teaser.stylePreview?.confirmed ? 'Novo Mundo' : 'Gerar Mundo') }}
                </button>
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
          <span class="mono-label text-xs text-zinc-600">{{ plan.publicationSchedule?.length }} etapas</span>
        </div>

        <div class="p-6">
          <div class="relative">
            <!-- Timeline vertical line -->
            <div class="absolute left-[39px] top-2 bottom-2 w-px bg-gradient-to-b from-amber-500/30 via-amber-500/10 to-transparent"></div>

            <div class="space-y-1">
              <div
                v-for="(entry, index) in plan.publicationSchedule"
                :key="index"
                class="relative flex items-start gap-5 py-3 px-3 rounded-xl hover:bg-white/[0.03] transition-colors group"
              >
                <!-- Day badge + dot -->
                <div class="flex flex-col items-center flex-shrink-0 w-[54px] z-10">
                  <span class="text-xs font-black text-amber-400 uppercase tracking-wider leading-none">
                    {{ entry.dayOfWeek?.slice(0, 3) }}
                  </span>
                  <div class="w-2.5 h-2.5 rounded-full bg-amber-500/40 border-2 border-amber-500 mt-1.5 group-hover:scale-125 transition-transform"></div>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 pt-0.5">
                  <p class="text-sm text-white font-medium leading-snug">{{ entry.content }}</p>
                  <p v-if="entry.notes" class="text-xs text-zinc-500 mt-1 leading-relaxed">{{ entry.notes }}</p>
                </div>

                <!-- Platform badge -->
                <span class="flex-shrink-0 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-xs font-mono text-zinc-400 uppercase tracking-wider mt-0.5">
                  {{ entry.platform }}
                </span>
              </div>
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
            class="text-xs font-black text-primary uppercase tracking-widest hover:underline mt-2"
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
  RefreshCw, Scissors, Calendar, Lightbulb, AlertTriangle,
  Loader2, RotateCcw, X, Send, BookOpen, Palette, Target,
  Globe
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

// ───── Regeneration State ─────
const regeneratingFullVideo = ref(false)
const regeneratingTeaserIndex = ref<number | null>(null)
const showFullVideoRegenForm = ref(false)
const regenFullVideoDuration = ref<300 | 600 | 900>(600)
const regenFullVideoSuggestion = ref('')

// ───── Style Preview State ─────
const generatingPreviewFor = ref<string | null>(null)
const confirmingPreviewFor = ref<string | null>(null)
const selectedSeedMode = ref<string>('random')
const availableSeeds = ref<Array<{ id: string, value: number }>>([])

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

// ───── Regenerate Individual Item ─────
async function regenerateTeaser(index: number) {
  if (regeneratingTeaserIndex.value !== null || !plan.value) return
  regeneratingTeaserIndex.value = index
  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/regenerate-monetization-item`, {
      method: 'POST',
      body: { type: 'teaser', index }
    }) as any
    if (data.success && data.item) {
      plan.value.teasers[index] = data.item
      if (data.cost) planCost.value += data.cost
      // Atualizar cronograma se a IA gerou um novo
      if (data.updatedSchedule?.length) {
        plan.value.publicationSchedule = data.updatedSchedule
      }
    }
  } catch (err: any) {
    console.error('Erro ao regenerar teaser:', err)
    alert(err?.data?.message || 'Erro ao regenerar teaser')
  } finally {
    regeneratingTeaserIndex.value = null
  }
}

function confirmRegenerateFullVideo() {
  showFullVideoRegenForm.value = false
  regenerateFullVideo()
}

async function regenerateFullVideo() {
  if (regeneratingFullVideo.value || !plan.value) return
  regeneratingFullVideo.value = true
  try {
    const body: any = {
      type: 'fullVideo',
      newDuration: regenFullVideoDuration.value
    }
    if (regenFullVideoSuggestion.value.trim()) {
      body.userSuggestion = regenFullVideoSuggestion.value.trim()
    }
    const data = await $fetch(`/api/dossiers/${props.dossierId}/regenerate-monetization-item`, {
      method: 'POST',
      body
    }) as any
    if (data.success && data.item) {
      plan.value.fullVideo = data.item
      if (data.cost) planCost.value += data.cost
      // Atualizar duração selecionada se mudou
      selectedFullDuration.value = regenFullVideoDuration.value
      // Limpar sugestão após sucesso
      regenFullVideoSuggestion.value = ''
      // Atualizar cronograma se a IA gerou um novo
      if (data.updatedSchedule?.length) {
        plan.value.publicationSchedule = data.updatedSchedule
      }
    }
  } catch (err: any) {
    console.error('Erro ao regenerar Full Video:', err)
    alert(err?.data?.message || 'Erro ao regenerar Full Video')
  } finally {
    regeneratingFullVideo.value = false
  }
}

// ───── Style Preview (Gerar Mundo) ─────
async function loadSeeds() {
  try {
    const data = await $fetch('/api/seeds') as any
    availableSeeds.value = (data?.data || []).map((s: any) => ({ id: s.id, value: s.value }))
  } catch (err) {
    console.warn('[DossierMonetization] Erro ao carregar seeds:', err)
  }
}

async function generateStylePreview(itemType: 'fullVideo' | 'teaser', teaserIndex?: number) {
  if (generatingPreviewFor.value !== null || !plan.value) return

  const previewKey = itemType === 'fullVideo' ? 'fullVideo' : `teaser-${teaserIndex}`
  generatingPreviewFor.value = previewKey

  try {
    // Resolver seed
    let seedValue: number
    let seedId: string | undefined

    if (selectedSeedMode.value === 'random') {
      // Gerar seed aleatória no padrão do sistema (0 - 2^31)
      seedValue = Math.floor(Math.random() * 2147483647)
    } else {
      // Seed existente selecionada
      const existingSeed = availableSeeds.value.find(s => s.id === selectedSeedMode.value)
      if (!existingSeed) {
        seedValue = Math.floor(Math.random() * 2147483647)
      } else {
        seedValue = existingSeed.value
        seedId = existingSeed.id
      }
    }

    const body: any = {
      itemType,
      seedValue,
      seedId,
      aspectRatio: '16:9'
    }
    if (itemType === 'teaser') {
      body.teaserIndex = teaserIndex
    }

    const data = await $fetch(`/api/dossiers/${props.dossierId}/generate-style-preview`, {
      method: 'POST',
      body
    }) as any

    if (data.success && data.preview) {
      // Atualizar o preview no plan reactivo (pendente de confirmação)
      const stylePreview = {
        base64: data.preview.base64.replace(/^data:[^;]+;base64,/, ''),
        mimeType: 'image/png',
        seedValue: data.preview.seedValue,
        confirmed: false,
        seedId: null,
        model: data.preview.model,
        generatedAt: new Date().toISOString()
      }

      if (itemType === 'fullVideo') {
        plan.value.fullVideo.stylePreview = stylePreview
      } else if (teaserIndex !== undefined) {
        plan.value.teasers[teaserIndex].stylePreview = stylePreview
      }

      if (data.cost) planCost.value += data.cost
    }
  } catch (err: any) {
    console.error(`[StylePreview] Erro ao gerar preview para ${previewKey}:`, err)
    alert(err?.data?.statusMessage || err?.data?.message || 'Erro ao gerar prévia visual')
  } finally {
    generatingPreviewFor.value = null
  }
}

async function confirmStylePreview(itemType: 'fullVideo' | 'teaser', teaserIndex?: number) {
  const confirmKey = itemType === 'fullVideo' ? 'fullVideo' : `teaser-${teaserIndex}`
  confirmingPreviewFor.value = confirmKey

  try {
    const body: any = { itemType }
    if (itemType === 'teaser') {
      body.teaserIndex = teaserIndex
    }

    const data = await $fetch(`/api/dossiers/${props.dossierId}/confirm-style-preview`, {
      method: 'POST',
      body
    }) as any

    if (data.success) {
      // Marcar como confirmado no state reactivo
      if (itemType === 'fullVideo') {
        plan.value.fullVideo.stylePreview.confirmed = true
        plan.value.fullVideo.stylePreview.seedId = data.seedId
      } else if (teaserIndex !== undefined) {
        plan.value.teasers[teaserIndex].stylePreview.confirmed = true
        plan.value.teasers[teaserIndex].stylePreview.seedId = data.seedId
      }

      // Refresh seeds dropdown (nova seed pode ter sido criada)
      await loadSeeds()
    }
  } catch (err: any) {
    console.error(`[ConfirmPreview] Erro ao confirmar preview para ${confirmKey}:`, err)
    alert(err?.data?.statusMessage || err?.data?.message || 'Erro ao confirmar prévia')
  } finally {
    confirmingPreviewFor.value = null
  }
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

// ───── Watchers ─────
watch(showFullVideoRegenForm, (open) => {
  if (open) {
    // Inicializa com a duração atual ao abrir
    regenFullVideoDuration.value = selectedFullDuration.value
  }
})

// ───── Lifecycle ─────
onMounted(() => {
  loadExistingPlan()
  loadSeeds()
})
</script>
