<template>
  <div class="min-h-screen bg-[#0A0A0A] font-sans selection:bg-primary/30 text-white relative overflow-hidden">
    <!-- Background FX -->
    <div class="fixed inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-20 animate-pulse-slow"></div>
      <div class="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] opacity-20"></div>
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 container mx-auto px-6 py-12 max-w-7xl">
      <!-- Breadcrumb / Back -->
      <NuxtLink 
        v-if="output?.dossierId"
        :to="`/dossiers/${output.dossierId}`" 
        class="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 mono-label !text-[10px]"
      >
        <ArrowLeft :size="14" />
        VOLTAR AO DOSSIÊ
      </NuxtLink>

      <div v-if="loading" class="flex flex-col items-center justify-center min-h-[50vh]">
        <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p class="mt-4 mono-label animate-pulse">Carregando Produção...</p>
      </div>

      <template v-else-if="output">
        <!-- Header -->
        <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <span class="px-2 py-1 bg-white/10 rounded text-[9px] font-black tracking-widest uppercase text-white/70">
                {{ output.outputType }}
              </span>
              <span v-if="output.status" :class="getStatusClass(output.status)" class="px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border">
                {{ output.status }}
              </span>
            </div>
            <h1 class="text-4xl md:text-5xl font-black tracking-tighter text-white italic uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
              {{ output.title || 'Sem Título' }}
            </h1>
            <p class="text-zinc-500 mt-2 text-sm max-w-2xl px-1">
              {{ output.dossier?.title }} • {{ output.platform }} • {{ output.aspectRatio }}
            </p>

            <!-- Cost Badge -->
            <div v-if="costs?.total > 0" class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <DollarSign :size="14" class="text-amber-400" />
              <span class="text-amber-300 text-sm font-mono font-bold">{{ formatCost(costs.total) }}</span>
              <span class="text-amber-400/50 text-[9px] uppercase tracking-widest">gasto neste output</span>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="flex gap-4">
             <button v-if="output.status === 'COMPLETED'" @click="downloadMaster" class="btn-primary flex items-center gap-2">
               <Download :size="16" />
               BAIXAR MASTER
             </button>
             <button v-else-if="output.status === 'FAILED'" class="btn-secondary text-red-400 border-red-500/30 flex items-center gap-2">
               <RotateCw :size="16" />
               RETRY
             </button>

             <!-- BOTAO RENDERIZAR NOVAMENTE -->
             <button 
                v-if="output.status === 'COMPLETED' || output.status === 'FAILED'"
                @click="renderAgain"
                :disabled="rendering"
                class="btn-secondary flex items-center gap-2 text-xs"
              >
                <Film :size="16" :class="rendering ? 'animate-spin' : ''" />
                <span>{{ rendering ? 'RENDERIZANDO...' : 'RENDERIZAR NOVAMENTE' }}</span>
              </button>
          </div>
        </header>

        <!-- Final Video Player -->
        <div v-if="output.status === 'COMPLETED' || output.hasVideo" class="mb-12">
            <div class="glass-card overflow-hidden rounded-3xl border-primary/20 shadow-2xl shadow-primary/5">
                <video 
                    controls 
                    class="w-full aspect-video bg-black"
                    :class="output.aspectRatio === '9:16' ? 'max-h-[70vh] object-contain' : ''"
                    :src="`/api/outputs/${outputId}/video`"
                ></video>
                <div class="p-4 bg-white/5 flex items-center justify-between text-[10px] mono-label text-zinc-500">
                    <span class="flex items-center gap-2">
                        <Film :size="12" /> MASTER RENDERIZADO (POSTGRESQL STORAGE)
                    </span>
                    <span>{{ output.outputMimeType }} • {{ (output.outputSize / 1024 / 1024).toFixed(2) }} MB</span>
                </div>
            </div>
        </div>

        <!-- Captioned Video Section -->
        <div v-if="output.status === 'COMPLETED' && output.hasVideo" class="mb-12">
            <div class="glass-card overflow-hidden rounded-3xl border-secondary/20 shadow-2xl shadow-secondary/5">
                <!-- Se já tem legendas, mostra o player -->
                <div v-if="output.hasCaptionedVideo">
                    <video 
                        controls 
                        class="w-full aspect-video bg-black"
                        :class="output.aspectRatio === '9:16' ? 'max-h-[70vh] object-contain' : ''"
                        :src="`/api/outputs/${outputId}/captioned-video`"
                    ></video>
                    <div class="p-4 bg-secondary/10 flex items-center justify-between text-[10px] mono-label text-secondary">
                        <span class="flex items-center gap-2">
                            <CheckCircle2 :size="12" /> VÍDEO COM LEGENDAS ESTILIZADAS
                        </span>
                        <div class="flex items-center gap-4">
                            <span>{{ output.outputMimeType }} • {{ (output.captionedVideoSize / 1024 / 1024).toFixed(2) }} MB</span>
                            <button
                                @click="reprocessCaptions"
                                :disabled="addingCaptions"
                                class="px-4 py-1.5 bg-secondary/20 border border-secondary/30 text-secondary rounded-lg hover:bg-secondary/30 hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                <span v-if="addingCaptions" class="animate-spin w-3 h-3 border-2 border-secondary/30 border-t-secondary rounded-full"></span>
                                <RefreshCw v-else :size="12" />
                                {{ addingCaptions ? 'PROCESSANDO...' : 'REPROCESSAR' }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Se não tem legendas, mostra botão para processar -->
                <div v-else class="p-8 bg-gradient-to-br from-secondary/5 to-transparent border-t border-secondary/10">
                    <div class="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 class="text-lg font-bold text-secondary flex items-center gap-2 mb-2">
                                <Subtitles :size="20" />
                                Legendas Automáticas
                            </h3>
                            <p class="text-zinc-400 text-sm max-w-xl">
                                Adicione legendas estilizadas ao seu vídeo com efeitos TikTok, Instagram Reels e YouTube. Sincronização automática com a narração das cenas.
                            </p>
                        </div>
                        
                        <button 
                            @click="addCaptions"
                            :disabled="addingCaptions"
                            class="px-8 py-4 bg-secondary text-black font-black uppercase tracking-widest rounded-xl hover:bg-secondary/90 hover:scale-105 transition-all shadow-glow-secondary flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <span v-if="addingCaptions" class="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full"></span>
                            <Subtitles v-else :size="20" />
                            {{ addingCaptions ? 'PROCESSANDO...' : 'INSERIR LEGENDA' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pipeline Progress (6 Stages) -->
        <div class="mb-12 grid grid-cols-6 gap-3 p-1 bg-white/5 rounded-2xl border border-white/5">
           <div class="pipeline-step" :class="getStepClass(output.scriptApproved, true)">
             <ScrollText :size="16" />
             <span class="text-[9px] font-black tracking-widest">Roteiro</span>
             <span v-if="getStepCost('script') > 0" class="text-[8px] font-mono text-amber-400/70">
               {{ formatCost(getStepCost('script')) }}
               <span v-if="isEstimatedCost('script')" class="text-amber-500/50" title="Custo estimado (tokens reais indisponíveis)">~</span>
             </span>
             <div v-if="output.scriptApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>
           
           <div class="pipeline-step" :class="getStepClass(output.imagesApproved, output.scriptApproved)">
             <ImageIcon :size="16" />
             <span class="text-[9px] font-black tracking-widest">Visual</span>
             <span v-if="getStepCost('image') > 0" class="text-[8px] font-mono text-amber-400/70">{{ formatCost(getStepCost('image')) }}</span>
             <div v-if="output.imagesApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" :class="getStepClass(output.audioApproved, output.imagesApproved)">
             <Mic :size="16" />
             <span class="text-[9px] font-black tracking-widest">Narração</span>
             <span v-if="getStepCost('narration') > 0" class="text-[8px] font-mono text-amber-400/70">{{ formatCost(getStepCost('narration')) }}</span>
             <div v-if="output.audioApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" :class="getStepClass(output.bgmApproved, output.audioApproved)">
             <Radio :size="16" />
             <span class="text-[9px] font-black tracking-widest">Música</span>
             <span v-if="getStepCost('bgm') > 0" class="text-[8px] font-mono text-amber-400/70">{{ formatCost(getStepCost('bgm')) }}</span>
             <div v-if="output.bgmApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" :class="getStepClass(output.videosApproved, output.bgmApproved)">
             <Clapperboard :size="16" />
             <span class="text-[9px] font-black tracking-widest">Motion</span>
             <span v-if="getStepCost('motion') > 0" class="text-[8px] font-mono text-amber-400/70">{{ formatCost(getStepCost('motion')) }}</span>
             <div v-if="output.videosApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" :class="getStepClass(output.status === 'COMPLETED', output.videosApproved)">
             <Film :size="16" />
             <span class="text-[9px] font-black tracking-widest">Render</span>
           </div>
        </div>

        <!-- Feedback Modal -->
        <div v-if="showScriptFeedbackModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div class="bg-zinc-900 border border-white/10 p-8 rounded-2xl max-w-lg w-full shadow-2xl space-y-6">
              <h3 class="text-xl font-bold flex items-center gap-2">
                 <RotateCw :size="20" class="text-secondary" />
                 Regenerar Roteiro
              </h3>
              <p class="text-sm text-zinc-400">
                 O que você gostaria de alterar nesta nova versão? O roteiro atual será substituído.
              </p>
              
              <textarea 
                 v-model="scriptFeedback"
                 class="w-full h-32 bg-black/50 border border-white/10 rounded-xl p-4 text-sm focus:border-secondary focus:outline-none resize-none"
                 placeholder="Ex: Focar mais no mistério, diminuir o tamanho das cenas, mudar o tom para algo mais sombrio..."
                 autofocus
              ></textarea>

              <div class="flex justify-end gap-3 pt-2">
                 <button @click="showScriptFeedbackModal = false" class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors">
                    CANCELAR
                 </button>
                 <button 
                    @click="confirmRegenerateScript"
                    :disabled="regeneratingScript || !scriptFeedback.trim()"
                    class="px-6 py-2 bg-secondary text-black font-bold text-xs rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                 >
                    <span v-if="regeneratingScript" class="animate-spin w-3 h-3 border-2 border-black/30 border-t-black rounded-full"></span>
                    CONFIRMAR REGENERAÇÃO
                 </button>
              </div>
           </div>
        </div>

        <!-- Script Generating Placeholder (Status: PENDING/PROCESSING & No Script) -->
        <div v-if="!output.script && output.status !== 'FAILED'" class="mb-12 bg-zinc-500/5 border border-zinc-500/20 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 text-center py-16 animate-pulse">
            <ScrollText :size="48" class="text-zinc-600 mb-2" />
            <h3 class="text-xl font-bold text-zinc-400">Gerando Roteiro...</h3>
            <p class="text-zinc-500 text-sm max-w-md">A IA está criando a narrativa baseada no tema do Dossier. Isso pode levar alguns segundos.</p>
        </div>

        <!-- Script Approval Section -->
        <div v-if="output.script && !output.scriptApproved" class="mb-12 bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/30 p-8 rounded-3xl relative overflow-hidden group">
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
                <div v-if="getStepCost('script') > 0" class="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-mono"
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
                   @click="showScriptFeedbackModal = true"
                   :disabled="approving || regeneratingScript"
                   class="px-6 py-4 bg-white/5 border border-white/10 text-zinc-300 font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 text-xs"
                 >
                   <RotateCw :size="16" />
                   Refazer
                 </button>
                 
                 <button 
                   @click="approveScript"
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

        <!-- 2. Image Approval Section -->
        <div v-if="output.scriptApproved && !output.imagesApproved" class="mb-12 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 p-8 rounded-3xl relative overflow-hidden group">
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
                    @click="approveImages"
                    :disabled="approving"
                    class="px-8 py-4 bg-purple-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-purple-400 hover:scale-105 transition-all shadow-glow-purple flex items-center gap-3 disabled:opacity-50"
                >
                    <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    <CheckCircle2 v-else :size="20" />
                    {{ approving ? 'Processando...' : 'APROVAR IMAGENS' }}
                </button>

                <button 
                    @click="generateImages"
                    :disabled="generatingStage === 'IMAGES' || (output.status === 'PROCESSING' && !output.imagesApproved)"
                    :class="allScenesHaveImages ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-purple-500/50' : 'px-8 py-4 bg-purple-500 text-white shadow-glow-purple hover:bg-purple-400 hover:scale-105'"
                    class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
                  >
                     <span v-if="generatingStage === 'IMAGES' || (output.status === 'PROCESSING' && !output.imagesApproved)" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                     <RotateCw v-else-if="allScenesHaveImages || output.scenes?.some((s:any) => s.images?.length > 0)" :size="16" />
                     <Zap v-else :size="20" />
                     {{ generatingStage === 'IMAGES' || (output.status === 'PROCESSING' && !output.imagesApproved) ? 'GERANDO...' : (allScenesHaveImages || output.scenes?.some((s:any) => s.images?.length > 0) ? 'REFAZER' : 'GERAR IMAGENS') }}
                </button>
              </div>
           </div>
        </div>

        <!-- 3. Narração Approval Section -->
        <div v-if="output.imagesApproved && !output.audioApproved" class="mb-12 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 p-8 rounded-3xl relative overflow-hidden group">
           <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 class="text-xl font-bold text-blue-200 flex items-center gap-2 mb-2">
                  <Mic :size="20" class="text-blue-500" />
                  Estágio 3: Narração (Áudio)
                </h3>
                <div v-if="allScenesHaveAudio">
                    <p class="text-blue-200/60 text-sm max-w-xl">
                        Narração gerada para todas as {{ output.scenes?.length }} cenas. Ouça abaixo e aprove.
                    </p>
                </div>
                <div v-else-if="output.scenes?.some((s:any) => s.audioTracks?.some((a:any) => a.type === 'scene_narration'))">
                    <p class="text-blue-200/60 text-sm max-w-xl animate-pulse">
                        Gerando narração... {{ output.scenes?.filter((s:any) => s.audioTracks?.some((a:any) => a.type === 'scene_narration')).length }}/{{ output.scenes?.length }} cenas prontas.
                    </p>
                </div>
                <div v-else>
                     <p class="text-blue-200/60 text-sm max-w-xl">
                        Imagens aprovadas. Agora gere a narração para cada cena.
                    </p>
                </div>
              </div>

               <!-- Action Buttons -->
              <div class="flex gap-3 flex-wrap">
                <button v-if="allScenesHaveAudio"
                    @click="approveAudio"
                    :disabled="approving"
                    class="px-8 py-4 bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-blue-400 hover:scale-105 transition-all shadow-glow-blue flex items-center gap-3 disabled:opacity-50"
                >
                    <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    <CheckCircle2 v-else :size="20" />
                    {{ approving ? 'Processando...' : 'APROVAR ÁUDIO' }}
                </button>

                <!-- Trocar Narrador -->
                <button
                    @click="showChangeVoiceModal = true"
                    :disabled="generatingStage === 'AUDIO' || changingVoice"
                    class="px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-amber-500/50 font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
                >
                    <span v-if="changingVoice" class="animate-spin w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full"></span>
                    <Mic v-else :size="16" class="text-amber-400" />
                    {{ changingVoice ? 'TROCANDO...' : 'TROCAR NARRADOR' }}
                </button>

                <button 
                    @click="generateAudio"
                    :disabled="generatingStage === 'AUDIO' || (output.status === 'PROCESSING' && !output.audioApproved)"
                    :class="allScenesHaveAudio ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-blue-500/50' : 'px-8 py-4 bg-blue-500 text-white shadow-glow-blue hover:bg-blue-400 hover:scale-105'"
                    class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
                  >
                     <span v-if="generatingStage === 'AUDIO' || (output.status === 'PROCESSING' && !output.audioApproved)" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                     <RotateCw v-else-if="allScenesHaveAudio || output.scenes?.some((s:any) => s.audioTracks?.some((a:any) => a.type === 'scene_narration'))" :size="16" />
                     <Zap v-else :size="20" />
                     {{ generatingStage === 'AUDIO' || (output.status === 'PROCESSING' && !output.audioApproved) ? 'GERANDO...' : (allScenesHaveAudio || output.scenes?.some((s:any) => s.audioTracks?.some((a:any) => a.type === 'scene_narration')) ? 'REFAZER' : 'GERAR ÁUDIO') }}
                </button>
              </div>
           </div>
        </div>

        <!-- 4. BGM Approval Section -->
        <div v-if="output.audioApproved && !output.bgmApproved" class="mb-12 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 p-8 rounded-3xl relative overflow-hidden group">
           <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 class="text-xl font-bold text-emerald-200 flex items-center gap-2 mb-2">
                  <Radio :size="20" class="text-emerald-500" />
                  Estágio 4: Background Music
                </h3>
                <div v-if="output.hasBgm">
                    <p class="text-emerald-200/60 text-sm max-w-xl mb-3">
                        Música de fundo gerada com duração baseada na narração real. Ouça abaixo e aprove para liberar o Motion.
                    </p>
                    <audio controls class="w-full max-w-md" :src="`/api/outputs/${outputId}/bgm-audio`"></audio>
                </div>
                <div v-else>
                     <p class="text-emerald-200/60 text-sm max-w-xl">
                        Narração aprovada. Agora gere a música de fundo (Stable Audio 2.5) com duração exata baseada no áudio da narração.
                    </p>
                    <p v-if="output.script?.backgroundMusicPrompt" class="text-emerald-300/40 text-xs mt-2 italic">
                      Prompt: "{{ output.script.backgroundMusicPrompt }}"
                    </p>
                </div>
              </div>

               <!-- Action Buttons -->
              <div class="flex gap-3">
                <button v-if="output.hasBgm"
                    @click="approveBgm"
                    :disabled="approving"
                    class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-glow-emerald flex items-center gap-3 disabled:opacity-50"
                >
                    <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    <CheckCircle2 v-else :size="20" />
                    {{ approving ? 'Processando...' : 'APROVAR MÚSICA' }}
                </button>

                <button 
                    @click="generateBgm"
                    :disabled="generatingStage === 'BGM'"
                    :class="output.hasBgm ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-emerald-500/50' : 'px-8 py-4 bg-emerald-500 text-white shadow-glow-emerald hover:bg-emerald-400 hover:scale-105'"
                    class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
                  >
                     <span v-if="generatingStage === 'BGM'" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                     <RotateCw v-else-if="output.hasBgm" :size="16" />
                     <Zap v-else :size="20" />
                     {{ generatingStage === 'BGM' ? 'GERANDO...' : (output.hasBgm ? 'REFAZER' : 'GERAR MÚSICA') }}
                </button>
              </div>
           </div>
        </div>

        <!-- 5. Motion Approval Section -->
        <div v-if="output.bgmApproved && output.enableMotion && !output.videosApproved" class="mb-12 bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/30 p-8 rounded-3xl relative overflow-hidden group">
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
                    @click="approveMotion"
                    :disabled="approving"
                    class="px-8 py-4 bg-pink-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-pink-400 hover:scale-105 transition-all shadow-glow-pink flex items-center gap-3 disabled:opacity-50"
                >
                    <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    <CheckCircle2 v-else :size="20" />
                    {{ approving ? 'Processando...' : 'APROVAR MOTION' }}
                </button>

                <button 
                    @click="generateMotion"
                    :disabled="generatingStage === 'MOTION' || (output.status === 'PROCESSING' && !output.videosApproved)"
                    :class="allScenesHaveVideos ? 'px-6 py-4 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-pink-500/50' : 'px-8 py-4 bg-pink-500 text-white shadow-glow-pink hover:bg-pink-400 hover:scale-105'"
                    class="font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none text-sm"
                  >
                     <span v-if="generatingStage === 'MOTION' || (output.status === 'PROCESSING' && !output.videosApproved)" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                     <RotateCw v-else-if="allScenesHaveVideos || output.scenes?.some((s:any) => s.videos?.length > 0)" :size="16" />
                     <Zap v-else :size="20" />
                     {{ generatingStage === 'MOTION' || (output.status === 'PROCESSING' && !output.videosApproved) ? 'GERANDO...' : (allScenesHaveVideos || output.scenes?.some((s:any) => s.videos?.length > 0) ? 'REFAZER' : 'GERAR MOTION') }}
                </button>
              </div>
           </div>
        </div>

        <!-- 5. Render Trigger (Final) -->
        <div v-if="canRenderMaster" class="mb-12 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 p-8 rounded-3xl relative overflow-hidden group">
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
               <button 
                  @click="renderMaster"
                  :disabled="rendering || output.status === 'GENERATING'"
                  class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-glow-emerald flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span v-if="rendering || output.status === 'GENERATING'" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                  <Zap v-else :size="20" />
                  {{ rendering || output.status === 'GENERATING' ? 'RENDERIZANDO...' : 'RENDERIZAR MASTER' }}
                </button>
             </div>
        </div>

        <!-- Script Viewer -->
        <main class="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
          
          <!-- Metadata Sidebar -->
          <aside class="space-y-6">
             <section class="glass-card p-6 rounded-2xl border-white/5">
                <h3 class="mono-label mb-4 text-zinc-500">Summary</h3>
                <p class="text-sm leading-relaxed text-zinc-300 italic">
                  {{ output.script?.summary || output.dossier?.theme }}
                </p>
             </section>

             <section class="glass-card p-6 rounded-2xl border-white/5 space-y-4">
               <div>
                 <h3 class="mono-label mb-1 text-zinc-500">Duration</h3>
                 <p class="text-xl font-mono">{{ output.script?.estimatedDuration || output.duration }}s</p>
               </div>
               <div>
                  <h3 class="mono-label mb-1 text-zinc-500">Word Count</h3>
                  <p class="text-xl font-mono">{{ output.script?.wordCount }} words</p>
               </div>
               <div>
                 <h3 class="mono-label mb-1 text-zinc-500">Scene Count</h3>
                 <p class="text-xl font-mono">{{ output.scenes?.length || 0 }} scenes</p>
               </div>
               <div class="pt-4 border-t border-white/5">
                 <h3 class="mono-label mb-2 text-zinc-500">Styles</h3>
                 <div class="flex flex-wrap gap-2">
                   <span class="px-2 py-1 bg-white/5 rounded text-[9px]">{{ output.scriptStyle?.name }}</span>
                   <span class="px-2 py-1 bg-white/5 rounded text-[9px]">{{ output.visualStyle?.name }}</span>
                 </div>
               </div>
             </section>

             <!-- Background Music (Video Todo ou Tracks) -->
             <section v-if="output.script?.backgroundMusicPrompt || output.script?.backgroundMusicTracks?.length" class="glass-card p-6 rounded-2xl border-emerald-500/10 bg-emerald-500/5">
               <h3 class="flex items-center gap-2 mono-label mb-4 text-emerald-400">
                 <Radio :size="14" /> Background Music
               </h3>
               
               <!-- Música única (TikTok/Instagram - "video todo") -->
               <div v-if="output.script?.backgroundMusicPrompt" class="space-y-3">
                 <div class="flex items-center gap-2">
                   <span class="text-[9px] px-2 py-1 bg-emerald-500/20 rounded text-emerald-300 font-mono uppercase tracking-widest">Video Todo</span>
                   <span class="text-[9px] px-2 py-1 bg-emerald-500/10 rounded text-emerald-400/60 font-mono">{{ output.script.backgroundMusicVolume || -18 }}dB</span>
                 </div>
                 <p class="text-sm text-emerald-200/80 leading-relaxed italic">
                   {{ output.script.backgroundMusicPrompt }}
                 </p>
               </div>

               <!-- Lista de tracks com timestamps (YouTube Cinematic) -->
               <div v-else-if="output.script?.backgroundMusicTracks?.length" class="space-y-3">
                 <div v-for="(track, idx) in output.script.backgroundMusicTracks" :key="idx" class="bg-black/20 p-3 rounded-xl border border-emerald-500/10">
                   <div class="flex items-center gap-2 mb-2">
                     <span class="text-[9px] px-2 py-1 bg-emerald-500/20 rounded text-emerald-300 font-mono">
                       {{ track.startTime }}s → {{ track.endTime ? track.endTime + 's' : 'Fim' }}
                     </span>
                     <span class="text-[9px] px-2 py-1 bg-emerald-500/10 rounded text-emerald-400/60 font-mono">{{ track.volume }}dB</span>
                   </div>
                   <p class="text-xs text-emerald-200/60 leading-relaxed">
                     {{ track.prompt }}
                   </p>
                 </div>
               </div>
             </section>
          </aside>

          <!-- Scenes Grid -->
          <section class="lg:col-span-2 space-y-6">
             <div v-for="scene in output.scenes" :key="scene.id" class="glass-card p-6 rounded-2xl border-white/5 group hover:border-primary/20 transition-all">
                <div class="flex justify-between items-start mb-4">
                   <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-mono font-bold text-zinc-400 group-hover:bg-primary group-hover:text-black transition-colors">
                        {{ scene.order + 1 }}
                      </div>
                      <span class="mono-label text-zinc-500">{{ scene.estimatedDuration }}s</span>
                   </div>
                   <div class="flex items-center gap-2">
                     <button 
                        @click="regenerateImage(scene)"
                        :disabled="!!regeneratingSceneId"
                        class="text-zinc-600 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                        title="Regenerar Imagem"
                      >
                       <span v-if="regeneratingSceneId === scene.id" class="animate-spin block">
                          <RotateCw :size="14" />
                       </span>
                       <RotateCw v-else :size="14" />
                     </button>
                     <button class="text-zinc-600 hover:text-white transition-colors p-1 rounded hover:bg-white/10">
                       <Edit :size="14" />
                     </button>
                   </div>
                 </div>

                <div class="grid md:grid-cols-2 gap-6">
                   <!-- Narration -->
                   <div class="bg-black/20 p-4 rounded-xl border border-white/5">
                      <div class="flex justify-between items-center mb-2">
                        <h4 class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                          <Mic :size="10" /> Narration ({{ output.narrationLanguage || 'PT-BR' }})
                        </h4>
                        <!-- Audio Status Badge -->
                        <span v-if="output.status === 'PROCESSING' && !output.audioTracks?.some((a: any) => a.type === 'narration')" class="text-[8px] text-orange-400 animate-pulse">Gerando Áudio...</span>
                      </div>
                      
                      <p class="text-lg font-serif text-white/90 leading-relaxed mb-4">
                        "{{ scene.narration }}"
                      </p>

                      <!-- Mini Player (Áudio da Cena) -->
                      <div v-if="scene.audioTracks?.some((a: any) => a.type === 'scene_narration')" class="mt-4 pt-4 border-t border-white/5">
                         <audio 
                           controls 
                           class="w-full h-8 opacity-50 hover:opacity-100 transition-opacity"
                           :src="`/api/scenes/${scene.id}/audio`"
                         >
                           Seu navegador não suporta áudio.
                         </audio>
                      </div>
                   </div>
                   
                   <!-- Visual -->
                   <div class="space-y-4">
                      <div class="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                        <h4 class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-400/70 mb-2">
                          <Eye :size="10" /> Visual Prompt
                        </h4>
                        <p class="text-sm text-blue-100/80 leading-relaxed font-light">
                          {{ scene.visualDescription }}
                        </p>
                      </div>

                      <div v-if="scene.audioDescription" class="bg-purple-500/5 p-3 rounded-xl border border-purple-500/10">
                        <h4 class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-purple-400/70 mb-2">
                          <Music :size="10" /> Audio SFX
                        </h4>
                        <p class="text-xs text-purple-200/60 leading-relaxed">
                          {{ scene.audioDescription }}
                        </p>
                      </div>
                   </div>
                </div>

                <!-- 🎥 Video/Motion Preview -->
                <div v-if="output.enableMotion && (output.videosApproved || output.scenes?.some((s:any) => s.videos?.length))" class="mt-4 pt-4 border-t border-white/5">
                    <h4 class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-pink-500/70 mb-2">
                        <Clapperboard :size="10" /> Motion Preview
                    </h4>
                    
                    <div v-if="scene.videos?.length > 0" class="aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative group/video">
                        <!-- Só mostramos o primeiro vídeo por enquanto -->
                        <video 
                        controls
                        loop
                        class="w-full h-full object-cover"
                        :src="`/api/scene-videos/${scene.videos[0].id}/stream`"
                        ></video>
                        
                        <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[8px] text-white/80 font-mono pointer-events-none">
                        {{ scene.videos[0].provider }} • {{ scene.videos[0].duration }}s
                        </div>
                    </div>
                    <div v-else class="h-24 bg-pink-500/5 rounded-lg flex flex-col items-center justify-center gap-2 border border-dashed border-pink-500/20 text-pink-500/50">
                        <Clapperboard :size="16" class="animate-pulse" />
                        <span class="text-[9px] uppercase tracking-wider">{{ output.audioApproved ? 'Aguardando Motion...' : 'Pendente de Áudio' }}</span>
                    </div>
                </div>
                
                <!-- Image Generation Preview (Future Expansion) -->
                <div v-if="output.imagesApproved || output.scriptApproved" class="mt-6 pt-6 border-t border-white/5">
                   <div v-if="scene.images?.length > 0" class="flex gap-4 overflow-x-auto pb-2">
                      <div 
                        v-for="img in scene.images" 
                        :key="img.id" 
                        class="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden relative group/img cursor-pointer border border-white/10 hover:border-primary/50 transition-all"
                        @click="openImage(img.id)"
                      >
                        <img 
                          :src="`/api/scene-images/${img.id}`" 
                          class="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110"
                          loading="lazy"
                          alt="Generated Scene Image"
                        />
                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                           <Eye :size="16" class="text-white drop-shadow-lg" />
                        </div>
                      </div>
                   </div>
                   <div v-else class="h-12 bg-white/5 rounded-lg flex items-center justify-center text-[10px] text-zinc-500 uppercase tracking-widest border border-dashed border-white/5">
                      {{ output.scriptApproved ? 'Aguardando Geração Image...' : 'Imagens Pendentes' }}
                   </div>
                </div>

             </div>
          </section>

        </main>
      </template>

      <!-- Erro -->
      <div v-else class="text-center py-32">
        <h2 class="text-2xl font-bold text-red-500 mb-2">Erro</h2>
        <p class="text-zinc-500">Não foi possível carregar os dados do output.</p>
        <NuxtLink to="/" class="btn-secondary mt-8 inline-flex">Voltar Home</NuxtLink>
      </div>

      <div v-if="selectedImage" class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-8 animate-in fade-in duration-200" @click="selectedImage = null">
        <button class="absolute top-8 right-8 text-white/50 hover:text-white transition-colors z-[100]" @click.stop="selectedImage = null">
          <X :size="32" />
        </button>
        <img 
          :src="`/api/scene-images/${selectedImage}`" 
          class="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
          @click.stop
        />
      </div>

    </div>
  </div>

  <!-- Pricing Not Configured Modal -->
  <div 
    v-if="pricingError"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="pricingError = null"
  >
    <div class="bg-zinc-900 border border-red-500/30 p-8 rounded-2xl max-w-lg w-full shadow-2xl space-y-6">
      <div class="flex items-center gap-3">
        <div class="p-3 bg-red-500/10 rounded-xl">
          <AlertTriangle :size="28" class="text-red-400" />
        </div>
        <div>
          <h3 class="text-xl font-bold text-red-300">Modelo sem Preço Configurado</h3>
          <p class="text-zinc-500 text-sm">A execução foi bloqueada para proteger seu orçamento</p>
        </div>
      </div>

      <div class="bg-black/40 border border-white/10 rounded-xl p-5 space-y-3">
        <div>
          <span class="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Modelo</span>
          <p class="text-white font-mono text-sm mt-1">{{ pricingError.model }}</p>
        </div>
        <div>
          <span class="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Provider</span>
          <p class="text-white font-mono text-sm mt-1">{{ pricingError.provider }}</p>
        </div>
      </div>

      <div class="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
        <h4 class="text-amber-300 font-bold text-sm mb-3 flex items-center gap-2">
          <DollarSign :size="16" />
          O que fazer:
        </h4>
        <ol class="text-zinc-400 text-sm space-y-2 list-decimal list-inside">
          <li>Acesse a página do modelo no Replicate para verificar o tipo de cobrança (por output ou por tempo de GPU)</li>
          <li>Atualize o mapa de preços em <code class="text-amber-300/80 bg-black/40 px-1.5 py-0.5 rounded text-xs">server/constants/pricing.ts</code></li>
          <li>Reinicie o servidor e tente novamente</li>
        </ol>
      </div>

      <div class="flex items-center justify-between pt-2">
        <a 
          :href="pricingError.configUrl" 
          target="_blank"
          class="px-6 py-3 bg-white/5 border border-white/10 text-zinc-300 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-bold"
        >
          <Eye :size="16" />
          Ver Modelo no Replicate
        </a>
        <button 
          @click="pricingError = null"
          class="px-6 py-3 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl hover:bg-red-500/30 transition-all text-sm font-bold"
        >
          Entendi
        </button>
      </div>
    </div>
  </div>

  <!-- Change Voice Modal -->
  <div
    v-if="showChangeVoiceModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="showChangeVoiceModal = false"
  >
    <div class="glass-card max-w-lg w-full p-8 rounded-3xl border-amber-500/20 shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-black text-white flex items-center gap-3">
            <Mic :size="28" class="text-amber-400" />
            Trocar Narrador
          </h2>
          <p class="text-zinc-400 text-sm mt-2">
            Escolha uma nova voz. Toda a narração será regenerada.
          </p>
          <p v-if="output.voiceId" class="text-zinc-500 text-xs mt-1 font-mono">
            Voz atual: {{ output.voiceId }}
          </p>
        </div>
        <button
          @click="showChangeVoiceModal = false"
          class="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X :size="24" />
        </button>
      </div>

      <!-- Voice Selector -->
      <div class="mb-6">
        <VoiceSelector
          v-model="newVoiceId"
          label="Nova Voz do Narrador"
        />
      </div>

      <!-- Warning -->
      <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
        <p class="text-amber-200/80 text-sm flex items-start gap-2">
          <AlertTriangle :size="16" class="text-amber-400 shrink-0 mt-0.5" />
          <span>
            Essa ação vai <strong>deletar</strong> todos os áudios de narração atuais e gerar novos com a voz selecionada. O script e as imagens serão mantidos.
          </span>
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-4 border-t border-white/10">
        <button
          @click="showChangeVoiceModal = false"
          class="px-6 py-3 text-zinc-400 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          @click="confirmChangeVoice"
          :disabled="!newVoiceId || newVoiceId === output.voiceId"
          class="px-8 py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Mic :size="20" />
          Trocar e Regenerar
        </button>
      </div>
    </div>
  </div>

  <!-- Caption Style Selection Modal -->
  <div 
    v-if="showCaptionStyleModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="showCaptionStyleModal = false"
  >
    <div class="glass-card max-w-4xl w-full p-8 rounded-3xl border-secondary/20 shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-black text-white flex items-center gap-3">
            <Subtitles :size="28" class="text-secondary" />
            Escolha o Estilo de Legenda
          </h2>
          <p class="text-zinc-400 text-sm mt-2">
            Selecione o estilo ideal para sua plataforma
          </p>
        </div>
        <button 
          @click="showCaptionStyleModal = false"
          class="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X :size="24" />
        </button>
      </div>

      <!-- Styles Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div
          v-for="style in captionStyles"
          :key="style.id"
          @click="selectedStyleId = style.id"
          class="relative p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105"
          :class="[
            selectedStyleId === style.id 
              ? 'border-secondary bg-secondary/10' 
              : 'border-white/10 bg-white/5 hover:border-white/20'
          ]"
        >
          <!-- Recommended Badge -->
          <div 
            v-if="style.isRecommended"
            class="absolute -top-2 -right-2 px-3 py-1 bg-secondary text-black text-[10px] font-black uppercase tracking-wider rounded-full shadow-glow-secondary"
          >
            Recomendado
          </div>

          <!-- Style Info -->
          <div class="flex items-start gap-3 mb-3">
            <div 
              class="p-2 rounded-lg"
              :class="selectedStyleId === style.id ? 'bg-secondary/20' : 'bg-white/10'"
            >
              <Subtitles :size="20" :class="selectedStyleId === style.id ? 'text-secondary' : 'text-white'" />
            </div>
            <div class="flex-1">
              <h3 class="font-bold text-white">{{ style.name }}</h3>
              <p class="text-xs text-zinc-500 uppercase tracking-wide">{{ style.platform }}</p>
            </div>
          </div>

          <p class="text-sm text-zinc-400 leading-relaxed">
            {{ style.description }}
          </p>

          <!-- Effect Badge -->
          <div v-if="style.effect && style.effect !== 'none'" class="mt-3">
            <span class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full" :class="{
              'bg-yellow-500/20 text-yellow-400': style.effect === 'word_highlight',
              'bg-green-500/20 text-green-400': style.effect === 'karaoke_fill',
              'bg-blue-500/20 text-blue-400': style.effect === 'fade',
              'bg-purple-500/20 text-purple-400': style.effect === 'pop_in',
              'bg-cyan-500/20 text-cyan-400': style.effect === 'glow_pulse',
              'bg-pink-500/20 text-pink-400': style.effect === 'neon_flicker',
            }">
              {{ style.effect?.replace(/_/g, ' ') }}
            </span>
          </div>

          <!-- Selected Indicator -->
          <div 
            v-if="selectedStyleId === style.id"
            class="absolute bottom-4 right-4"
          >
            <CheckCircle2 :size="20" class="text-secondary" />
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-6 border-t border-white/10">
        <button
          @click="showCaptionStyleModal = false"
          class="px-6 py-3 text-zinc-400 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          @click="confirmAddCaptions"
          :disabled="!selectedStyleId"
          class="px-8 py-4 bg-secondary text-black font-black uppercase tracking-widest rounded-xl hover:bg-secondary/90 hover:scale-105 transition-all shadow-glow-secondary flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Zap :size="20" />
          Processar Legendas
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  ArrowLeft, Download, RotateCw, ScrollText, ImageIcon, Mic, Film, CheckCircle2, 
  AlertTriangle, Edit, Eye, Music, X, Zap, Clapperboard, Subtitles, Radio, DollarSign, RefreshCw
} from 'lucide-vue-next'
import VoiceSelector from '~/components/dossier/VoiceSelector.vue'

const route = useRoute()
const router = useRouter()
const outputId = route.params.id as string

const output = ref<any>(null)
const loading = ref(true)
const approving = ref(false)
const addingCaptions = ref(false)
const isReprocessing = ref(false)

// Change Voice
const showChangeVoiceModal = ref(false)
const newVoiceId = ref<string | null>(null)
const changingVoice = ref(false)

// Pricing Error Modal
const pricingError = ref<{ model: string; provider: string; configUrl: string } | null>(null)

function handleApiError(error: any, fallbackMessage: string) {
  const data = error?.data?.data || error?.data
  if (data?.code === 'PRICING_NOT_CONFIGURED') {
    pricingError.value = {
      model: data.model,
      provider: data.provider,
      configUrl: data.configUrl
    }
    return
  }
  alert(fallbackMessage)
}

// Cost Tracking
const costs = ref<any>(null)

async function loadCosts() {
  try {
    costs.value = await $fetch(`/api/outputs/${outputId}/costs`)
  } catch (e) {
    // Silencioso - custos são informativos
  }
}

function formatCost(value: number): string {
  if (!value || value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

function getStepCost(resource: string): number {
  if (!costs.value?.breakdown) return 0
  return costs.value.breakdown[resource] || 0
}

function isEstimatedCost(resource: string): boolean {
  if (!costs.value?.costAccuracy) return false
  return costs.value.costAccuracy[resource] === 'estimated'
}

// Caption Styles Modal
const showCaptionStyleModal = ref(false)
const captionStyles = ref<any[]>([])
const selectedStyleId = ref<string | null>(null)
const recommendedStyleId = ref<string | null>(null)

async function loadOutput() {
  try {
    const data = await $fetch(`/api/outputs/${outputId}`)
    output.value = data
  } catch (error) {
    console.error('Erro ao carregar output:', error)
  } finally {
    loading.value = false
  }
}

const regeneratingSceneId = ref<string | null>(null)

// Regenerate Script Logic
const showScriptFeedbackModal = ref(false)
const scriptFeedback = ref('')
const regeneratingScript = ref(false)

async function confirmRegenerateScript() {
  if (!scriptFeedback.value.trim()) return
  
  regeneratingScript.value = true
  try {
    await $fetch(`/api/outputs/${outputId}/regenerate-script`, {
      method: 'POST',
      body: { feedback: scriptFeedback.value }
    })
    
    // Resetar e recarregar
    showScriptFeedbackModal.value = false
    scriptFeedback.value = ''
    window.location.reload()
  } catch (error) {
    console.error('Erro regenerando roteiro:', error)
    alert('Erro ao regenerar roteiro. Tente novamente.')
  } finally {
    regeneratingScript.value = false
  }
}

async function regenerateImage(scene: any) {
  if (regeneratingSceneId.value) return
  regeneratingSceneId.value = scene.id

  try {
    // 1. Chamar endpoint (usando prompt atual)
    const newImage = await $fetch(`/api/scenes/${scene.id}/regenerate-image`, {
      method: 'POST',
      body: { prompt: scene.visualDescription } // Poderia vir de um input editável
    })

    // 2. Atualizar lista de imagens da cena localmente
    // Adiciona ao início ou fim? Vamos dar unshift para aparecer primeiro
    if (!scene.images) scene.images = []
    scene.images.unshift(newImage)
    
  } catch (error) {
    console.error('Erro regenerando imagem:', error)
    alert('Erro ao regenerar imagem.')
  } finally {
    regeneratingSceneId.value = null
  }
}

const rendering = ref(false)
async function downloadMaster() {
  // Agora baixamos diretamente do endpoint que lê do banco
  const downloadUrl = `/api/outputs/${outputId}/download`
  const fileName = `${output.value.title || 'video'}.mp4`

  const link = document.createElement('a')
  link.href = downloadUrl
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}


async function renderAgain() {
  if (rendering.value) return
  if (!confirm('Deseja iniciar uma nova renderização? O arquivo MP4 atual será substituído pelo novo.')) return

  rendering.value = true
  try {
    const res = await $fetch(`/api/outputs/${outputId}/render`, {
      method: 'POST'
    })
    
    // Atualizar status local e iniciar polling
    output.value.status = 'GENERATING'
    startPolling()
    
    // Feedback opcional ou log
    console.log('API Response:', res)
  } catch (error) {
    console.error('Erro ao disparar renderização:', error)
    alert('Erro ao iniciar a renderização. Verifique o console.')
  } finally {
    rendering.value = false
  }
}

// Caption Functions
async function addCaptions() {
  try {
    // 1. Buscar estilos disponíveis
    const stylesData = await $fetch(`/api/outputs/${outputId}/caption-styles`)
    captionStyles.value = stylesData.styles
    recommendedStyleId.value = stylesData.recommendedStyleId
    selectedStyleId.value = stylesData.recommendedStyleId // Pré-seleciona o recomendado
    
    // 2. Abrir modal
    showCaptionStyleModal.value = true
  } catch (error) {
    console.error('Erro ao carregar estilos:', error)
    alert('Erro ao carregar estilos de legendas')
  }
}

async function confirmAddCaptions() {
  if (!selectedStyleId.value) return
  
  showCaptionStyleModal.value = false
  addingCaptions.value = true
  
  try {
    const result = await $fetch(`/api/outputs/${outputId}/add-captions`, {
      method: 'POST',
      body: {
        styleId: selectedStyleId.value,
        force: isReprocessing.value
      }
    })

    console.log('Legendas adicionadas:', result)
    
    // Recarregar output para mostrar vídeo legendado
    await loadOutput()
    
    alert(`Legendas ${isReprocessing.value ? 'reprocessadas' : 'adicionadas'} com sucesso! Tamanho: ${result.sizeInMB} MB`)
  } catch (error: any) {
    console.error('Erro ao adicionar legendas:', error)
    alert(`Erro ao adicionar legendas: ${error.data?.message || error.message || 'Erro desconhecido'}`)
  } finally {
    addingCaptions.value = false
    isReprocessing.value = false
  }
}

async function reprocessCaptions() {
  isReprocessing.value = true
  await addCaptions()
}


async function revertToScriptStep() {
  if (!confirm('Tem certeza? Isso permitirá editar o roteiro novamente. As imagens geradas serão mantidas, mas novas alterações no roteiro podem exigir novas imagens.')) return

  try {
    await $fetch(`/api/outputs/${outputId}`, {
      method: 'PATCH',
      body: {
        scriptApproved: false,
        imagesApproved: false, // Resetar aprovação de imagens também
        status: 'PENDING_REVIEW' // Novo status customizado ou mapeado no back
      }
    })
    
    // Atualizar estado local
    output.value.scriptApproved = false
    output.value.imagesApproved = false
    // loadOutput() // Reload full
    window.location.reload() // Full refresh mais seguro para resetar estado
  } catch (e) {
    alert('Erro ao reverter etapa')
  }
}

async function revertToImagesStep() {
  if (!confirm('Voltar para revisão de imagens? Isso cancelará a aprovação atual das imagens.')) return

  try {
    await $fetch(`/api/outputs/${outputId}`, {
      method: 'PATCH',
      body: {
        imagesApproved: false,
        videosApproved: false,
        status: 'PROCESSING'
      }
    })
    
    // Atualizar estado local
    output.value.imagesApproved = false
    output.value.videosApproved = false
    window.location.reload()
  } catch (e) {
    alert('Erro ao reverter etapa')
  }
}

async function approveScript() {
  if (approving.value) return
  approving.value = true

  try {
    // Usar novo endpoint específico
    await $fetch(`/api/outputs/${outputId}/approve-stage`, {
      method: 'PATCH',
      body: { stage: 'SCRIPT', approved: true }
    })
    
    output.value.scriptApproved = true
    
    // Recarregar para habilitar próximo passo
    await loadOutput()
  } catch (error) {
    console.error('Erro ao aprovar roteiro:', error)
    alert('Erro ao aprovar roteiro.')
  } finally {
    approving.value = false
  }
}

const generatingStage = ref<string | null>(null)

async function generateImages() {
   generatingStage.value = 'IMAGES'
   try {
     await $fetch(`/api/outputs/${outputId}/generate-images`, { method: 'POST' })
     startPolling()
   } catch (e: any) {
     generatingStage.value = null
     handleApiError(e, 'Erro ao iniciar geração de imagens')
   }
}

async function approveImages() {
  if (approving.value) return
  approving.value = true

  try {
    await $fetch(`/api/outputs/${outputId}/approve-stage`, {
      method: 'PATCH',
      body: { stage: 'IMAGES', approved: true }
    })
    
    output.value.imagesApproved = true
    await loadOutput()
  } catch (error) {
    console.error('Erro ao aprovar imagens:', error)
    alert('Erro ao aprovar imagens.')
  } finally {
    approving.value = false
  }
}

async function generateBgm() {
   generatingStage.value = 'BGM'
   try {
     await $fetch(`/api/outputs/${outputId}/generate-background-music`, { method: 'POST' })
     startPolling()
   } catch (e: any) {
     generatingStage.value = null
     handleApiError(e, 'Erro ao iniciar geração de música')
   }
}

async function approveBgm() {
  if (approving.value) return
  approving.value = true

  try {
    await $fetch(`/api/outputs/${outputId}/approve-stage`, {
      method: 'PATCH',
      body: { stage: 'BGM', approved: true }
    })
    
    output.value.bgmApproved = true
    await loadOutput()
  } catch (error) {
    alert('Erro ao aprovar música.')
  } finally {
    approving.value = false
  }
}

async function generateAudio() {
   generatingStage.value = 'AUDIO'
   try {
     await $fetch(`/api/outputs/${outputId}/generate-audio`, { method: 'POST' })
     startPolling()
   } catch (e: any) {
     generatingStage.value = null
     handleApiError(e, 'Erro ao iniciar geração de áudio')
   }
}

async function approveAudio() {
  if (approving.value) return
  approving.value = true

  try {
    await $fetch(`/api/outputs/${outputId}/approve-stage`, {
      method: 'PATCH',
      body: { stage: 'AUDIO', approved: true }
    })
    
    output.value.audioApproved = true
    await loadOutput()
  } catch (error) {
    alert('Erro ao aprovar áudio.')
  } finally {
    approving.value = false
  }
}

async function confirmChangeVoice() {
  if (!newVoiceId.value || newVoiceId.value === output.value.voiceId) return

  showChangeVoiceModal.value = false
  changingVoice.value = true
  generatingStage.value = 'AUDIO'

  try {
    const result = await $fetch(`/api/outputs/${outputId}/change-voice`, {
      method: 'POST',
      body: { voiceId: newVoiceId.value }
    })

    console.log('Troca de voz iniciada:', result)

    // Atualizar voiceId local
    output.value.voiceId = newVoiceId.value

    // Iniciar polling para acompanhar geração
    startPolling()
  } catch (error: any) {
    generatingStage.value = null
    const msg = error?.data?.message || error?.message || 'Erro desconhecido'
    alert(`Erro ao trocar narrador: ${msg}`)
  } finally {
    changingVoice.value = false
    newVoiceId.value = null
  }
}

async function generateMotion() {
   generatingStage.value = 'MOTION'
   try {
     await $fetch(`/api/outputs/${outputId}/generate-motion`, { method: 'POST' })
     startPolling()
   } catch (e: any) {
     generatingStage.value = null
     handleApiError(e, 'Erro ao iniciar geração de motion')
   }
}

async function approveMotion() {
  if (approving.value) return
  approving.value = true

  try {
    await $fetch(`/api/outputs/${outputId}/approve-stage`, {
      method: 'PATCH',
      body: { stage: 'MOTION', approved: true }
    })
    
    output.value.videosApproved = true
    await loadOutput()
  } catch (error) {
    alert('Erro ao aprovar motion.')
  } finally {
    approving.value = false
  }
}

async function renderMaster() {
  if (rendering.value) return
  rendering.value = true
  try {
    await $fetch(`/api/outputs/${outputId}/render`, { method: 'POST' })
    output.value.status = 'GENERATING'
    startPolling()
  } catch (error) {
    alert('Erro ao iniciar renderização.')
  } finally {
    rendering.value = false
  }
}

// Helpers para verificar se TODAS as cenas têm os assets necessários
const allScenesHaveImages = computed(() => {
    if (!output.value?.scenes?.length) return false
    return output.value.scenes.every((s: any) => s.images?.length > 0)
})

const allScenesHaveAudio = computed(() => {
    if (!output.value?.scenes?.length) return false
    return output.value.scenes.every((s: any) => s.audioTracks?.some((a: any) => a.type === 'scene_narration'))
})

const allScenesHaveVideos = computed(() => {
    if (!output.value?.scenes?.length) return false
    return output.value.scenes.every((s: any) => s.videos?.length > 0)
})

// Helper para Render Button visibility
const canRenderMaster = computed(() => {
    if (!output.value) return false
    const base = output.value.scriptApproved && output.value.imagesApproved && output.value.bgmApproved && output.value.audioApproved
    if (output.value.enableMotion) {
        return base && output.value.videosApproved
    }
    return base
})

function getStepClass(isCompleted: boolean, isPreviousCompleted: boolean) {
  if (isCompleted) return 'completed cursor-pointer hover:bg-white/5'
  if (isPreviousCompleted) return 'active'
  return 'pending'
}

function getStatusClass(status: string) {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    case 'FAILED': return 'bg-red-500/10 text-red-400 border-red-500/30'
    case 'PROCESSING': return 'bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse'
    case 'PENDING': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
    case 'GENERATING': return 'bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse'
    default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
  }
}

let pollTimer: any = null
function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    // Poll se estiver processando imagens, audio, motion ou renderização final
    if (output.value && (output.value.status === 'PROCESSING' || output.value.status === 'PENDING' || output.value.status === 'GENERATING')) {
       // Silent reload
       try {
         const data = await $fetch(`/api/outputs/${outputId}`)
         output.value = data
         loadCosts()
       } catch (e) {}
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
}

onMounted(() => {
  loadOutput()
  loadCosts()
  startPolling()
})
onUnmounted(() => stopPolling())

const selectedImage = ref<string | null>(null)
function openImage(id: string) {
  selectedImage.value = id
}
</script>

<style scoped>
.glass-card {
  @apply bg-black/40 backdrop-blur-xl border border-white/5;
}

.pipeline-step {
  @apply h-full p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden bg-black/20 border border-white/5 text-zinc-600;
}

.pipeline-step.active {
  @apply bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)];
}

.pipeline-step.completed {
  @apply bg-emerald-500/5 border-emerald-500/20 text-emerald-400;
}

.pipeline-step.pending {
  @apply opacity-50;
}

.shadow-glow-orange {
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.2);
}
</style>
