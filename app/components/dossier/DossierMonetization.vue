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
              <strong class="text-white">N shorts</strong> (YouTube Shorts),
              cada um com ângulo narrativo e papel narrativo diferentes para maximizar alcance e conversão.
            </p>
          </div>
        </div>

        <!-- Configuração fixa por cenas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="space-y-4">
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
              <Scissors :size="12" />
              Cenas por Teaser (fixo)
            </label>
            <div class="grid grid-cols-3 gap-3">
              <div class="px-4 py-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center">
                <div class="text-lg font-black text-amber-300 tracking-tight">{{ SCENE_CONFIG.hookOnly }}</div>
                <div class="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">Hook-only</div>
              </div>
              <div class="px-4 py-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-center">
                <div class="text-lg font-black text-blue-300 tracking-tight">{{ SCENE_CONFIG.deepDive }}</div>
                <div class="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">Deep-dive</div>
              </div>
              <div class="px-4 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
                <div class="text-lg font-black text-emerald-300 tracking-tight">{{ SCENE_CONFIG.gateway }}</div>
                <div class="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">Gateway</div>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
              <Film :size="12" />
              Vídeo Longo (fixo)
            </label>
            <div class="px-4 py-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
              <div class="text-lg font-black text-blue-300 tracking-tight">{{ SCENE_CONFIG.fullVideo }} cenas</div>
              <div class="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">Estrutura longa padrão</div>
            </div>
            <p class="text-[11px] text-zinc-500">Tempo não é mais configurável na monetização. A análise agora é guiada por cenas fixas.</p>
          </div>
        </div>

        <!-- Quantidade de Teasers -->
        <div class="space-y-4">
          <label class="mono-label text-xs text-zinc-500 flex items-center gap-2">
            <Scissors :size="12" />
            Quantidade de Teasers
          </label>
          <div class="flex items-center gap-4">
            <input
              type="range"
              :min="4"
              :max="15"
              v-model.number="selectedTeaserCount"
              class="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500
                     [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(168,85,247,0.4)] [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-purple-300"
            />
            <div class="w-14 h-12 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-center justify-center">
              <span class="text-lg font-black text-purple-300">{{ selectedTeaserCount }}</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-zinc-600 font-mono uppercase tracking-wider px-1">
            <span>4 min</span>
            <span class="text-purple-400/60">{{ roleDistributionLabel }}</span>
            <span>15 max</span>
          </div>
        </div>

        <!-- Botão Gerar -->
        <button
          type="button"
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
                <h3 class="text-lg font-black uppercase tracking-widest text-white">{{ plan.planTitle || 'Plano Gerado' }}</h3>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
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
                v-if="planSavedInDb"
                type="button"
                @click="createYoutubePackage"
                :disabled="creatingPackage || hasExistingPackage || !canCreateYoutubePackage"
                class="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                :title="hasExistingPackage ? 'Pacote já foi criado para este plano.' : (canCreateYoutubePackage ? 'Cria 1 Full (150 cenas) + 12 Shorts no banco (sem rodar Arquiteto).' : 'Requer um plano salvo com 12 Shorts.')"
              >
                <Loader2 v-if="creatingPackage" :size="12" class="animate-spin" />
                <Send v-else :size="12" />
                {{ creatingPackage ? 'Criando...' : (hasExistingPackage ? 'Pacote Criado' : 'Criar Pacote') }}
              </button>
              <button
                type="button"
                @click="openRegenerationWarning"
                :disabled="generating"
                class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
              >
                <RefreshCw :size="12" />
                Regenerar
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Validação do plano (violations/warnings) -->
      <section v-if="validation && (validation.violations?.length || validation.warnings?.length)" class="glass-card p-1 overflow-hidden">
        <div class="p-6 space-y-4" :class="validation.approved === false ? 'bg-red-500/5 border-l-4 border-red-500/50' : 'bg-amber-500/5 border-l-4 border-amber-500/50'">
          <div class="flex items-start gap-3">
            <AlertTriangle v-if="validation.approved === false" :size="20" class="text-red-400 flex-shrink-0 mt-0.5" />
            <AlertTriangle v-else :size="20" class="text-amber-400 flex-shrink-0 mt-0.5" />
            <div class="space-y-2 flex-1 min-w-0">
              <h4 class="text-xs font-black uppercase tracking-widest" :class="validation.approved === false ? 'text-red-300' : 'text-amber-300'">
                {{ validation.approved === false ? 'Plano com violações' : 'Avisos do validador' }}
              </h4>
              <ul v-if="validation.violations?.length" class="list-disc pl-5 space-y-1 text-xs text-red-300">
                <li v-for="(v, i) in validation.violations" :key="i">{{ v }}</li>
              </ul>
              <ul v-if="validation.warnings?.length" class="list-disc pl-5 space-y-1 text-xs text-amber-300">
                <li v-for="(w, i) in validation.warnings" :key="i">{{ w }}</li>
              </ul>
              <p v-if="validation.corrections" class="text-xs text-zinc-400 mt-2 italic">{{ validation.corrections }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ════════════ MSGBOX (MODAL) — REGENERAÇÃO ════════════ -->
      <div
        v-if="showMonetizationRegenerationWarning"
        class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        @click.self="showMonetizationRegenerationWarning = false"
      >
        <div class="w-full max-w-lg glass-card p-1 overflow-hidden border-amber-500/30">
          <div class="p-6 space-y-4">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                <AlertTriangle :size="18" />
              </div>
              <div class="space-y-1.5">
                <h4 class="text-sm font-black uppercase tracking-widest text-amber-200">Atenção: Regenerar Monetização</h4>
                <p class="text-xs text-zinc-300 leading-relaxed">
                  Se você confirmar:
                </p>
                <ul class="text-xs text-zinc-300 leading-relaxed list-disc pl-5 space-y-1">
                  <li>Todos os outputs já criados serão <strong>desvinculados</strong> do monetizador.</li>
                  <li>Outputs concluídos permanecerão concluídos, porém <strong>sem relação</strong> com o plano.</li>
                  <li>Outputs pendentes/em geração serão <strong>cancelados</strong>.</li>
                  <li>O <strong>brief</strong> será refeito e sobrescrito.</li>
                </ul>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                @click="showMonetizationRegenerationWarning = false"
                class="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                @click="confirmRegenerateMonetization"
                :disabled="generating"
                class="px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 text-amber-200 hover:text-white text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Loader2 v-if="generating" :size="12" class="animate-spin" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ════════════ PACOTE YOUTUBE (DB) ════════════ -->
      <section v-if="planSavedInDb && (packageError || packageResult)" class="glass-card p-1 overflow-hidden border-emerald-500/10">
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Send :size="16" />
              </div>
              <h4 class="text-xs font-black uppercase tracking-widest text-white">Pacote YouTube (apenas criação)</h4>
            </div>
            <span class="mono-label text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              1 Full + 12 Shorts
            </span>
          </div>

          <div v-if="packageError" class="p-4 bg-red-500/5 border border-red-500/15 rounded-xl text-xs text-red-300 whitespace-pre-line">
            {{ packageError }}
          </div>

          <div v-if="packageResult" class="space-y-3">
            <div class="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-xs text-zinc-300">
              Pacote criado com sucesso. Agora cada item (Full e cada Teaser) terá seu botão <strong>Abrir</strong> no próprio card abaixo.
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
              {{ SCENE_CONFIG.fullVideo }} cenas
            </span>
          </div>
          <div class="flex items-center gap-2">
            <NuxtLink
              v-if="packageResult?.fullOutputId"
              :to="`/outputs/${packageResult.fullOutputId}`"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-300 hover:text-white transition-all text-xs font-black uppercase tracking-wider"
              title="Abrir este Full Video na tela de execução"
            >
              <Film :size="13" />
              <span class="hidden sm:inline">Abrir</span>
            </NuxtLink>
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

            <div class="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-blue-200/80">
              Full Video fixo em <strong>{{ SCENE_CONFIG.fullVideo }} cenas</strong>.
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
              <div v-if="!plan.fullVideo.stylePreview.confirmed" class="space-y-2">
                <!-- Seed Selector inline -->
                <div class="flex items-center gap-2">
                  <select
                    v-model="selectedSeedMode"
                    class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:border-blue-500/40 outline-none flex-1"
                  >
                    <option value="random">🎲 Seed Aleatória</option>
                    <option :value="'current-' + plan.fullVideo.stylePreview.seedValue">
                      🔒 Manter Seed {{ plan.fullVideo.stylePreview.seedValue }}
                    </option>
                    <option v-for="s in availableSeeds" :key="s.id" :value="s.id">
                      🧬 {{ s.value }}
                    </option>
                  </select>
                </div>
                <div class="flex items-center gap-2">
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
            {{ SCENE_CONFIG.gateway }}/{{ SCENE_CONFIG.deepDive }}/{{ SCENE_CONFIG.hookOnly }} cenas por papel
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
                <NuxtLink
                  v-if="packageResult?.teaserOutputIds?.[Number(index)]"
                  :to="`/outputs/${packageResult.teaserOutputIds[Number(index)]}`"
                  class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                  title="Abrir este teaser na tela de execução"
                >
                  Abrir
                </NuxtLink>
                <span :class="[
                  'px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider',
                  angleCategoryColor(teaser.angleCategory)
                ]">
                  {{ teaser.angleCategory }}
                </span>
                <span v-if="teaser.narrativeRole" :class="[
                  'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
                  narrativeRoleColor(teaser.narrativeRole)
                ]" :title="narrativeRoleTooltip(teaser.narrativeRole)">
                  {{ narrativeRoleIcon(teaser.narrativeRole) }} {{ teaser.narrativeRole }}
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

              <!-- ── Anti-padrões (O que NÃO fazer) ── -->
              <div v-if="teaser.avoidPatterns && teaser.avoidPatterns.length > 0">
                <label class="mono-label text-xs text-red-500/80 mb-1.5 block flex items-center gap-1">
                  <ShieldAlert :size="11" />
                  O que NÃO fazer
                </label>
                <ul class="space-y-1">
                  <li
                    v-for="(pattern, pi) in teaser.avoidPatterns"
                    :key="pi"
                    class="text-[11px] text-red-400/70 leading-relaxed pl-3 relative before:content-['⛔'] before:absolute before:left-0 before:text-[9px]"
                  >
                    {{ pattern }}
                  </li>
                </ul>
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
                  <div v-if="!teaser.stylePreview.confirmed" class="space-y-1.5">
                    <!-- Seed Selector mini -->
                    <select
                      v-model="selectedSeedMode"
                      class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-zinc-300 focus:border-violet-500/40 outline-none"
                    >
                      <option value="random">🎲 Seed Aleatória</option>
                      <option :value="'current-' + teaser.stylePreview.seedValue">
                        🔒 Manter {{ teaser.stylePreview.seedValue }}
                      </option>
                      <option v-for="s in availableSeeds" :key="s.id" :value="s.id">
                        🧬 {{ s.value }}
                      </option>
                    </select>
                    <div class="flex items-center gap-1.5">
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
          <p class="text-xs text-zinc-400 whitespace-pre-line">{{ errorMessage }}</p>
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
  TrendingUp, Sparkles, Film, Check, ArrowRight,
  RefreshCw, Scissors, Calendar, Lightbulb, AlertTriangle,
  Loader2, RotateCcw, X, Send, BookOpen, Palette, Target,
  Globe
} from 'lucide-vue-next'

