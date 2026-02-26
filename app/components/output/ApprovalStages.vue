<template>
  <div>
    <!-- Etapa 0: Plano narrativo (Story Architect) — isolada antes do roteiro -->
    <div v-if="isPlanoStage && output.status !== 'FAILED' && !output.storyOutlineData?.outlineData" class="mb-12 bg-cyan-500/5 border border-cyan-500/20 p-8 rounded-3xl flex flex-col gap-6 py-10">
        <div class="text-center">
          <Map :size="48" class="text-cyan-500/70 mb-2 mx-auto" />
          <h3 class="text-xl font-bold text-cyan-200">Etapa 1: Plano Narrativo</h3>
          <p class="text-zinc-400 text-sm max-w-md mx-auto mt-2">Gere o plano da história (Story Architect) e valide antes de criar o roteiro. O plano define hook, beats, clímax e distribuição de cenas.</p>
        </div>

        <!-- Bloqueio: voz obrigatória antes do Story Architect -->
        <div v-if="needsSpeechConfig" class="w-full max-w-3xl mx-auto p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <div class="flex items-start gap-3">
            <AlertTriangle :size="18" class="text-amber-400 shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="text-amber-200/90 text-sm font-bold">Pré-requisito: configure o narrador</p>
              <p class="text-amber-200/60 text-xs mt-1">
                Antes de gerar o plano narrativo (Story Architect), selecione a <strong>voz</strong> deste output.
              </p>
            </div>
            <button
              type="button"
              @click="$emit('openChangeVoiceModal')"
              class="px-4 py-2 bg-amber-500 text-black font-black uppercase tracking-widest rounded-lg hover:bg-amber-400 transition-all text-[10px] shrink-0"
            >
              Configurar
            </button>
          </div>
        </div>

        <!-- Monetization Picker (quando existe plano ativo) -->
        <div v-if="monetizationPlan?.planData" class="w-full max-w-4xl mx-auto">
          <div class="flex items-center gap-2 mb-4 flex-wrap">
            <Sparkles :size="14" class="text-purple-400" />
            <span class="text-xs font-bold uppercase tracking-widest text-purple-300">{{ monetizationPlan.planData.planTitle || 'Plano de Monetização' }}</span>
            <span v-if="!isMonetizationSelectionLocked" class="text-xs text-zinc-600">(opcional — selecione um item ou escreva sugestão livre)</span>
            <span v-else class="text-xs text-amber-300/70 font-bold uppercase tracking-widest">(vinculado ao pacote — travado)</span>
          </div>

          <!-- Full Video Card -->
          <div v-if="monetizationPlan.planData.fullVideo" class="mb-3">
            <button
              @click="isMonetizationSelectionLocked ? null : $emit('selectMonetizationFullVideo', monetizationPlan.planData.fullVideo)"
              :class="[
                'w-full text-left p-4 rounded-xl border transition-all duration-200',
                selectedMonetizationItem?.itemType === 'fullVideo'
                  ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/30'
                  : (isMonetizationSelectionLocked ? 'bg-black/30 border-white/5 opacity-70' : 'bg-black/30 border-white/5 hover:border-cyan-500/20 hover:bg-cyan-500/5')
              ]"
              :title="isMonetizationSelectionLocked ? 'Este output está vinculado ao item do pacote. Para trocar, crie um novo pacote.' : ''"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded">Full Video</span>
                    <span class="text-xs text-zinc-500">{{ Math.round(monetizationPlan.fullVideoDuration / 60) }}min</span>
                  </div>
                  <h4 class="text-sm font-bold text-white truncate">{{ monetizationPlan.planData.fullVideo.title }}</h4>
                  <p class="text-xs text-zinc-500 mt-1 line-clamp-1">{{ monetizationPlan.planData.fullVideo.hook }}</p>
                </div>
                <div v-if="selectedMonetizationItem?.itemType === 'fullVideo'" class="flex-shrink-0">
                  <CheckCircle2 :size="20" class="text-cyan-400" />
                </div>
              </div>
            </button>
          </div>

          <!-- Teasers Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <button
              v-for="(teaser, idx) in monetizationPlan.planData.teasers"
              :key="idx"
              @click="isMonetizationSelectionLocked ? null : $emit('selectMonetizationTeaser', teaser, Number(idx))"
              :class="[
                'text-left p-3 rounded-xl border transition-all duration-200',
                selectedMonetizationItem?.title === teaser.title
                  ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/30'
                  : (isMonetizationSelectionLocked ? 'bg-black/30 border-white/5 opacity-70' : 'bg-black/30 border-white/5 hover:border-purple-500/20 hover:bg-purple-500/5')
              ]"
              :title="isMonetizationSelectionLocked ? 'Este output está vinculado ao item do pacote. Para trocar, crie um novo pacote.' : ''"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span class="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-zinc-600/20 text-zinc-400 rounded">T{{ Number(idx) + 1 }}</span>
                    <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded">{{ teaser.angleCategory }}</span>
                    <span v-if="teaser.narrativeRole" :class="['px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border', narrativeRoleBadge(teaser.narrativeRole).color]">
                      {{ narrativeRoleBadge(teaser.narrativeRole).icon }} {{ teaser.narrativeRole }}
                    </span>
                  </div>
                  <h4 class="text-xs font-bold text-white truncate">{{ teaser.title }}</h4>
                  <p class="text-[10px] text-zinc-600 mt-0.5 line-clamp-1">{{ teaser.hook }}</p>
                </div>
                <div v-if="selectedMonetizationItem?.title === teaser.title" class="flex-shrink-0 mt-1">
                  <CheckCircle2 :size="16" class="text-purple-400" />
                </div>
              </div>
            </button>
          </div>

          <!-- Selected Item Preview -->
          <div v-if="selectedMonetizationItem" class="mt-4 p-4 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 border border-purple-500/20 rounded-xl">
            <div class="flex items-center gap-2 mb-2">
              <CheckCircle2 :size="14" class="text-purple-400" />
              <span class="text-xs font-bold text-purple-300 uppercase tracking-wider">Selecionado</span>
              <span v-if="isMonetizationSelectionLocked" class="ml-auto text-[10px] font-black uppercase tracking-widest text-amber-300/70 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded">Travado</span>
            </div>
            <p class="text-sm text-white font-bold">{{ selectedMonetizationItem.title }}</p>
            <p class="text-xs text-zinc-400 mt-1">
              {{ selectedMonetizationItem.itemType === 'fullVideo' ? 'Full Video' : 'Teaser' }}
              · Ângulo: <span class="text-indigo-300">{{ selectedMonetizationItem.angleCategory }}</span>
              <template v-if="selectedMonetizationItem.narrativeRole">
                · Papel: <span class="text-emerald-300">{{ selectedMonetizationItem.narrativeRole }}</span>
              </template>
            </p>
            <p class="text-xs text-zinc-500 mt-1 italic">"{{ selectedMonetizationItem.hook }}"</p>
          </div>
        </div>

        <!-- Loading monetization -->
        <div v-else-if="loadingMonetization" class="text-center py-4">
          <span class="text-xs text-zinc-600 animate-pulse">Verificando plano de monetização...</span>
        </div>

        <!-- Sugestões livres (sempre disponível) -->
        <div class="w-full max-w-xl mx-auto text-left">
          <label class="block text-cyan-300/80 text-xs font-bold uppercase tracking-wider mb-2">
            {{ monetizationPlan?.planData ? 'Sugestões adicionais (opcional)' : 'Sugestões para o plano (opcional)' }}
          </label>
          <textarea
            :value="outlineSuggestions"
            @input="$emit('update:outlineSuggestions', ($event.target as HTMLTextAreaElement).value)"
            class="w-full h-28 bg-black/40 border border-cyan-500/20 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none resize-y"
            :placeholder="selectedMonetizationItem
              ? 'Complementos para o item selecionado. Ex: mais tensão, focar na contradição...'
              : 'Ex: Focar no mistério, tom mais sombrio, incluir reviravolta no meio, ênfase no personagem X...'"
          />
          <p class="mt-1.5 text-zinc-500 text-xs">
            {{ selectedMonetizationItem
              ? 'O Story Architect usará o item selecionado + suas sugestões para gerar o plano.'
              : 'Suas sugestões serão enviadas ao Story Architect para orientar o plano e reduzir a necessidade de refazer.' }}
          </p>
        </div>

        <!-- Botão Gerar -->
        <div class="text-center">
          <button
            @click="$emit('generateOutlineThenReload')"
            :disabled="generatingOutline || needsSpeechConfig"
            class="px-8 py-4 bg-cyan-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-cyan-400 transition-all flex items-center gap-3 disabled:opacity-50 mx-auto"
          >
            <span v-if="generatingOutline" class="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"></span>
            <Zap v-else :size="20" />
            {{ generatingOutline ? 'GERANDO PLANO...' : selectedMonetizationItem ? 'GERAR PLANO A PARTIR DA RECEITA' : 'GERAR PLANO NARRATIVO' }}
          </button>
        </div>
    </div>

    <!-- Plano aprovado, sem prosa ainda: botão Gerar Prosa -->
    <div v-else-if="isPlanoStage && output.status !== 'FAILED' && isGateApproved('STORY_OUTLINE')" class="mb-12 bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-3xl flex flex-col items-center justify-center gap-6 text-center py-16">
        <CheckCircle2 :size="48" class="text-emerald-500/70 mb-2" />
        <h3 class="text-xl font-bold text-emerald-200">Plano aprovado</h3>
        <p class="text-zinc-400 text-sm max-w-md">Agora gere a prosa narrativa do Escritor. O roteiro será gerado a partir desta prosa.</p>
        <button
          @click="$emit('startGenerateWriter')"
          :disabled="generatingStage === 'WRITER'"
          class="px-8 py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all flex items-center gap-3 disabled:opacity-50"
        >
          <span v-if="generatingStage === 'WRITER'" class="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"></span>
          <Pencil v-else :size="20" />
          {{ generatingStage === 'WRITER' ? 'GERANDO PROSA...' : 'GERAR PROSA' }}
        </button>
    </div>

    <!-- Writer Generating Placeholder -->
    <div v-if="isPlanoStage && output.status !== 'FAILED' && generatingStage === 'WRITER'" class="mb-12 bg-zinc-500/5 border border-zinc-500/20 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 text-center py-16 animate-pulse">
        <Pencil :size="48" class="text-zinc-600 mb-2" />
        <h3 class="text-xl font-bold text-zinc-400">Gerando Prosa...</h3>
        <p class="text-zinc-500 text-sm max-w-md">O Escritor está criando a narrativa densa baseada no plano aprovado. Isso pode levar alguns segundos.</p>
    </div>

    <!-- Writer Approval Section -->
    <div v-if="isWriterStage" class="mb-12 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 p-8 rounded-3xl relative overflow-hidden group">
       <div class="absolute inset-0 bg-amber-500/5 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
       <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 class="text-xl font-bold text-amber-200 flex items-center gap-2 mb-2">
              <AlertTriangle :size="20" class="text-amber-500" />
              Prosa Narrativa Gerada
            </h3>
            <p class="text-amber-200/60 text-sm max-w-xl">
              Revise a prosa do Escritor abaixo. Ao aprovar, o sistema habilitará a geração do roteiro (cenas) a partir desta prosa.
            </p>
            <div v-if="getStepCost('writer') > 0" class="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/80">
              <DollarSign :size="10" />
              <span class="font-bold">{{ formatCost(getStepCost('writer')) }}</span>
              <span class="uppercase tracking-widest text-emerald-500/50">custo real</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
             <button
               @click="showWriterFeedback = !showWriterFeedback"
               :disabled="approving || generatingStage === 'WRITER'"
               class="px-6 py-4 bg-white/5 border border-white/10 text-zinc-300 font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 text-xs"
             >
               <RotateCw :size="16" />
               Refazer
             </button>

             <button
               @click="$emit('approveWriter')"
               :disabled="approving || generatingStage === 'WRITER'"
               class="px-8 py-4 bg-amber-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 hover:scale-105 transition-all shadow-glow-amber flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
             >
               <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
               <CheckCircle2 v-else :size="20" />
               {{ approving ? 'Processando...' : 'APROVAR PROSA' }}
             </button>
          </div>
       </div>

       <!-- Writer feedback textarea (inline) -->
       <div v-if="showWriterFeedback" class="relative z-10 mt-6 border-t border-amber-500/20 pt-6">
         <p class="text-amber-200/60 text-xs mb-3">Descreva o que gostaria de mudar na prosa:</p>
         <textarea
           v-model="writerFeedbackText"
           rows="4"
           class="w-full bg-zinc-900/80 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-400/60 resize-none"
           placeholder="Ex: Expandir a seção sobre a investigação. Reduzir o foco na infância. Adicionar mais detalhes sobre as consequências políticas..."
         />
         <div class="flex justify-end gap-3 mt-3">
           <button
             @click="showWriterFeedback = false; writerFeedbackText = ''"
             class="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
           >
             Cancelar
           </button>
           <button
             @click="$emit('regenerateWriter', writerFeedbackText); showWriterFeedback = false; writerFeedbackText = ''"
             :disabled="!writerFeedbackText.trim() || generatingStage === 'WRITER'"
             class="px-6 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
           >
             <Sparkles :size="12" />
             Regenerar com Feedback
           </button>
         </div>
       </div>
    </div>

    <!-- Writer aprovado, sem roteiro: botão Gerar Roteiro -->
    <div v-if="isRoteiroStage && !(output.scenes?.length > 0)" class="mb-12 bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-3xl flex flex-col items-center justify-center gap-6 text-center py-16">
        <CheckCircle2 :size="48" class="text-emerald-500/70 mb-2" />
        <h3 class="text-xl font-bold text-emerald-200">Prosa aprovada</h3>
        <p class="text-zinc-400 text-sm max-w-md">Agora gere o roteiro (cenas) a partir da prosa narrativa aprovada.</p>
        <button
          @click="$emit('startGenerateScript')"
          :disabled="generatingStage === 'SCRIPT'"
          class="px-8 py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-3 disabled:opacity-50"
        >
          <span v-if="generatingStage === 'SCRIPT'" class="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"></span>
          <ScrollText v-else :size="20" />
          {{ generatingStage === 'SCRIPT' ? 'GERANDO ROTEIRO...' : 'GERAR ROTEIRO' }}
        </button>
    </div>

    <!-- Script Generating Placeholder -->
    <div v-if="isRoteiroStage && output.status !== 'FAILED' && generatingStage === 'SCRIPT'" class="mb-12 bg-zinc-500/5 border border-zinc-500/20 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 text-center py-16 animate-pulse">
        <ScrollText :size="48" class="text-zinc-600 mb-2" />
        <h3 class="text-xl font-bold text-zinc-400">Gerando Roteiro...</h3>
        <p class="text-zinc-500 text-sm max-w-md">O Roteirista está convertendo a prosa em cenas. Isso pode levar alguns segundos.</p>
    </div>

    <!-- Script Approval Section -->
    <div v-if="isRoteiroStage && output.scenes?.length > 0" class="mb-12 bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/30 p-8 rounded-3xl relative overflow-hidden group">
       <div class="absolute inset-0 bg-orange-500/5 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
       <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 class="text-xl font-bold text-orange-200 flex items-center gap-2 mb-2">
              <AlertTriangle :size="20" class="text-orange-500" />
              Aprovação Necessária
            </h3>
            <p class="text-orange-200/60 text-sm max-w-xl">
              Revise o roteiro abaixo cuidadosamente. Ao aprovar, o sistema iniciará automaticamente a geração de imagens (custo de tokens/GPU).
            </p>
            <!-- Cost info badge -->
            <div v-if="getStepCost('script') > 0" class="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono"
              :class="isEstimatedCost('script') ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400/80' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/80'"
            >
              <DollarSign :size="10" />
              <span class="font-bold">{{ formatCost(getStepCost('script')) }}</span>
              <span v-if="isEstimatedCost('script')" class="uppercase tracking-widest text-amber-500/50">estimado</span>
              <span v-else class="uppercase tracking-widest text-emerald-500/50">custo real</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
             <button
               @click="$emit('showScriptFeedbackModal')"
               :disabled="approving || regeneratingScript"
               class="px-6 py-4 bg-white/5 border border-white/10 text-zinc-300 font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 text-xs"
             >
               <RotateCw :size="16" />
               Refazer
             </button>

             <button
               @click="$emit('approveScript')"
               :disabled="approving || regeneratingScript"
               class="px-8 py-4 bg-orange-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-orange-400 hover:scale-105 transition-all shadow-glow-orange flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
             >
               <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
               <CheckCircle2 v-else :size="20" />
               {{ approving ? 'Processando...' : 'APROVAR' }}
             </button>
          </div>
       </div>
    </div>

    <!-- 1.5 Retention QA Section (Obrigatório — bloqueia imagens) -->
    <div v-if="isGateApproved('SCRIPT') && !isGateApproved('RETENTION_QA')" class="mb-8 bg-gradient-to-br from-teal-500/10 to-transparent border border-teal-500/30 p-8 rounded-3xl relative overflow-hidden">
      <div class="relative z-10">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 class="text-xl font-bold text-teal-200 flex items-center gap-2 mb-1">
              <BarChart3 :size="20" class="text-teal-500" />
              Análise de Retenção
              <span v-if="retentionQA" class="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">Analisado</span>
            </h3>
            <p class="text-teal-200/50 text-sm max-w-xl">
              Analisa retenção viral do roteiro cena a cena. Gera scores, detecta riscos e cria um Edit Blueprint com stingers, pattern interrupts e tiering de qualidade.
            </p>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <button
              v-if="!isGateApproved('RETENTION_QA') && retentionQA"
              @click="$emit('approveRetentionQA')"
              :disabled="approving"
              class="px-5 py-3 bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <CheckCircle2 :size="14" />
              Aprovar Análise
            </button>
            <button
              v-if="retentionQA && !isGateApproved('RETENTION_QA')"
              @click="$emit('fixScriptWithRetentionQA')"
              :disabled="generatingStage === 'SCRIPT_FIX' || generatingStage === 'RETENTION_QA'"
              class="px-5 py-3 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <span v-if="generatingStage === 'SCRIPT_FIX'" class="animate-spin w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full"></span>
              <Pencil v-else :size="14" />
              {{ generatingStage === 'SCRIPT_FIX' ? 'CORRIGINDO...' : 'CORRIGIR ROTEIRO' }}
            </button>
            <button
              @click="$emit('startGenerateRetentionQA')"
              :disabled="generatingStage === 'RETENTION_QA' || generatingStage === 'SCRIPT_FIX'"
              class="px-5 py-3 bg-teal-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-teal-400 hover:scale-105 transition-all shadow-lg flex items-center gap-2 text-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <span v-if="generatingStage === 'RETENTION_QA'" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
              <BarChart3 v-else :size="14" />
              {{ generatingStage === 'RETENTION_QA' ? 'ANALISANDO...' : (retentionQA ? 'REANALISAR' : 'ANALISAR RETENÇÃO') }}
            </button>
          </div>
        </div>

        <!-- Resultados da análise -->
        <div v-if="retentionQA" class="space-y-4">
          <!-- Score geral + Summary -->
          <div class="flex flex-col md:flex-row gap-4">
            <div class="bg-black/20 p-5 rounded-2xl border border-teal-500/10 flex-shrink-0 flex flex-col items-center justify-center min-w-[140px]">
              <div class="text-4xl font-black font-mono" :class="retentionQA.overallScore >= 7 ? 'text-emerald-400' : retentionQA.overallScore >= 4 ? 'text-amber-400' : 'text-red-400'">
                {{ retentionQA.overallScore?.toFixed(1) }}
              </div>
              <div class="text-[10px] uppercase tracking-widest text-teal-400/50 mt-1">Score Geral</div>
              <div class="w-full mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :class="retentionQA.overallScore >= 7 ? 'bg-emerald-500' : retentionQA.overallScore >= 4 ? 'bg-amber-500' : 'bg-red-500'" :style="{ width: `${(retentionQA.overallScore / 10) * 100}%` }"></div>
              </div>
            </div>
            <div class="bg-black/20 p-5 rounded-2xl border border-teal-500/10 flex-1">
              <h4 class="text-xs font-black uppercase tracking-widest text-teal-400/60 mb-2">Resumo da Análise</h4>
              <p class="text-sm text-teal-200/70 leading-relaxed">{{ retentionQA.summary }}</p>
            </div>
          </div>

          <!-- Edit Blueprint Summary -->
          <div v-if="retentionQA.editBlueprint" class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-black/20 p-4 rounded-xl border border-white/5 text-center">
              <div class="text-2xl font-black font-mono text-pink-400">{{ retentionQA.editBlueprint.patternInterrupts?.length || 0 }}</div>
              <div class="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Pattern Interrupts</div>
            </div>
            <div class="bg-black/20 p-4 rounded-xl border border-white/5 text-center">
              <div class="text-2xl font-black font-mono text-amber-400">{{ retentionQA.editBlueprint.onScreenTexts?.length || 0 }}</div>
              <div class="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">On-Screen Texts</div>
            </div>
            <div class="bg-black/20 p-4 rounded-xl border border-white/5 text-center">
              <div class="text-2xl font-black font-mono text-cyan-400">{{ retentionQA.editBlueprint.musicEvents?.length || 0 }}</div>
              <div class="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Music Events</div>
            </div>
            <div class="bg-black/20 p-4 rounded-xl border border-white/5 text-center">
              <div class="text-2xl font-black font-mono text-yellow-400">{{ retentionQA.editBlueprint.scenePriority?.filter((s: any) => s.tier === 'hero').length || 0 }}</div>
              <div class="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Hero Scenes</div>
            </div>
          </div>

          <!-- Per-scene analysis (collapsible) -->
          <details class="bg-black/20 rounded-2xl border border-teal-500/10 overflow-hidden">
            <summary class="px-5 py-4 cursor-pointer text-xs font-black uppercase tracking-widest text-teal-400/60 hover:text-teal-400 transition-colors flex items-center gap-2">
              <ChevronDown :size="14" />
              Análise por Cena ({{ retentionQA.sceneAnalysis?.length || 0 }} cenas)
            </summary>
            <div class="px-5 pb-5 space-y-3">
              <div v-for="analysis in retentionQA.sceneAnalysis" :key="analysis.sceneOrder" class="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0"
                  :class="analysis.retentionScore >= 7 ? 'bg-emerald-500/20 text-emerald-400' : analysis.retentionScore >= 4 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'"
                >
                  {{ analysis.retentionScore?.toFixed(0) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <span class="text-xs font-bold text-white/70">Cena {{ analysis.sceneOrder + 1 }}</span>
                    <span v-for="flag in (analysis.riskFlags || [])" :key="flag" class="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-red-500/20 text-red-400 border border-red-500/20">{{ flag }}</span>
                  </div>
                  <div v-if="analysis.suggestions?.length" class="space-y-1">
                    <p v-for="(sug, i) in analysis.suggestions" :key="i" class="text-xs text-zinc-400 leading-relaxed">{{ sug }}</p>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- 2. Image Approval Section (requires Retention QA approved) -->
    <div v-if="isGateApproved('RETENTION_QA') && !isGateApproved('IMAGES')" class="mb-12 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 p-8 rounded-3xl relative overflow-hidden group">
       <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 class="text-xl font-bold text-purple-200 flex items-center gap-2 mb-2">
              <ImageIcon :size="20" class="text-purple-500" />
              Estágio 2: Visual (Imagens)
            </h3>

            <div v-if="allScenesHaveImages">
                <p class="text-purple-200/60 text-sm max-w-xl">
                Imagens geradas para todas as {{ output.scenes?.length }} cenas. Revise abaixo e aprove.
                </p>
            </div>
            <div v-else-if="output.scenes?.some((s:any) => s.images?.length > 0)">
                <p class="text-purple-200/60 text-sm max-w-xl animate-pulse">
                Gerando imagens... {{ output.scenes?.filter((s:any) => s.images?.length > 0).length }}/{{ output.scenes?.length }} cenas prontas.
                </p>
            </div>
            <div v-else>
                 <p class="text-purple-200/60 text-sm max-w-xl">
                Roteiro aprovado. Agora você precisa gerar as imagens para cada cena.
                </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3">
            <button v-if="allScenesHaveImages"
                @click="$emit('approveImages')"
                :disabled="approving"
                class="px-8 py-4 bg-purple-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-purple-400 hover:scale-105 transition-all shadow-glow-purple flex items-center gap-3 disabled:opacity-50"
            >
                <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                <CheckCircle2 v-else :size="20" />
                {{ approving ? 'Processando...' : 'APROVAR IMAGENS' }}
            </button>

            <button
                @click="$emit('generateImages')"
                :disabled="generatingStage === 'IMAGES' || (output.status === 'IN_PROGRESS' && !isGateApproved('IMAGES'))"
                :class="allScenesHaveImages ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-purple-500/50' : 'px-8 py-4 bg-purple-500 text-white shadow-glow-purple hover:bg-purple-400 hover:scale-105'"
                class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
              >
                 <span v-if="generatingStage === 'IMAGES' || (output.status === 'IN_PROGRESS' && !isGateApproved('IMAGES'))" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                 <RotateCw v-else-if="allScenesHaveImages || output.scenes?.some((s:any) => s.images?.length > 0)" :size="16" />
                 <Zap v-else :size="20" />
                 {{ generatingStage === 'IMAGES' || (output.status === 'IN_PROGRESS' && !isGateApproved('IMAGES')) ? 'GERANDO...' : (allScenesHaveImages || output.scenes?.some((s:any) => s.images?.length > 0) ? 'REFAZER' : 'GERAR IMAGENS') }}
            </button>
          </div>
       </div>
    </div>

    <!-- 3. Narração Approval Section -->
    <div v-if="isGateApproved('IMAGES') && !isGateApproved('AUDIO')" class="mb-12 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 p-8 rounded-3xl relative overflow-hidden group">
       <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 class="text-xl font-bold text-blue-200 flex items-center gap-2 mb-2">
              <Mic :size="20" class="text-blue-500" />
              Estágio 3: Narração (Áudio)
            </h3>
            <div v-if="allScenesHaveAudio">
                <p class="text-zinc-300/80 text-sm max-w-xl">
                    Narração gerada para todas as {{ output.scenes?.length }} cenas. Ouça abaixo e aprove.
                </p>
            </div>
            <div v-else-if="output.scenes?.some((s:any) => s.audioTracks?.some((a:any) => a.type === 'scene_narration'))">
                <p class="text-zinc-300/80 text-sm max-w-xl animate-pulse">
                    Gerando narração... {{ output.scenes?.filter((s:any) => s.audioTracks?.some((a:any) => a.type === 'scene_narration')).length }}/{{ output.scenes?.length }} cenas prontas.
                </p>
            </div>
            <div v-else>
                 <p class="text-zinc-300/80 text-sm max-w-xl">
                    Imagens aprovadas. Agora gere a narração para cada cena.
                </p>
            </div>
          </div>

           <!-- Action Buttons -->
          <div class="flex gap-3 flex-wrap">
            <button v-if="allScenesHaveAudio"
                @click="$emit('approveAudio')"
                :disabled="approving"
                class="px-8 py-4 bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-blue-400 hover:scale-105 transition-all shadow-glow-blue flex items-center gap-3 disabled:opacity-50"
            >
                <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                <CheckCircle2 v-else :size="20" />
                {{ approving ? 'Processando...' : 'APROVAR ÁUDIO' }}
            </button>

            <!-- Trocar Narrador -->
            <button
                @click="$emit('openChangeVoiceModal')"
                :disabled="generatingStage === 'AUDIO' || changingVoice"
                class="px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-amber-500/50 font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
            >
                <span v-if="changingVoice" class="animate-spin w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full"></span>
                <Mic v-else :size="16" class="text-amber-400" />
                {{ changingVoice ? 'TROCANDO...' : 'TROCAR NARRADOR' }}
            </button>

            <button
                @click="$emit('generateAudio')"
                :disabled="generatingStage === 'AUDIO' || (output.status === 'IN_PROGRESS' && !isGateApproved('AUDIO'))"
                :class="allScenesHaveAudio ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-blue-500/50' : 'px-8 py-4 bg-blue-500 text-white shadow-glow-blue hover:bg-blue-400 hover:scale-105'"
                class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
              >
                 <span v-if="generatingStage === 'AUDIO' || (output.status === 'IN_PROGRESS' && !isGateApproved('AUDIO'))" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                 <RotateCw v-else-if="allScenesHaveAudio || output.scenes?.some((s:any) => s.audioTracks?.some((a:any) => a.type === 'scene_narration'))" :size="16" />
                 <Zap v-else :size="20" />
                 {{ generatingStage === 'AUDIO' || (output.status === 'IN_PROGRESS' && !isGateApproved('AUDIO')) ? 'GERANDO...' : (allScenesHaveAudio || output.scenes?.some((s:any) => s.audioTracks?.some((a:any) => a.type === 'scene_narration')) ? 'REFAZER' : 'GERAR ÁUDIO') }}
            </button>

            <!-- SFX: Gerar efeitos sonoros (quando há cenas com audioDescription) -->
            <button
                v-if="hasSFXScenes && allScenesHaveAudio"
                @click="$emit('generateSFX')"
                :disabled="generatingSFX"
                :class="allScenesHaveSFX ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-purple-500/50' : 'px-6 py-4 bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 hover:text-purple-200'"
                class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-xs"
              >
                 <span v-if="generatingSFX" class="animate-spin w-4 h-4 border-2 border-purple-300/30 border-t-purple-300 rounded-full"></span>
                 <RotateCw v-else-if="allScenesHaveSFX" :size="14" />
                 <AudioWaveform v-else :size="16" />
                 {{ generatingSFX ? 'GERANDO SFX...' : (allScenesHaveSFX ? 'REFAZER SFX' : 'GERAR SFX') }}
            </button>
          </div>
          <!-- SFX Status Info -->
          <div v-if="hasSFXScenes && allScenesHaveAudio" class="mt-3 flex items-center gap-2 text-xs">
            <AudioWaveform :size="12" class="text-purple-400/60" />
            <span v-if="allScenesHaveSFX" class="text-purple-300/60">
              SFX gerados para {{ sfxSceneCount }} cena(s)
            </span>
            <span v-else class="text-zinc-500">
              {{ sfxSceneCount }} cena(s) com efeitos sonoros programados
            </span>
          </div>
       </div>
    </div>

    <!-- 4. BGM Approval Section -->
    <div v-if="isGateApproved('AUDIO') && !isGateApproved('BGM')" class="mb-12 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 p-8 rounded-3xl relative overflow-hidden group">
       <div class="relative z-10 flex flex-col gap-6">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 class="text-xl font-bold text-emerald-200 flex items-center gap-2 mb-2">
                <Radio :size="20" class="text-emerald-500" />
                Estágio 4: Background Music
              </h3>
              <div v-if="bgmTracks.length > 0">
                  <p class="text-emerald-200/60 text-sm max-w-xl">
                    {{ bgmTracks.length === 1 ? 'Música de fundo gerada' : `${bgmTracks.length} tracks de música geradas` }} com duração baseada na narração real. Ouça {{ bgmTracks.length > 1 ? 'cada uma' : '' }} abaixo e aprove para liberar o Motion.
                  </p>
              </div>
              <div v-else>
                   <p class="text-emerald-200/60 text-sm max-w-xl">
                      Narração aprovada. Agora gere a música de fundo (Stable Audio 2.5) com duração exata baseada no áudio da narração.
                  </p>
                  <p v-if="output.script?.backgroundMusicPrompt" class="text-emerald-300/40 text-xs mt-2 italic">
                    Prompt: "{{ output.script.backgroundMusicPrompt }}"
                  </p>
                  <div v-else-if="output.script?.backgroundMusicTracks?.length" class="mt-2 space-y-1">
                    <p class="text-emerald-300/40 text-xs italic">
                      {{ output.script.backgroundMusicTracks.length }} tracks planejadas no roteiro
                    </p>
                  </div>
              </div>
            </div>

             <!-- Action Buttons -->
            <div class="flex gap-3 shrink-0">
              <button v-if="bgmTracks.length > 0"
                  @click="$emit('approveBgm')"
                  :disabled="approving"
                  class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-glow-emerald flex items-center gap-3 disabled:opacity-50"
              >
                  <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                  <CheckCircle2 v-else :size="20" />
                  {{ approving ? 'Processando...' : 'APROVAR MÚSICA' }}
              </button>

              <button
                  @click="$emit('generateBgm')"
                  :disabled="generatingStage === 'BGM'"
                  :class="bgmTracks.length > 0 ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-emerald-500/50' : 'px-8 py-4 bg-emerald-500 text-white shadow-glow-emerald hover:bg-emerald-400 hover:scale-105'"
                  class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
                >
                   <span v-if="generatingStage === 'BGM'" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                   <RotateCw v-else-if="bgmTracks.length > 0" :size="16" />
                   <Zap v-else :size="20" />
                   {{ generatingStage === 'BGM' ? 'GERANDO...' : (bgmTracks.length > 0 ? 'REFAZER' : 'GERAR MÚSICA') }}
              </button>
            </div>
          </div>

          <!-- BGM Tracks Players -->
          <div v-if="bgmTracks.length > 0" class="space-y-4">
            <div
              v-for="(track, idx) in bgmTracks"
              :key="track.id"
              class="bg-black/20 p-5 rounded-2xl border border-emerald-500/10 hover:border-emerald-500/20 transition-all"
            >
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-mono font-bold text-emerald-300">
                  {{ Number(idx) + 1 }}
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span v-if="getBgmTrackMeta(Number(idx))" class="text-xs px-2 py-1 bg-emerald-500/20 rounded text-emerald-300 font-mono">
                    Cenas {{ getBgmTrackMeta(Number(idx)).startScene }} → {{ getBgmTrackMeta(Number(idx)).endScene !== null && getBgmTrackMeta(Number(idx)).endScene !== undefined ? getBgmTrackMeta(Number(idx)).endScene : 'Fim' }}
                  </span>
                  <span v-else-if="bgmTracks.length === 1" class="text-xs px-2 py-1 bg-emerald-500/20 rounded text-emerald-300 font-mono uppercase tracking-widest">Video Todo</span>
                  <span class="text-xs px-2 py-1 bg-emerald-500/10 rounded text-emerald-400/60 font-mono">{{ track.duration ? `${track.duration.toFixed(1)}s` : '—' }}</span>
                  <span class="text-xs px-2 py-1 bg-emerald-500/10 rounded text-emerald-400/60 font-mono">{{ getBgmTrackMeta(Number(idx))?.volume || output.script?.backgroundMusicVolume || -18 }}dB</span>
                </div>
              </div>

              <!-- Prompt -->
              <p v-if="getBgmTrackPrompt(Number(idx))" class="text-xs text-emerald-200/60 leading-relaxed italic mb-3">
                {{ getBgmTrackPrompt(Number(idx)) }}
              </p>

              <!-- Audio Player -->
              <audio
                controls
                class="w-full h-10 opacity-70 hover:opacity-100 transition-opacity"
                :src="`/api/audio-tracks/${track.id}/stream`"
              ></audio>
            </div>
          </div>
       </div>
    </div>

    <!-- 4.5 Music Events / Stingers (Opcional — como SFX) -->
    <div v-if="isGateApproved('BGM') && retentionQA?.editBlueprint?.musicEvents?.length && !isGateApproved('MOTION')" class="mb-6 bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/20 p-6 rounded-2xl">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h4 class="text-sm font-bold text-cyan-200 flex items-center gap-2 mb-1">
            <Zap :size="16" class="text-cyan-500" />
            Efeitos Editoriais
            <span class="ml-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-cyan-500/10 text-cyan-400/60 border border-cyan-500/20">Opcional</span>
          </h4>
          <p class="text-cyan-200/40 text-xs max-w-lg">
            {{ retentionQA.editBlueprint.musicEvents.length }} efeito(s) sonoro(s) do Edit Blueprint (stingers, risers, drops). Ative na renderização para incluir no vídeo.
          </p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <button
            @click="$emit('startGenerateMusicEvents')"
            :disabled="generatingMusicEvents"
            :class="hasMusicEvents ? 'px-5 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-cyan-500/50' : 'px-5 py-3 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30'"
            class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 text-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <span v-if="generatingMusicEvents" class="animate-spin w-3.5 h-3.5 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full"></span>
            <RotateCw v-else-if="hasMusicEvents" :size="12" />
            <Zap v-else :size="14" />
            {{ generatingMusicEvents ? 'GERANDO...' : (hasMusicEvents ? 'REFAZER STINGERS' : 'GERAR STINGERS') }}
          </button>
        </div>
      </div>
      <div v-if="hasMusicEvents" class="mt-4 space-y-2">
        <div class="flex items-center gap-2 mb-2">
          <Zap :size="12" class="text-cyan-400/60" />
          <span class="text-[10px] font-black uppercase tracking-widest text-cyan-400/60">{{ musicEventCount }} stinger(s) gerado(s)</span>
        </div>
        <div
          v-for="track in output.audioTracks?.filter((a: any) => a.type === 'music_event')"
          :key="track.id"
          class="flex items-center gap-3 bg-black/20 rounded-xl px-4 py-2 border border-cyan-500/10"
        >
          <div class="flex-shrink-0 text-[10px] text-cyan-400/70 font-mono w-[60px]">
            {{ track.offsetMs != null ? `${(track.offsetMs / 1000).toFixed(1)}s` : '—' }}
          </div>
          <div class="flex-shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-cyan-500/15 text-cyan-400/80 border border-cyan-500/20">
            {{ getMusicEventType(track.offsetMs) }}
          </div>
          <audio
            controls
            class="flex-1 h-8 opacity-50 hover:opacity-100 transition-opacity"
            :src="`/api/audio-tracks/${track.id}/stream`"
          >
          </audio>
          <span v-if="track.duration" class="text-[10px] text-zinc-500 font-mono flex-shrink-0">{{ track.duration.toFixed(1) }}s</span>
        </div>
      </div>
    </div>

    <!-- 5. Motion Approval Section -->
    <div v-if="isGateApproved('BGM') && !isGateApproved('MOTION')" class="mb-12 bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/30 p-8 rounded-3xl relative overflow-hidden group">
       <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 class="text-xl font-bold text-pink-200 flex items-center gap-2 mb-2">
              <Clapperboard :size="20" class="text-pink-500" />
              Estágio 5: Motion (Vídeo)
            </h3>
             <div v-if="allScenesHaveVideos">
                <p class="text-pink-200/60 text-sm max-w-xl">
                    Clipes de vídeo gerados para todas as {{ output.scenes?.length }} cenas. Revise e aprove.
                </p>
            </div>
            <div v-else-if="output.scenes?.some((s:any) => s.videos?.length > 0)">
                <p class="text-pink-200/60 text-sm max-w-xl animate-pulse">
                    Gerando motion... {{ output.scenes?.filter((s:any) => s.videos?.length > 0).length }}/{{ output.scenes?.length }} cenas prontas.
                </p>
            </div>
            <div v-else>
                 <p class="text-pink-200/60 text-sm max-w-xl">
                    Música aprovada. Gere os vídeos (Image-to-Video) para dar vida às cenas.
                </p>
            </div>
          </div>

           <!-- Action Buttons -->
          <div class="flex gap-3">
            <button v-if="allScenesHaveVideos"
                @click="$emit('approveMotion')"
                :disabled="approving"
                class="px-8 py-4 bg-pink-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-pink-400 hover:scale-105 transition-all shadow-glow-pink flex items-center gap-3 disabled:opacity-50"
            >
                <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                <CheckCircle2 v-else :size="20" />
                {{ approving ? 'Processando...' : 'APROVAR MOTION' }}
            </button>

            <button
                @click="$emit('generateMotion')"
                :disabled="generatingStage === 'MOTION' || (output.status === 'IN_PROGRESS' && !isGateApproved('MOTION'))"
                :class="allScenesHaveVideos ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-pink-500/50' : 'px-8 py-4 bg-pink-500 text-white shadow-glow-pink hover:bg-pink-400 hover:scale-105'"
                class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
              >
                 <span v-if="generatingStage === 'MOTION' || (output.status === 'IN_PROGRESS' && !isGateApproved('MOTION'))" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                 <RotateCw v-else-if="allScenesHaveVideos || output.scenes?.some((s:any) => s.videos?.length > 0)" :size="16" />
                 <Zap v-else :size="20" />
                 {{ generatingStage === 'MOTION' || (output.status === 'IN_PROGRESS' && !isGateApproved('MOTION')) ? 'GERANDO...' : (allScenesHaveVideos || output.scenes?.some((s:any) => s.videos?.length > 0) ? 'REFAZER' : 'GERAR MOTION') }}
            </button>
          </div>
       </div>
    </div>

    <!-- 6. Render Trigger -->
    <div v-if="canRenderMaster && !output.renderProduct" class="mb-12 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 p-8 rounded-3xl relative overflow-hidden group">
         <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 class="text-xl font-bold text-emerald-200 flex items-center gap-2 mb-2">
              <Film :size="20" class="text-emerald-500" />
              Estágio 6: Renderização Master
            </h3>
            <p class="text-emerald-200/60 text-sm max-w-xl">
                Todos os assets foram aprovados. O sistema está pronto para compilar o vídeo final (FFmpeg).
            </p>
          </div>
          <div class="flex flex-col items-end gap-3">
            <button
              @click="$emit('renderMaster')"
              :disabled="isRenderingActive"
              class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-glow-emerald flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span v-if="isRenderingActive" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
              <Zap v-else :size="20" />
              {{ isRenderingActive ? 'RENDERIZANDO...' : 'RENDERIZAR MASTER' }}
            </button>
            <!-- Aviso de render travado -->
            <div v-if="renderStale" class="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 max-w-md">
              <div class="flex-1">
                <p class="text-xs font-bold text-red-300">Render parece travado</p>
                <p class="text-xs text-red-300/60">O status está em IN_PROGRESS mas nenhum render ativo foi detectado. O processo pode ter sido interrompido.</p>
              </div>
              <button
                @click="$emit('cancelStaleRender')"
                class="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-500/30 transition-all shrink-0"
              >
                CANCELAR
              </button>
            </div>
          </div>
         </div>
    </div>

    <!-- 7. Render Approval (quando renderizado, antes de COMPLETED) -->
    <div v-if="output.status === 'RENDERED' && output.renderProduct && !isGateApproved('RENDER')" class="mb-12 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 p-8 rounded-3xl relative overflow-hidden group">
         <div class="relative z-10 flex flex-col gap-6">
          <div>
            <h3 class="text-xl font-bold text-amber-200 flex items-center gap-2 mb-2">
              <CheckCircle2 :size="20" class="text-amber-500" />
              Estágio 7: Aprovação Final
            </h3>
            <p class="text-amber-200/60 text-sm max-w-xl">
                O vídeo foi renderizado com sucesso. Assista acima e aprove para finalizar ou refaça a renderização.
            </p>
          </div>

          <div class="flex gap-3">
            <button
                @click="$emit('approveRender')"
                :disabled="approving"
                class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-glow-emerald flex items-center gap-3 disabled:opacity-50"
            >
                <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                <CheckCircle2 v-else :size="20" />
                {{ approving ? 'Processando...' : 'APROVAR E CONCLUIR' }}
            </button>

            <button
                @click="$emit('renderAgain')"
                :disabled="rendering"
                class="px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-amber-500/50 font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
              >
                 <span v-if="rendering" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                 <RotateCw v-else :size="16" />
                 {{ rendering ? 'RENDERIZANDO...' : 'REFAZER RENDER' }}
            </button>
          </div>
         </div>
    </div>

    <!-- Aviso: Vídeo armazenado em disco (não no banco) -->
    <div v-if="output.isStoredOnDisk" class="mb-12 bg-gradient-to-r from-yellow-500/10 via-orange-500/5 to-transparent border border-yellow-500/40 p-6 rounded-2xl flex items-start gap-4">
      <div class="mt-0.5 shrink-0 w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
        <AlertTriangle :size="20" class="text-yellow-400" />
      </div>
      <div>
        <h4 class="text-yellow-300 font-bold text-sm uppercase tracking-wider mb-1">Armazenamento Local</h4>
        <p class="text-yellow-200/60 text-sm leading-relaxed">
          Este vídeo é grande demais para ser salvo no banco de dados e está armazenado <strong class="text-yellow-300">apenas em disco local</strong> no servidor.
          Ele será <strong class="text-yellow-300">perdido</strong> em caso de mudança de servidor, novo deploy ou migração para outra nuvem.
          Faça o download do vídeo antes de qualquer operação de infraestrutura.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Map, Zap, ScrollText, CheckCircle2, AlertTriangle, ImageIcon, Mic, Radio, Clapperboard,
  Film, RotateCw, DollarSign, BarChart3, ChevronDown, AudioWaveform, Pencil, Sparkles
} from 'lucide-vue-next'

const showWriterFeedback = ref(false)
const writerFeedbackText = ref('')

const props = defineProps<{
  output: any
  isPlanoStage: boolean
  isWriterStage: boolean
  isRoteiroStage: boolean
  needsSpeechConfig: boolean
  generatingOutline: boolean
  generatingStage: string | null
  approving: boolean
  canRenderMaster: boolean
  isRenderingActive: boolean
  rendering: boolean
  renderStale: boolean
  allScenesHaveImages: boolean
  allScenesHaveAudio: boolean
  allScenesHaveVideos: boolean
  hasSFXScenes: boolean
  allScenesHaveSFX: boolean
  sfxSceneCount: number
  generatingSFX: boolean
  generatingMusicEvents: boolean
  hasMusicEvents: boolean
  musicEventCount: number
  bgmTracks: any[]
  changingVoice: boolean
  regeneratingScript: boolean
  monetizationPlan: any
  loadingMonetization: boolean
  isMonetizationSelectionLocked: boolean
  selectedMonetizationItem: any
  outlineSuggestions: string
  formatCost: (v: number) => string
  getStepCost: (step: string) => number
  isEstimatedCost: (step: string) => boolean
  getBgmTrackMeta: (idx: number) => any
  getBgmTrackPrompt: (idx: number) => string | null
  getMusicEventType: (offsetMs: number | null) => string
  narrativeRoleBadge: (role: string) => { color: string; icon: string }
}>()

/** Check if a StageGate is approved for a given stage name */
function isGateApproved(stage: string): boolean {
  return props.output?.stageGates?.find((g: any) => g.stage === stage)?.status === 'APPROVED' || false
}

/** Shorthand accessor for retentionQA analysis data */
const retentionQA = computed(() => props.output?.retentionQAData?.analysisData)

defineEmits<{
  openChangeVoiceModal: []
  selectMonetizationFullVideo: [item: any]
  selectMonetizationTeaser: [teaser: any, idx: number]
  'update:outlineSuggestions': [value: string]
  generateOutlineThenReload: []
  startGenerateWriter: []
  regenerateWriter: [feedback: string]
  approveWriter: []
  startGenerateScript: []
  approveScript: []
  showScriptFeedbackModal: []
  startGenerateRetentionQA: []
  approveRetentionQA: []
  fixScriptWithRetentionQA: []
  generateImages: []
  approveImages: []
  generateAudio: []
  approveAudio: []
  generateSFX: []
  generateBgm: []
  approveBgm: []
  startGenerateMusicEvents: []
  generateMotion: []
  approveMotion: []
  renderMaster: []
  cancelStaleRender: []
  approveRender: []
  renderAgain: []
}>()
</script>