const props = defineProps<{
  dossierId: string
}>()

// ───── State ─────
const selectedTeaserCount = ref(12)
const generating = ref(false)
const loadingExisting = ref(true)
const errorMessage = ref('')
const showMonetizationRegenerationWarning = ref(false)
const plan = ref<any>(null)
const validation = ref<{ approved?: boolean; violations?: string[]; warnings?: string[]; corrections?: string } | null>(null)
const usage = ref<any>(null)
const provider = ref('')
const planCreatedAt = ref<string | null>(null)
const planSavedInDb = ref(false)
const planCost = ref(0)
const savedPlanId = ref<string | null>(null)

// ───── YouTube Package State ─────
const creatingPackage = ref(false)
const packageError = ref('')
const packageResult = ref<{ fullOutputId: string; teaserOutputIds: string[] } | null>(null)
const hasExistingPackage = computed(() => {
  return !!packageResult.value?.fullOutputId && (packageResult.value?.teaserOutputIds?.length || 0) > 0
})

// ───── Regeneration State ─────
const regeneratingFullVideo = ref(false)
const regeneratingTeaserIndex = ref<number | null>(null)
const showFullVideoRegenForm = ref(false)
const regenFullVideoSuggestion = ref('')

// ───── Style Preview State ─────
const generatingPreviewFor = ref<string | null>(null)
const confirmingPreviewFor = ref<string | null>(null)
const selectedSeedMode = ref<string>('random')
const availableSeeds = ref<Array<{ id: string, value: number }>>([])

// ───── Configuração fixa por CENAS ─────
const SCENE_CONFIG = {
  hookOnly: 4,
  deepDive: 6,
  gateway: 5,
  fullVideo: 150
} as const
const FIXED_TEASER_DURATION = 35 as const
const FIXED_FULL_DURATION = 900 as const

// ───── Actions ─────
async function loadExistingPlan() {
  loadingExisting.value = true
  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/monetization-plans`) as any
    if (data?.data?.length > 0) {
      const saved = data.data[0]
      savedPlanId.value = saved.id || null
      plan.value = saved.planData
      const pkg = saved?.planData?._youtubePackage
      if (pkg?.fullOutputId && Array.isArray(pkg?.teaserOutputIds)) {
        packageResult.value = {
          fullOutputId: pkg.fullOutputId,
          teaserOutputIds: pkg.teaserOutputIds
        }
      }
      usage.value = { inputTokens: saved.inputTokens, outputTokens: saved.outputTokens, totalTokens: saved.inputTokens + saved.outputTokens }
      provider.value = saved.provider
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

type GeneratePlanOptions = { confirmRegeneration?: boolean }

async function generatePlan(arg?: PointerEvent | GeneratePlanOptions) {
  const options: GeneratePlanOptions | undefined = (arg && typeof arg === 'object' && 'confirmRegeneration' in arg)
    ? (arg as GeneratePlanOptions)
    : undefined
  generating.value = true
  showMonetizationRegenerationWarning.value = false
  errorMessage.value = ''
  plan.value = null
  validation.value = null
  planSavedInDb.value = false
  savedPlanId.value = null
  packageError.value = ''
  packageResult.value = null

  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/suggest-monetization`, {
      method: 'POST',
      body: {
        teaserDuration: FIXED_TEASER_DURATION,
        fullVideoDuration: FIXED_FULL_DURATION,
        sceneConfig: SCENE_CONFIG,
        teaserCount: selectedTeaserCount.value,
        confirmRegeneration: !!options?.confirmRegeneration,
        forceBriefRegeneration: !!options?.confirmRegeneration
      }
    }) as any

    if (!data.success && data.error === 'validation_failed') {
      errorMessage.value = data.message || 'Plano reprovado pelo validador.'
      if (data.violations?.length) {
        errorMessage.value += '\n\n' + data.violations.join('\n• ')
      }
      return
    }

    plan.value = data.plan
    validation.value = data.validation ?? null
    usage.value = data.usage
    provider.value = data.provider
    planCreatedAt.value = data.createdAt
    planSavedInDb.value = true
    planCost.value = data.cost ?? 0
    savedPlanId.value = data.planId || null
  } catch (err: any) {
    const apiMessage = err?.data?.message || err?.message || 'Erro desconhecido ao gerar plano'
    if (err?.statusCode === 409 || err?.status === 409 || err?.data?.statusMessage === 'CONFIRM_REGENERATION_REQUIRED') {
      showMonetizationRegenerationWarning.value = true
    }
    errorMessage.value = apiMessage
  } finally {
    generating.value = false
  }
}

function openRegenerationWarning() {
  showMonetizationRegenerationWarning.value = true
}

async function confirmRegenerateMonetization() {
  await generatePlan({ confirmRegeneration: true })
}

const canCreateYoutubePackage = computed(() => {
  return !!plan.value && planSavedInDb.value && plan.value?.teasers?.length === 12
})

async function createYoutubePackage() {
  if (creatingPackage.value) return
  creatingPackage.value = true
  packageError.value = ''
  packageResult.value = null

  try {
    const data = await $fetch(`/api/dossiers/${props.dossierId}/create-youtube-package`, {
      method: 'POST',
      body: savedPlanId.value ? { planId: savedPlanId.value } : {}
    }) as any

    if (data?.success) {
      packageResult.value = {
        fullOutputId: data.fullOutputId,
        teaserOutputIds: Array.isArray(data.teaserOutputIds) ? data.teaserOutputIds : []
      }
      // manter também dentro do objeto do plano atual (melhora UX ao navegar sem reload)
      if (plan.value && typeof plan.value === 'object') {
        plan.value._youtubePackage = {
          fullOutputId: packageResult.value.fullOutputId,
          teaserOutputIds: packageResult.value.teaserOutputIds,
          createdAt: new Date().toISOString()
        }
      }
    }
  } catch (err: any) {
    packageError.value = err?.data?.message || err?.message || 'Erro ao criar pacote YouTube'
  } finally {
    creatingPackage.value = false
  }
}

function resetPlan() {
  showMonetizationRegenerationWarning.value = false
  plan.value = null
  validation.value = null
  usage.value = null
  provider.value = ''
  errorMessage.value = ''
  planCreatedAt.value = null
  planSavedInDb.value = false
  planCost.value = 0
  savedPlanId.value = null
  creatingPackage.value = false
  packageError.value = ''
  packageResult.value = null
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
      type: 'fullVideo'
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
    } else if (selectedSeedMode.value.startsWith('current-')) {
      // Manter a seed atual do preview
      seedValue = parseInt(selectedSeedMode.value.replace('current-', ''), 10)
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
    cronologico: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    economico: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    ideologico: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    politico: 'bg-red-500/10 text-red-400 border border-red-500/20',
    humano: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
    conspirativo: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    cientifico: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    geopolitico: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    cultural: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    paradoxal: 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20',
    'conexao-temporal': 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    psicologico: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    evidencial: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    revisionista: 'bg-lime-500/10 text-lime-400 border border-lime-500/20',
    propagandistico: 'bg-red-600/10 text-red-300 border border-red-600/20',
    tecnologico: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    etico: 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
  }
  return colors[category] || 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
}

function narrativeRoleColor(role: string): string {
  const colors: Record<string, string> = {
    gateway: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    'deep-dive': 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
    'hook-only': 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
  }
  return colors[role] || 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
}

function narrativeRoleIcon(role: string): string {
  const icons: Record<string, string> = {
    gateway: '🚪',
    'deep-dive': '🔍',
    'hook-only': '💥'
  }
  return icons[role] || '📋'
}

function narrativeRoleTooltip(role: string): string {
  const tooltips: Record<string, string> = {
    gateway: 'Porta de Entrada — contextualização completa do tema',
    'deep-dive': 'Mergulho Direto — contexto mínimo, foca no ângulo',
    'hook-only': 'Gancho Puro — zero contextualização, máximo impacto'
  }
  return tooltips[role] || ''
}

const roleDistributionLabel = computed(() => {
  const n = selectedTeaserCount.value
  const gw = 1
  const remaining = n - gw
  const dd = Math.ceil(remaining * 0.55)
  const ho = remaining - dd
  return `${gw}🚪 ${dd}🔍 ${ho}💥`
})

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
  loadSeeds()
})
</script>
