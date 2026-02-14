<template>
  <div class="min-h-screen bg-[#0A0A0A] font-sans selection:bg-primary/30 text-white relative overflow-hidden">
    <!-- Background FX -->
    <div class="fixed inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-20 animate-pulse-slow"></div>
      <div class="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] opacity-20"></div>
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 container mx-auto px-6 py-12 max-w-7xl">
      <!-- Breadcrumb / Back -->
      <NuxtLink 
        v-if="output?.dossierId"
        :to="`/dossiers/${output.dossierId}`" 
        class="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 mono-label"
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
              <span class="px-2 py-1 bg-white/10 rounded text-xs font-black tracking-widest uppercase text-white/70">
                {{ output.outputType }}
              </span>
              <span v-if="output.status" :class="getStatusClass(output.status)" class="px-2 py-1 rounded text-xs font-black tracking-widest uppercase border">
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
              <span class="text-amber-400/50 text-xs uppercase tracking-widest">gasto neste output</span>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="flex gap-4 flex-wrap">
             <button v-if="output.status === 'COMPLETED'" @click="downloadMaster" class="btn-primary flex items-center gap-2">
               <Download :size="16" />
               BAIXAR MASTER
             </button>
             <button v-else-if="output.status === 'FAILED'" class="btn-secondary text-red-400 border-red-500/30 flex items-center gap-2">
               <RotateCw :size="16" />
               RETRY
             </button>

             <!-- BOTAO MODO CORREÇÃO -->
             <button 
                v-if="output.status === 'COMPLETED' && !correctionMode"
                @click="enterCorrectionMode"
                :disabled="enteringCorrections"
                class="btn-secondary flex items-center gap-2 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <Wrench :size="16" :class="enteringCorrections ? 'animate-spin' : ''" />
                <span>{{ enteringCorrections ? 'ATIVANDO...' : 'MODO CORREÇÃO' }}</span>
              </button>

             <!-- BOTAO RENDERIZAR NOVAMENTE -->
             <button 
                v-if="(output.status === 'COMPLETED' || output.status === 'RENDERED' || output.status === 'FAILED') && !correctionMode"
                @click="renderAgain"
                :disabled="rendering"
                class="btn-secondary flex items-center gap-2 text-xs"
              >
                <Film :size="16" :class="rendering ? 'animate-spin' : ''" />
                <span>{{ rendering ? 'RENDERIZANDO...' : 'RENDERIZAR NOVAMENTE' }}</span>
              </button>
          </div>
        </header>

        <!-- Barra de contexto fixa: Summary + Métricas + Constantes (visível em todas as etapas) — ui-ux-pro-max -->
        <div 
          class="sticky top-0 z-30 -mx-6 px-6 py-4 mb-8 rounded-2xl border border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl shadow-lg transition-colors duration-200"
          role="region"
          aria-label="Resumo e constantes do output"
        >
          <div class="flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
            <!-- Summary (uma linha) -->
            <div class="min-w-0 flex-1 sm:max-w-xl">
              <p class="mono-label text-xs text-zinc-500 uppercase tracking-widest mb-1">Summary</p>
              <p class="text-sm text-zinc-300 italic leading-relaxed truncate" :title="output.script?.summary || output.dossier?.theme">
                {{ output.script?.summary || output.dossier?.theme || '—' }}
              </p>
            </div>
            <!-- Métricas: Duration, Word count, Scene count -->
            <div class="flex items-center gap-6 sm:gap-8 flex-shrink-0">
              <div>
                <p class="mono-label text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Duration</p>
                <p class="text-lg font-mono font-bold text-white">{{ output.script?.estimatedDuration || output.duration }}s</p>
              </div>
              <div>
                <p class="mono-label text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Word count</p>
                <p class="text-lg font-mono font-bold text-white">{{ output.script?.wordCount ?? '—' }} <span class="text-zinc-500 text-sm font-normal">words</span></p>
              </div>
              <div>
                <p class="mono-label text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Scene count</p>
                <p class="text-lg font-mono font-bold text-white">{{ output.scenes?.length ?? 0 }} <span class="text-zinc-500 text-sm font-normal">scenes</span></p>
              </div>
              <!-- Export JSON Button -->
              <button
                v-if="output.scenes?.length"
                @click="exportScenesJson"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-white/10 text-zinc-300 text-xs font-medium hover:bg-zinc-700/80 hover:text-white hover:border-white/20 transition-all duration-200 cursor-pointer"
                title="Exportar cenas como JSON (sem imagens/audio)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export JSON
              </button>
            </div>
            <!-- Constantes escolhidas -->
            <div class="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0 sm:border-l sm:border-white/10 sm:pl-6">
              <span class="mono-label text-xs text-zinc-500 uppercase tracking-widest w-full sm:w-auto mb-0.5 sm:mb-0">Constantes escolhidas</span>
              <div class="flex flex-wrap items-center gap-2">
                <span v-if="output.classification" class="inline-flex items-center px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-medium transition-colors duration-200 hover:bg-amber-500/15 cursor-default">{{ output.classification.label }}</span>
                <span v-if="output.scriptStyle" class="inline-flex items-center px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium transition-colors duration-200 hover:bg-primary/15 cursor-default">{{ output.scriptStyle.name }}</span>
                <span v-if="output.visualStyle" class="inline-flex items-center px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs font-medium transition-colors duration-200 hover:bg-purple-500/15 cursor-default">{{ output.visualStyle.name }}</span>
                <span v-if="!output.classification && !output.scriptStyle && !output.visualStyle" class="text-zinc-500 text-xs italic">Nenhuma</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Final Video Player -->
        <div v-if="output.status === 'COMPLETED' || output.hasVideo" class="mb-12">
            <div class="glass-card overflow-hidden rounded-3xl border-primary/20 shadow-2xl shadow-primary/5">
                <video 
                    controls 
                    class="w-full aspect-video bg-black"
                    :class="output.aspectRatio === '9:16' ? 'max-h-[70vh] object-contain' : ''"
                    :src="`/api/outputs/${outputId}/video`"
                ></video>
                <div class="p-4 bg-white/5 flex items-center justify-between text-xs mono-label text-zinc-500">
                    <span class="flex items-center gap-2">
                        <Film :size="12" /> MASTER RENDERIZADO (POSTGRESQL STORAGE)
                    </span>
                    <span>{{ output.outputMimeType }} • {{ (output.outputSize / 1024 / 1024).toFixed(2) }} MB</span>
                </div>
            </div>
        </div>

        <!-- Opções extras (após vídeo completo) -->
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
              <div v-if="!output.thumbnailCandidates?.length && !output.hasThumbnail" class="space-y-3">
                <!-- Hook text sugerido -->
                <div class="flex items-center gap-2">
                  <input
                    v-model="thumbnailHookText"
                    type="text"
                    maxlength="40"
                    placeholder="Hook text sugerido (ex: ELE SABIA DEMAIS)"
                    class="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 uppercase tracking-wider"
                  />
                  <button
                    @click="generateThumbnails"
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
              <div v-else-if="output.thumbnailCandidates?.length" class="space-y-3">
                <p class="text-xs text-zinc-400">Clique para ampliar e confirmar:</p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    v-for="(cand, idx) in output.thumbnailCandidates"
                    :key="idx"
                    @click="openThumbnailPreview(Number(idx))"
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
              <div v-else-if="output.hasThumbnail" class="flex flex-col sm:flex-row sm:items-center gap-4">
                <div class="flex items-center gap-3">
                  <button
                    @click="showSelectedThumbnail = true"
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
                    @click="removeThumbnail"
                    :disabled="removingThumbnail"
                    class="btn-secondary flex items-center gap-2 text-zinc-400 border-zinc-600/50 hover:border-red-500/50 hover:text-red-400 text-xs"
                  >
                    {{ removingThumbnail ? 'Removendo...' : 'Remover' }}
                  </button>
                  <button
                    @click="generateThumbnails"
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
                v-if="!output.socialKit"
                @click="generateSocialKit"
                :disabled="generatingSocialKit"
                class="btn-secondary flex items-center gap-2 text-violet-400 border-violet-500/30 hover:bg-violet-500/10 cursor-pointer"
              >
                <Share2 :size="16" :class="generatingSocialKit ? 'animate-spin' : ''" />
                {{ generatingSocialKit ? 'Gerando kit de publicação...' : 'Gerar Social Media Kit' }}
              </button>
              <p v-if="!output.socialKit" class="text-xs text-zinc-500 mt-1">Títulos, descrições e hashtags otimizados para YouTube, TikTok, Shorts e Instagram via Claude Haiku.</p>

              <!-- Kit gerado -->
              <div v-if="output.socialKit" class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-violet-300 flex items-center gap-2">
                    <Share2 :size="14" />
                    Social Media Kit
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      @click="generateSocialKit"
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
                    @click="activeSocialTab = tab.key"
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
                      <button @click="copySocialField(activeSocialContent.title)" class="text-xs text-zinc-600 hover:text-violet-400 transition-colors cursor-pointer">
                        Copiar
                      </button>
                    </div>
                    <p class="text-sm text-white font-medium">{{ activeSocialContent.title }}</p>
                  </div>

                  <!-- Descrição -->
                  <div class="bg-black/20 rounded-xl p-3 border border-white/5">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-xs text-zinc-500 uppercase tracking-wider font-bold">Descrição</span>
                      <button @click="copySocialField(activeSocialContent.description)" class="text-xs text-zinc-600 hover:text-violet-400 transition-colors cursor-pointer">
                        Copiar
                      </button>
                    </div>
                    <p class="text-xs text-zinc-300 whitespace-pre-line leading-relaxed">{{ activeSocialContent.description }}</p>
                  </div>

                  <!-- Hashtags -->
                  <div class="bg-black/20 rounded-xl p-3 border border-white/5">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-xs text-zinc-500 uppercase tracking-wider font-bold">Hashtags</span>
                      <button @click="copySocialField(activeSocialContent.hashtags?.join(' '))" class="text-xs text-zinc-600 hover:text-violet-400 transition-colors cursor-pointer">
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
                <div v-if="output.socialKit?.seoTags?.length" class="bg-black/20 rounded-xl p-3 border border-white/5">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs text-zinc-500 uppercase tracking-wider font-bold">SEO Tags</span>
                    <button @click="copySocialField(output.socialKit.seoTags.join(', '))" class="text-xs text-zinc-600 hover:text-violet-400 transition-colors cursor-pointer">
                      Copiar
                    </button>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="tag in output.socialKit.seoTags"
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

        <!-- Thumbnail Preview Modal -->
        <div v-if="selectedThumbnailIdx !== null && output?.thumbnailCandidates?.[selectedThumbnailIdx]" @click.self="selectedThumbnailIdx = null" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div class="bg-zinc-900 border border-white/10 p-6 rounded-2xl max-w-4xl w-full shadow-2xl space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-white">Preview da thumbnail</h3>
              <span v-if="output.thumbnailCandidates[selectedThumbnailIdx]?.hookText" class="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs font-bold uppercase tracking-wider">
                🔤 {{ output.thumbnailCandidates[selectedThumbnailIdx].hookText }}
              </span>
            </div>
            <div class="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/50">
              <img :src="`data:image/png;base64,${output.thumbnailCandidates[selectedThumbnailIdx]?.base64}`" alt="Thumbnail" class="w-full h-full object-contain" />
            </div>
            <div class="flex items-center justify-end gap-3">
              <button @click="selectedThumbnailIdx = null" class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors">
                CANCELAR
              </button>
              <button @click="selectThumbnail(selectedThumbnailIdx!)" :disabled="selectingThumbnail" class="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-2">
                <span v-if="selectingThumbnail" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                {{ selectingThumbnail ? 'Salvando...' : 'CONFIRMAR' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Lightbox: Thumbnail selecionada (visualização detalhada) -->
        <div v-if="showSelectedThumbnail && output?.hasThumbnail" @click.self="showSelectedThumbnail = false" class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 animate-in fade-in duration-200">
          <div class="bg-zinc-900/95 border border-white/10 p-4 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col gap-3">
            <!-- Header compacto -->
            <div class="flex items-center justify-between shrink-0">
              <span class="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon :size="14" class="text-emerald-400" />
                Thumbnail
              </span>
              <button @click="showSelectedThumbnail = false" class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white cursor-pointer">
                <X :size="16" />
              </button>
            </div>

            <!-- Imagem com altura máxima limitada -->
            <div class="relative rounded-xl overflow-hidden border border-white/10 bg-black/50 flex-1 min-h-0">
              <img :src="`/api/outputs/${outputId}/thumbnail?t=${thumbnailVersion}`" alt="Thumbnail selecionada" class="max-h-[60vh] w-auto mx-auto object-contain" />
            </div>

            <!-- Ações compactas -->
            <div class="flex items-center justify-between gap-2 shrink-0">
              <div class="flex items-center gap-2">
                <button
                  @click="removeThumbnail(); showSelectedThumbnail = false"
                  :disabled="removingThumbnail"
                  class="px-3 py-1.5 text-xs font-bold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  {{ removingThumbnail ? 'Removendo...' : 'Remover' }}
                </button>
                <button
                  @click="generateThumbnails(); showSelectedThumbnail = false"
                  :disabled="generatingThumbnails"
                  class="px-3 py-1.5 text-xs font-bold text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon :size="12" :class="generatingThumbnails ? 'animate-spin' : ''" />
                  {{ generatingThumbnails ? 'Gerando...' : 'Gerar novamente' }}
                </button>
              </div>
              <a
                :href="`/api/outputs/${outputId}/thumbnail?t=${thumbnailVersion}`"
                download="thumbnail.png"
                class="btn-primary px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download :size="12" />
                DOWNLOAD
              </a>
            </div>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════ -->
        <!-- CORRECTION MODE: Seção de Correções Pós-Renderização -->
        <!-- ════════════════════════════════════════════════════════════════════ -->
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
                <!-- Botão para sair do modo correção sem salvar -->
                <button 
                  @click="exitCorrectionMode"
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
                  
                  <!-- Image Preview -->
                  <div v-if="getSelectedImage(scene)">
                    <div class="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 transition-all relative">
                      <img 
                        :src="`/api/scene-images/${getSelectedImage(scene).id}?t=${imageVersions[scene.id] || 0}`" 
                        class="w-full h-full object-cover"
                        loading="lazy"
                        alt="Scene Image"
                      />
                      <!-- Zoom button (canto superior direito) -->
                      <button 
                        @click.stop="openImage(getSelectedImage(scene).id)"
                        class="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur rounded-lg text-white/70 hover:text-white hover:bg-black/80 transition-all z-10"
                        title="Ampliar imagem"
                      >
                        <Eye :size="16" />
                      </button>
                    </div>
                    
                    <!-- Regenerate Image Button -->
                    <button 
                      @click.stop="regenerateImageCorrection(scene)"
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
                           @click.stop="sanitizeRestrictedPrompt(scene, 'intense')"
                           :disabled="sanitizingSceneId === scene.id"
                           class="group px-3 py-2.5 bg-red-500/8 border border-red-500/20 text-red-300/80 hover:bg-red-500/15 hover:text-red-200 hover:border-red-500/40 rounded-lg transition-all flex flex-col items-center gap-1 text-center disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                         >
                           <span class="text-base">🔴</span>
                           <span class="text-[10px] font-bold uppercase tracking-wider">Intenso</span>
                           <span class="text-[9px] text-white/25 leading-tight">Original</span>
                         </button>
                         <button
                           @click.stop="sanitizeRestrictedPrompt(scene, 'moderate')"
                           :disabled="sanitizingSceneId === scene.id"
                           class="group px-3 py-2.5 bg-amber-500/8 border border-amber-500/20 text-amber-300/80 hover:bg-amber-500/15 hover:text-amber-200 hover:border-amber-500/40 rounded-lg transition-all flex flex-col items-center gap-1 text-center disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                         >
                           <span v-if="sanitizingSceneId === scene.id && sanitizingLevel === 'moderate'" class="animate-spin w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full"></span>
                           <span v-else class="text-base">🟡</span>
                           <span class="text-[10px] font-bold uppercase tracking-wider">Moderado</span>
                           <span class="text-[9px] text-white/25 leading-tight">Sem gore/violência</span>
                         </button>
                         <button
                           @click.stop="sanitizeRestrictedPrompt(scene, 'safe')"
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

                     <!-- Prompt editável (original ou reescrito pela IA) -->
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
                         v-model="restrictedPromptEdits[scene.id]"
                         class="w-full bg-black/40 border border-red-500/20 rounded-lg p-2.5 text-xs text-white/80 leading-relaxed focus:border-red-500/50 focus:outline-none resize-y min-h-[60px]"
                         rows="3"
                         :placeholder="scene.visualDescription"
                       ></textarea>
                     </div>

                     <!-- Botões de retry -->
                     <div class="flex gap-2">
                       <button
                         @click.stop="retryRestrictedImage(scene, 'same')"
                         :disabled="!!regeneratingSceneId"
                         class="flex-1 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                       >
                         <span v-if="regeneratingSceneId === scene.id && !restrictedPromptEdits[scene.id]" class="animate-spin w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full"></span>
                         <RotateCw v-else :size="14" />
                         TENTAR ORIGINAL
                       </button>
                       <button
                         v-if="restrictedPromptEdits[scene.id] && restrictedPromptEdits[scene.id] !== scene.visualDescription"
                         @click.stop="retryRestrictedImage(scene, 'edited')"
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

                  <!-- Image History (thumbnails das versões anteriores) -->
                  <div v-if="scene.images?.length > 1" class="mt-2">
                    <span class="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1.5 block">Histórico</span>
                    <div class="flex gap-2 overflow-x-auto pb-1">
                      <div 
                        v-for="img in scene.images.filter((i: any) => !i.isSelected)" 
                        :key="img.id"
                        class="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 cursor-pointer opacity-50 hover:opacity-100 transition-all"
                        @click="openImage(img.id)"
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
                        @click="startEditPrompt(scene)"
                        class="text-xs text-primary/40 hover:text-primary/70 transition-colors flex items-center gap-1 uppercase tracking-wider"
                      >
                        <Edit :size="10" /> Editar
                      </button>
                      <div v-else class="flex items-center gap-2">
                        <button @click="cancelEditPrompt(scene)" class="text-xs text-zinc-500 hover:text-white transition-colors uppercase tracking-wider">
                          Cancelar
                        </button>
                        <button @click="saveEditPrompt(scene)" class="text-xs text-primary hover:text-primary/80 transition-colors uppercase tracking-wider font-bold">
                          Salvar
                        </button>
                      </div>
                    </div>
                    <textarea 
                      v-if="editingPromptSceneId === scene.id"
                      v-model="editingPromptText"
                      class="w-full bg-black/40 border border-primary/20 rounded-lg p-2.5 text-xs text-white/80 leading-relaxed focus:border-primary/50 focus:outline-none resize-y min-h-[60px]"
                      rows="3"
                    ></textarea>
                    <p v-else class="text-xs text-zinc-300/80 leading-relaxed">{{ scene.visualDescription }}</p>
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
                      @click="regenerateMotionCorrection(scene)"
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
                      <span class="text-xs uppercase tracking-wider">{{ output.enableMotion ? 'Sem motion gerado' : 'Motion desabilitado' }}</span>
                    </div>

                    <!-- Generate Motion Button (quando não tem) -->
                    <button 
                      v-if="output.enableMotion && scene.images?.length > 0"
                      @click="regenerateMotionCorrection(scene)"
                      :disabled="regeneratingMotionSceneIds.has(scene.id)"
                      class="mt-3 w-full px-4 py-3 bg-pink-500/10 border border-pink-500/30 text-pink-300 hover:bg-pink-500/20 hover:text-pink-200 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span v-if="regeneratingMotionSceneIds.has(scene.id)" class="animate-spin w-4 h-4 border-2 border-pink-300/30 border-t-pink-300 rounded-full"></span>
                      <Zap v-else :size="14" />
                      {{ regeneratingMotionSceneIds.has(scene.id) ? 'GERANDO MOTION...' : 'GERAR MOTION' }}
                    </button>
                  </div>

                  <!-- Warning: imagem corrigida mas motion não reprocessado -->
                  <div v-if="correctedScenes.has(scene.id) && !motionRegeneratedScenes.has(scene.id) && output.enableMotion"
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
              @click="finishCorrectionsAndRender"
              :disabled="rendering || pendingMotionScenes.length > 0"
              class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span v-if="rendering" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
              <Zap v-else :size="20" />
              {{ rendering ? 'RENDERIZANDO...' : 'APROVAR E RE-RENDERIZAR' }}
            </button>
          </div>
        </div>

        <!-- Pipeline Progress (8 Stages): Plano narrativo → Roteiro → Visual → ... -->
        <!-- Steps aprovados são clicáveis: ao clicar, volta para aquela etapa (desaprova ela e as seguintes) -->
        <div class="mb-12 grid grid-cols-8 gap-3 p-1 bg-white/5 rounded-2xl border border-white/5">
           <div class="pipeline-step" 
             :class="getStepClass(output.storyOutlineApproved, true)"
             @click="output.storyOutlineApproved ? revertToStage('STORY_OUTLINE') : null"
             :title="output.storyOutlineApproved ? 'Clique para voltar a esta etapa' : ''"
           >
             <Map :size="16" class="step-icon" />
             <Undo2 v-if="output.storyOutlineApproved" :size="16" class="step-undo-icon" />
             <span class="text-xs font-black tracking-widest">Plano</span>
             <span v-if="getStepCost('outline') > 0" class="text-xs font-mono text-amber-400/70">
               {{ formatCost(getStepCost('outline')) }}
               <span v-if="isEstimatedCost('outline')" class="text-amber-500/50" title="Custo estimado (tokens reais indisponíveis)">~</span>
             </span>
             <div v-if="output.storyOutlineApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" 
             :class="getStepClass(output.scriptApproved, output.storyOutlineApproved)"
             @click="output.scriptApproved ? revertToStage('SCRIPT') : null"
             :title="output.scriptApproved ? 'Clique para voltar a esta etapa' : ''"
           >
             <ScrollText :size="16" class="step-icon" />
             <Undo2 v-if="output.scriptApproved" :size="16" class="step-undo-icon" />
             <span class="text-xs font-black tracking-widest">Roteiro</span>
             <span v-if="getStepCost('script') > 0" class="text-xs font-mono text-amber-400/70">
               {{ formatCost(getStepCost('script')) }}
               <span v-if="isEstimatedCost('script')" class="text-amber-500/50" title="Custo estimado (tokens reais indisponíveis)">~</span>
             </span>
             <div v-if="output.scriptApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>
           
           <div class="pipeline-step" 
             :class="getStepClass(output.imagesApproved, output.scriptApproved)"
             @click="output.imagesApproved ? revertToStage('IMAGES') : null"
             :title="output.imagesApproved ? 'Clique para voltar a esta etapa' : ''"
           >
             <ImageIcon :size="16" class="step-icon" />
             <Undo2 v-if="output.imagesApproved" :size="16" class="step-undo-icon" />
             <span class="text-xs font-black tracking-widest">Visual</span>
             <span v-if="getStepCost('image') > 0" class="text-xs font-mono text-amber-400/70">{{ formatCost(getStepCost('image')) }}</span>
             <div v-if="output.imagesApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" 
             :class="getStepClass(output.audioApproved, output.imagesApproved)"
             @click="output.audioApproved ? revertToStage('AUDIO') : null"
             :title="output.audioApproved ? 'Clique para voltar a esta etapa' : ''"
           >
             <Mic :size="16" class="step-icon" />
             <Undo2 v-if="output.audioApproved" :size="16" class="step-undo-icon" />
             <span class="text-xs font-black tracking-widest">Narração</span>
             <span v-if="getStepCost('narration') > 0" class="text-xs font-mono text-amber-400/70">{{ formatCost(getStepCost('narration')) }}</span>
             <div v-if="output.audioApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" 
             :class="getStepClass(output.bgmApproved, output.audioApproved)"
             @click="output.bgmApproved ? revertToStage('BGM') : null"
             :title="output.bgmApproved ? 'Clique para voltar a esta etapa' : ''"
           >
             <Radio :size="16" class="step-icon" />
             <Undo2 v-if="output.bgmApproved" :size="16" class="step-undo-icon" />
             <span class="text-xs font-black tracking-widest">Música</span>
             <span v-if="getStepCost('bgm') > 0" class="text-xs font-mono text-amber-400/70">{{ formatCost(getStepCost('bgm')) }}</span>
             <div v-if="output.bgmApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" 
             :class="getStepClass(output.videosApproved, output.bgmApproved)"
             @click="output.videosApproved ? revertToStage('MOTION') : null"
             :title="output.videosApproved ? 'Clique para voltar a esta etapa' : ''"
           >
             <Clapperboard :size="16" class="step-icon" />
             <Undo2 v-if="output.videosApproved" :size="16" class="step-undo-icon" />
             <span class="text-xs font-black tracking-widest">Motion</span>
             <span v-if="getStepCost('motion') > 0" class="text-xs font-mono text-amber-400/70">{{ formatCost(getStepCost('motion')) }}</span>
             <div v-if="output.videosApproved" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" :class="getStepClass(output.hasVideo, canRenderMaster || output.hasVideo)">
             <Film :size="16" />
             <span class="text-xs font-black tracking-widest">Render</span>
             <div v-if="output.hasVideo" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
           </div>

           <div class="pipeline-step" :class="getStepClass(output.status === 'COMPLETED', output.hasVideo)">
             <CheckCircle2 :size="16" />
             <span class="text-xs font-black tracking-widest">Final</span>
             <div v-if="output.status === 'COMPLETED'" class="absolute top-2 right-2 text-emerald-400"><CheckCircle2 :size="12"/></div>
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

        <!-- Plano gerado, aguardando aprovação: botão no início da etapa (acima do plano narrativo). Só na etapa Plano (sem roteiro). -->
        <div v-if="isPlanoStage && !output.script && output.status !== 'FAILED' && output.storyOutline && !output.storyOutlineApproved" class="mb-12 p-4 rounded-3xl border border-amber-500/30 bg-amber-500/5">
            <div class="flex justify-center mb-4">
              <button 
                @click="approveStoryOutline"
                :disabled="approving"
                class="px-8 py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                <span v-if="approving" class="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"></span>
                <CheckCircle2 v-else :size="20" />
                {{ approving ? 'Processando...' : 'APROVAR PLANO' }}
              </button>
            </div>
            <p class="text-amber-200 text-sm text-center">Plano narrativo gerado. Aprove-o para liberar a geração do roteiro.</p>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════ -->
        <!-- STORY OUTLINE: Plano Narrativo (Story Architect) — só na etapa Plano (sem roteiro ainda) -->
        <!-- Não exibir quando já existe roteiro (etapa Roteiro ou posterior). -->
        <!-- ════════════════════════════════════════════════════════════════════ -->
        <div v-if="isPlanoStage && output.storyOutline && !output.script" class="mb-12">
          <div class="glass-card rounded-3xl border-cyan-500/20 overflow-hidden">
            <!-- Header -->
            <div class="px-8 py-6 bg-gradient-to-r from-cyan-500/10 to-transparent border-b border-cyan-500/10 flex items-center justify-between cursor-pointer" @click="outlineExpanded = !outlineExpanded">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-cyan-500/20 rounded-xl">
                  <Map :size="20" class="text-cyan-400" />
                </div>
                <div>
                  <h3 class="text-lg font-bold text-cyan-200">Plano Narrativo</h3>
                  <p class="text-cyan-300/40 text-xs">Story Architect • {{ output.storyOutline.risingBeats?.length || 0 }} beats • Arco: {{ output.storyOutline.emotionalArc }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <button 
                  v-if="!output.storyOutlineApproved"
                  @click.stop="approveStoryOutline"
                  :disabled="approving"
                  class="px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                >
                  <CheckCircle2 :size="14" />
                  Aprovar plano
                </button>
                <button 
                  @click.stop="showOutlineFeedbackModal = true"
                  :disabled="regeneratingOutline"
                  class="px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-cyan-500/50 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                >
                  <RotateCw :size="14" :class="regeneratingOutline ? 'animate-spin' : ''" />
                  Replanejar
                </button>
                <component :is="outlineExpanded ? ChevronUp : ChevronDown" :size="20" class="text-cyan-400/50" />
              </div>
            </div>

            <!-- Informativo: Campos vazios em hook-only -->
            <div 
              v-if="outlineExpanded && output.storyOutline.resolutionLevel === 'none'" 
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
            <div v-if="outlineExpanded" class="p-8 space-y-6">
              <!-- Hook -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-red-500/5 p-5 rounded-2xl border border-red-500/10" :class="{ 'md:col-span-2': output.storyOutline.hookVariants?.length }">
                  <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-400/80 mb-3">
                    <Zap :size="12" /> Hook Strategy
                  </h4>
                  <p class="text-sm text-red-200/70 leading-relaxed mb-4">{{ output.storyOutline.hookStrategy }}</p>
                  
                  <!-- Hook Variants (4 níveis tonais + custom) -->
                  <div v-if="output.storyOutline.hookVariants?.length" class="space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <button
                        v-for="variant in output.storyOutline.hookVariants"
                        :key="variant.level"
                        @click="!output.storyOutlineApproved && (selectedHookLevel = variant.level)"
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
                          output.storyOutlineApproved ? 'cursor-default' : 'cursor-pointer'
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
                      v-if="!output.storyOutlineApproved"
                      @click="selectedHookLevel = 'custom'"
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
                        v-model="customHookText"
                        rows="3"
                        placeholder="Ex: Misture o tom do Aggressive com a sutileza do Moderate..."
                        class="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-sm text-white/90 italic font-serif placeholder-zinc-600 focus:border-cyan-500/50 outline-none transition-all resize-none"
                        @click.stop
                      ></textarea>
                    </button>

                    <!-- Preview do hook custom quando aprovado -->
                    <div
                      v-if="output.storyOutlineApproved && selectedHookLevel === 'custom' && customHookText"
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
                  <div v-else-if="output.storyOutline.hookCandidate" class="bg-black/30 p-3 rounded-lg border border-red-500/10">
                    <p class="text-sm text-white/80 italic font-serif">"{{ output.storyOutline.hookCandidate }}"</p>
                  </div>
                </div>

                <div class="bg-primary/5 p-5 rounded-2xl border border-primary/10">
                  <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/80 mb-3">
                    <Target :size="12" /> Setup / Promise
                  </h4>
                  <p class="text-sm text-zinc-300/90 leading-relaxed">{{ output.storyOutline.promiseSetup }}</p>
                </div>
              </div>

              <!-- Rising Beats -->
              <div class="bg-amber-500/5 p-5 rounded-2xl border border-amber-500/10">
                <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400/80 mb-4">
                  <TrendingUp :size="12" /> Beats de Revelação ({{ output.storyOutline.risingBeats?.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="(beat, idx) in output.storyOutline.risingBeats" :key="idx" class="flex gap-4 items-start">
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
                    <span class="px-2 py-1 bg-purple-500/20 rounded text-xs font-bold text-purple-300 uppercase">{{ output.storyOutline.climaxFormula }}</span>
                  </div>
                  <p class="text-sm text-purple-200/70 leading-relaxed">{{ output.storyOutline.climaxMoment }}</p>
                </div>

                <div class="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
                  <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400/80 mb-3">
                    <CheckCircle2 :size="12" /> Resolução
                  </h4>
                  <ul class="space-y-1 mb-3">
                    <li v-for="(point, idx) in output.storyOutline.resolutionPoints" :key="idx" class="text-sm text-emerald-200/70 flex gap-2">
                      <span class="text-emerald-500">•</span> {{ point }}
                    </li>
                  </ul>
                  <p class="text-xs text-emerald-300/40 italic">{{ output.storyOutline.resolutionAngle }}</p>
                </div>
              </div>

              <!-- Emotional Arc + Tone -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-pink-500/5 p-4 rounded-2xl border border-pink-500/10">
                  <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-pink-400/80 mb-2">
                    <Heart :size="12" /> Arco Emocional
                  </h4>
                  <p class="text-sm text-pink-200/70">{{ output.storyOutline.emotionalArc }}</p>
                </div>
                <div class="bg-zinc-500/5 p-4 rounded-2xl border border-zinc-500/10">
                  <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400/80 mb-2">
                    <Volume2 :size="12" /> Progressão de Tom
                  </h4>
                  <p class="text-sm text-zinc-200/70">{{ output.storyOutline.toneProgression }}</p>
                </div>
              </div>

              <!-- Scene Distribution -->
              <div class="bg-cyan-500/5 p-4 rounded-2xl border border-cyan-500/10">
                <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-400/80 mb-3">
                  <BarChart3 :size="12" /> Distribuição de Cenas
                </h4>
                <div class="flex flex-wrap gap-3">
                  <div v-for="(count, segment) in output.storyOutline.segmentDistribution" :key="segment" class="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-lg">
                    <span class="text-xs font-bold uppercase tracking-widest text-cyan-300/60">{{ segment }}</span>
                    <span class="text-sm font-mono font-bold text-white">{{ count }}</span>
                    <span class="text-xs text-cyan-400/40">cenas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Outline Feedback Modal -->
        <div v-if="showOutlineFeedbackModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div class="bg-zinc-900 border border-cyan-500/20 p-8 rounded-2xl max-w-lg w-full shadow-2xl space-y-6">
            <h3 class="text-xl font-bold flex items-center gap-2">
              <Map :size="20" class="text-cyan-400" />
              Replanejar Narrativa
            </h3>
            <p class="text-sm text-zinc-400">
              O que gostaria de mudar no plano narrativo? O Story Architect vai gerar um novo outline com sua direção.
            </p>
            
            <textarea 
              v-model="outlineFeedback"
              class="w-full h-32 bg-black/50 border border-white/10 rounded-xl p-4 text-sm focus:border-cyan-500 focus:outline-none resize-none"
              placeholder="Ex: O clímax deveria focar na conexão política, não na evidência forense. Quero mais tensão no hook..."
              autofocus
            ></textarea>

            <div class="flex justify-end gap-3 pt-2">
              <button @click="showOutlineFeedbackModal = false" class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors">
                CANCELAR
              </button>
              <button 
                @click="confirmRegenerateOutline"
                :disabled="regeneratingOutline"
                class="px-6 py-2 bg-cyan-500 text-black font-bold text-xs rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span v-if="regeneratingOutline" class="animate-spin w-3 h-3 border-2 border-black/30 border-t-black rounded-full"></span>
                REPLANEJAR
              </button>
            </div>
          </div>
        </div>

        <!-- Etapa 0: Plano narrativo (Story Architect) — isolada antes do roteiro -->
        <div v-if="isPlanoStage && output.status !== 'FAILED' && !output.storyOutline" class="mb-12 bg-cyan-500/5 border border-cyan-500/20 p-8 rounded-3xl flex flex-col gap-6 py-10">
            <div class="text-center">
              <Map :size="48" class="text-cyan-500/70 mb-2 mx-auto" />
              <h3 class="text-xl font-bold text-cyan-200">Etapa 1: Plano Narrativo</h3>
              <p class="text-zinc-400 text-sm max-w-md mx-auto mt-2">Gere o plano da história (Story Architect) e valide antes de criar o roteiro. O plano define hook, beats, clímax e distribuição de cenas.</p>
            </div>

            <!-- Monetization Picker (quando existe plano ativo) -->
            <div v-if="monetizationPlan?.planData" class="w-full max-w-4xl mx-auto">
              <div class="flex items-center gap-2 mb-4 flex-wrap">
                <Sparkles :size="14" class="text-purple-400" />
                <span class="text-xs font-bold uppercase tracking-widest text-purple-300">{{ monetizationPlan.planData.planTitle || 'Plano de Monetização' }}</span>
                <span class="text-xs text-zinc-600">(opcional — selecione um item ou escreva sugestão livre)</span>
              </div>

              <!-- Full Video Card -->
              <div v-if="monetizationPlan.planData.fullVideo" class="mb-3">
                <button
                  @click="selectMonetizationFullVideo(monetizationPlan.planData.fullVideo)"
                  :class="[
                    'w-full text-left p-4 rounded-xl border transition-all duration-200',
                    selectedMonetizationItem?.itemType === 'fullVideo'
                      ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/30'
                      : 'bg-black/30 border-white/5 hover:border-cyan-500/20 hover:bg-cyan-500/5'
                  ]"
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
                  @click="selectMonetizationTeaser(teaser, Number(idx))"
                  :class="[
                    'text-left p-3 rounded-xl border transition-all duration-200',
                    selectedMonetizationItem?.title === teaser.title
                      ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/30'
                      : 'bg-black/30 border-white/5 hover:border-purple-500/20 hover:bg-purple-500/5'
                  ]"
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
                v-model="outlineSuggestions"
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
                @click="generateOutlineThenReload"
                :disabled="generatingOutline"
                class="px-8 py-4 bg-cyan-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-cyan-400 transition-all flex items-center gap-3 disabled:opacity-50 mx-auto"
              >
                <span v-if="generatingOutline" class="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"></span>
                <Zap v-else :size="20" />
                {{ generatingOutline ? 'GERANDO PLANO...' : selectedMonetizationItem ? 'GERAR PLANO A PARTIR DA RECEITA' : 'GERAR PLANO NARRATIVO' }}
              </button>
            </div>
        </div>

        <!-- Plano aprovado, sem roteiro ainda: botão Gerar roteiro -->
        <div v-else-if="isPlanoStage && output.status !== 'FAILED' && output.storyOutlineApproved" class="mb-12 bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-3xl flex flex-col items-center justify-center gap-6 text-center py-16">
            <CheckCircle2 :size="48" class="text-emerald-500/70 mb-2" />
            <h3 class="text-xl font-bold text-emerald-200">Plano aprovado</h3>
            <p class="text-zinc-400 text-sm max-w-md">Agora você pode gerar o roteiro com base no plano narrativo validado.</p>
            <button 
              @click="startGenerateScript"
              :disabled="generatingStage === 'SCRIPT'"
              class="px-8 py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              <span v-if="generatingStage === 'SCRIPT'" class="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"></span>
              <ScrollText v-else :size="20" />
              {{ generatingStage === 'SCRIPT' ? 'GERANDO ROTEIRO...' : 'GERAR ROTEIRO' }}
            </button>
        </div>

        <!-- Script Generating Placeholder (Status: PENDING/PROCESSING & No Script, mas já disparou geração) -->
        <div v-if="isPlanoStage && output.status !== 'FAILED' && generatingStage === 'SCRIPT'" class="mb-12 bg-zinc-500/5 border border-zinc-500/20 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 text-center py-16 animate-pulse">
            <ScrollText :size="48" class="text-zinc-600 mb-2" />
            <h3 class="text-xl font-bold text-zinc-400">Gerando Roteiro...</h3>
            <p class="text-zinc-500 text-sm max-w-md">A IA está criando a narrativa baseada no plano aprovado. Isso pode levar alguns segundos.</p>
        </div>

        <!-- Script Approval Section -->
        <div v-if="isRoteiroStage" class="mb-12 bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/30 p-8 rounded-3xl relative overflow-hidden group">
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
                    @click="openChangeVoiceModal()"
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

                <!-- SFX: Gerar efeitos sonoros (quando há cenas com audioDescription) -->
                <button 
                    v-if="hasSFXScenes && allScenesHaveAudio"
                    @click="generateSFX"
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
        <div v-if="output.audioApproved && !output.bgmApproved" class="mb-12 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 p-8 rounded-3xl relative overflow-hidden group">
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

        <!-- 6. Render Trigger -->
        <div v-if="canRenderMaster && !output.hasVideo" class="mb-12 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 p-8 rounded-3xl relative overflow-hidden group">
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
                  @click="renderMaster"
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
                    <p class="text-xs text-red-300/60">O status está em GENERATING mas nenhum render ativo foi detectado. O processo pode ter sido interrompido.</p>
                  </div>
                  <button 
                    @click="cancelStaleRender"
                    class="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-500/30 transition-all shrink-0"
                  >
                    CANCELAR
                  </button>
                </div>
              </div>
             </div>
        </div>

        <!-- 7. Render Approval (quando renderizado, antes de COMPLETED) -->
        <div v-if="output.status === 'RENDERED' && output.hasVideo && !output.renderApproved" class="mb-12 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 p-8 rounded-3xl relative overflow-hidden group">
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
                    @click="approveRender"
                    :disabled="approving"
                    class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-glow-emerald flex items-center gap-3 disabled:opacity-50"
                >
                    <span v-if="approving" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    <CheckCircle2 v-else :size="20" />
                    {{ approving ? 'Processando...' : 'APROVAR E CONCLUIR' }}
                </button>

                <button 
                    @click="renderAgain"
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

        <!-- ⚠️ Aviso: Vídeo armazenado em disco (não no banco) -->
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

        <!-- Script Viewer: só exibir quando existir roteiro (etapa Roteiro ou posterior). Evita mostrar área vazia na etapa Plano. -->
        <main v-if="output.script" class="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
          
          <!-- Sidebar: Background Music (Summary/métricas/constantes estão na barra fixa no topo) -->
          <aside class="space-y-6">
             <!-- Background Music (Video Todo ou Tracks) -->
             <section v-if="output.script?.backgroundMusicPrompt || output.script?.backgroundMusicTracks?.length" class="glass-card p-6 rounded-2xl border-emerald-500/10 bg-emerald-500/5">
               <h3 class="flex items-center gap-2 mono-label mb-4 text-emerald-400">
                 <Radio :size="14" /> Background Music
               </h3>
               
               <!-- Música única (TikTok/Instagram - "video todo") -->
               <div v-if="output.script?.backgroundMusicPrompt" class="space-y-3">
                 <div class="flex items-center gap-2">
                   <span class="text-xs px-2 py-1 bg-emerald-500/20 rounded text-emerald-300 font-mono uppercase tracking-widest">Video Todo</span>
                   <span class="text-xs px-2 py-1 bg-emerald-500/10 rounded text-emerald-400/60 font-mono">{{ output.script.backgroundMusicVolume || -18 }}dB</span>
                 </div>
                 <p class="text-sm text-emerald-200/80 leading-relaxed italic">
                   {{ output.script.backgroundMusicPrompt }}
                 </p>
               </div>

               <!-- Lista de tracks com timestamps (YouTube Cinematic) -->
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
                      <button 
                        @click="editingPromptSceneId === scene.id ? cancelEditPrompt(scene) : startEditPrompt(scene)"
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
                   <!-- Narration -->
                   <div class="bg-black/20 p-4 rounded-xl border border-white/5">
                      <div class="flex justify-between items-center mb-2">
                        <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500">
                          <Mic :size="10" /> Narration ({{ output.narrationLanguage || 'PT-BR' }})
                        </h4>
                        <!-- Audio Status Badge -->
                        <span v-if="output.status === 'PROCESSING' && !output.audioTracks?.some((a: any) => a.type === 'narration')" class="text-xs text-orange-400 animate-pulse">Gerando Áudio...</span>
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

                      <!-- Mini Player (SFX da Cena) -->
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
                           Seu navegador não suporta áudio.
                         </audio>
                      </div>
                   </div>
                   
                   <!-- Visual -->
                   <div class="space-y-4">
                       <div class="bg-primary/5 p-4 rounded-xl border border-primary/10" :class="{ 'border-primary/30': editingPromptSceneId === scene.id }">
                         <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-400/70 mb-2">
                           <Eye :size="10" /> Visual Prompt
                           <span v-if="scene.imageStatus === 'restricted'" class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-red-500/20 text-red-400">Restrita</span>
                         </h4>

                         <!-- Modo visualização -->
                         <p v-if="editingPromptSceneId !== scene.id" class="text-sm text-white/80 leading-relaxed font-light">
                           {{ scene.visualDescription }}
                         </p>

                         <!-- Modo edição -->
                         <div v-else class="space-y-3">
                           <!-- Seletor IA de nível (para cenas restritas) -->
                           <div v-if="scene.imageStatus === 'restricted'" class="bg-white/[0.02] p-3 rounded-lg border border-white/5">
                             <h5 class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                               <Sparkles :size="9" /> Reescrever com IA
                             </h5>
                             <div class="grid grid-cols-3 gap-1.5">
                               <button
                                 @click.stop="sanitizeAndFillEdit(scene, 'intense')"
                                 :disabled="sanitizingSceneId === scene.id"
                                 class="px-2 py-2 bg-red-500/8 border border-red-500/20 text-red-300/80 hover:bg-red-500/15 hover:border-red-500/40 rounded-lg transition-all flex flex-col items-center gap-0.5 text-center disabled:opacity-50 cursor-pointer"
                               >
                                 <span class="text-sm">🔴</span>
                                 <span class="text-[9px] font-bold uppercase tracking-wider">Intenso</span>
                               </button>
                               <button
                                 @click.stop="sanitizeAndFillEdit(scene, 'moderate')"
                                 :disabled="sanitizingSceneId === scene.id"
                                 class="px-2 py-2 bg-amber-500/8 border border-amber-500/20 text-amber-300/80 hover:bg-amber-500/15 hover:border-amber-500/40 rounded-lg transition-all flex flex-col items-center gap-0.5 text-center disabled:opacity-50 cursor-pointer"
                               >
                                 <span v-if="sanitizingSceneId === scene.id && sanitizingLevel === 'moderate'" class="animate-spin w-3.5 h-3.5 border-2 border-amber-300/30 border-t-amber-300 rounded-full"></span>
                                 <span v-else class="text-sm">🟡</span>
                                 <span class="text-[9px] font-bold uppercase tracking-wider">Moderado</span>
                               </button>
                               <button
                                 @click.stop="sanitizeAndFillEdit(scene, 'safe')"
                                 :disabled="sanitizingSceneId === scene.id"
                                 class="px-2 py-2 bg-emerald-500/8 border border-emerald-500/20 text-emerald-300/80 hover:bg-emerald-500/15 hover:border-emerald-500/40 rounded-lg transition-all flex flex-col items-center gap-0.5 text-center disabled:opacity-50 cursor-pointer"
                               >
                                 <span v-if="sanitizingSceneId === scene.id && sanitizingLevel === 'safe'" class="animate-spin w-3.5 h-3.5 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full"></span>
                                 <span v-else class="text-sm">🟢</span>
                                 <span class="text-[9px] font-bold uppercase tracking-wider">Seguro</span>
                               </button>
                             </div>
                           </div>

                           <!-- Textarea de edição -->
                           <textarea
                             v-model="editingPromptText"
                             class="w-full bg-black/40 border border-primary/20 rounded-lg p-3 text-sm text-white/90 leading-relaxed focus:border-primary/50 focus:outline-none resize-y min-h-[80px]"
                             rows="4"
                           ></textarea>

                           <!-- Botões Salvar / Cancelar / Regenerar -->
                           <div class="flex gap-2">
                             <button
                               @click="saveEditPrompt(scene)"
                               class="flex-1 px-3 py-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
                             >
                               <Check :size="12" /> Salvar
                             </button>
                             <button
                               v-if="editingPromptText !== scene.visualDescription"
                               @click="saveAndRegenerateImage(scene)"
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

                <!-- 🎥 Video/Motion Preview -->
                <div v-if="output.enableMotion && (output.videosApproved || output.scenes?.some((s:any) => s.videos?.length))" class="mt-4 pt-4 border-t border-white/5">
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
                        {{ getSelectedVideo(scene).provider }} • {{ getSelectedVideo(scene).duration?.toFixed(1) }}s
                        </div>
                      </div>

                      <!-- Regenerar Motion Individual -->
                      <button 
                        v-if="pipelineStage === 'MOTION'"
                        @click="regenerateMotionCorrection(scene)"
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
                        <span class="text-xs uppercase tracking-wider">{{ output.audioApproved ? 'Aguardando Motion...' : 'Pendente de Áudio' }}</span>
                      </div>
                      <!-- Gerar Motion Individual (cena sem vídeo) -->
                      <button 
                        v-if="pipelineStage === 'MOTION'"
                        @click="regenerateMotionCorrection(scene)"
                        :disabled="regeneratingMotionSceneIds.has(scene.id)"
                        class="w-full px-3 py-2 bg-pink-500/10 border border-pink-500/20 text-pink-300 hover:bg-pink-500/20 hover:text-pink-200 hover:border-pink-500/40 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                      >
                        <span v-if="regeneratingMotionSceneIds.has(scene.id)" class="animate-spin w-3.5 h-3.5 border-2 border-pink-300/30 border-t-pink-300 rounded-full"></span>
                        <Zap v-else :size="12" />
                        {{ regeneratingMotionSceneIds.has(scene.id) ? 'GERANDO...' : 'GERAR MOTION' }}
                      </button>
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
                   <!-- Cena restrita pelo filtro de conteúdo -->
                   <div v-else-if="scene.imageStatus === 'restricted'" class="h-16 bg-red-500/5 rounded-lg flex items-center justify-center gap-3 text-xs border border-dashed border-red-500/20">
                     <ShieldAlert :size="16" class="text-red-400/60" />
                     <span class="text-red-300/70">Imagem bloqueada pelo filtro de conteúdo</span>
                     <span class="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-red-500/20 text-red-400">Restrita</span>
                   </div>
                   <!-- Cena com erro genérico -->
                   <div v-else-if="scene.imageStatus === 'error'" class="h-16 bg-orange-500/5 rounded-lg flex items-center justify-center gap-3 text-xs border border-dashed border-orange-500/20">
                     <AlertTriangle :size="16" class="text-orange-400/60" />
                     <span class="text-orange-300/70">Erro ao gerar imagem</span>
                   </div>
                   <div v-else class="h-12 bg-white/5 rounded-lg flex items-center justify-center text-xs text-zinc-500 uppercase tracking-widest border border-dashed border-white/5">
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
          <span class="text-xs font-black tracking-widest text-zinc-500 uppercase">Modelo</span>
          <p class="text-white font-mono text-sm mt-1">{{ pricingError.model }}</p>
        </div>
        <div>
          <span class="text-xs font-black tracking-widest text-zinc-500 uppercase">Provider</span>
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
            Escolha uma nova voz e/ou velocidade. Toda a narração será regenerada.
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

      <!-- Speed Selector (WPM) -->
      <div class="mb-6">
        <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Velocidade da narração (WPM)</label>
        <div class="flex gap-2">
          <button v-for="wpm in [120, 150, 180]" :key="wpm"
            @click="newTargetWPM = wpm"
            class="flex-1 py-3 rounded-xl text-xs font-bold uppercase border transition-all"
            :class="[newTargetWPM === wpm ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/10 hover:border-white/20 text-zinc-400 hover:text-white']">
            {{ wpm === 120 ? 'Lento' : wpm === 150 ? 'Normal' : 'Rápido' }} ({{ wpm }})
          </button>
        </div>
        <p v-if="output.targetWPM && newTargetWPM !== output.targetWPM" class="text-xs text-amber-400/60 mt-1.5">
          Atual: {{ output.targetWPM }} WPM → Nova: {{ newTargetWPM }} WPM
        </p>
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
          :disabled="!newVoiceId || (newVoiceId === output.voiceId && newTargetWPM === (output.targetWPM || 150))"
          class="px-8 py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Mic :size="20" />
          Trocar e Regenerar
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Opções de renderização (logo + legendas) -->
  <div 
    v-if="showRenderOptionsModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="showRenderOptionsModal = false"
  >
    <div class="glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 rounded-3xl border-emerald-500/20 shadow-2xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-black text-white flex items-center gap-3">
            <Film :size="28" class="text-emerald-500" />
            Opções de renderização
          </h2>
          <p class="text-zinc-400 text-sm mt-2">
            Inclua logo e/ou legendas no vídeo final
          </p>
        </div>
        <button @click="showRenderOptionsModal = false" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X :size="24" />
        </button>
      </div>

      <!-- Checkboxes -->
      <div class="space-y-4 mb-6">
        <label class="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
          <input type="checkbox" v-model="renderIncludeLogo" class="w-5 h-5 rounded border-white/30 text-primary bg-black/40" />
          <span class="font-medium text-white">Incluir logo The Gap Files</span>
          <span class="text-zinc-500 text-sm">(rodapé direito, transparente)</span>
        </label>
        <label class="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
          <input type="checkbox" v-model="renderIncludeCaptions" class="w-5 h-5 rounded border-white/30 text-secondary bg-black/40" />
          <span class="font-medium text-white">Incluir legendas</span>
          <span class="text-zinc-500 text-sm">(estilo escolhido abaixo)</span>
        </label>
        <label v-if="hasBgmData" class="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
          <input type="checkbox" v-model="renderAdjustVolume" class="w-5 h-5 rounded border-white/30 text-emerald-500 bg-black/40" />
          <Volume2 :size="18" class="text-emerald-400" />
          <span class="font-medium text-white">Ajustar volume do background</span>
          <span class="text-zinc-500 text-sm">(dB por track)</span>
        </label>
      </div>

      <!-- Opções de legenda (no mesmo modal, quando "Incluir legendas" marcado) -->
      <div v-if="renderIncludeCaptions" class="mb-6">
        <h3 class="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Estilo de legenda</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            v-for="style in captionStyles"
            :key="style.id"
            @click="renderCaptionStyleId = style.id"
            class="relative p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.02]"
            :class="[
              renderCaptionStyleId === style.id ? 'border-secondary bg-secondary/10' : 'border-white/10 bg-white/5 hover:border-white/20'
            ]"
          >
            <div v-if="style.isRecommended" class="absolute -top-2 -right-2 px-3 py-1 bg-secondary text-black text-xs font-black uppercase tracking-wider rounded-full">
              Recomendado
            </div>
            <div class="flex items-start gap-3 mb-3">
              <div class="p-2 rounded-lg" :class="renderCaptionStyleId === style.id ? 'bg-secondary/20' : 'bg-white/10'">
                <Subtitles :size="20" :class="renderCaptionStyleId === style.id ? 'text-secondary' : 'text-white'" />
              </div>
              <div class="flex-1">
                <h4 class="font-bold text-white">{{ style.name }}</h4>
                <p class="text-xs text-zinc-500 uppercase">{{ style.platform }}</p>
              </div>
            </div>
            <p class="text-sm text-zinc-400 leading-relaxed">{{ style.description }}</p>
            <div v-if="renderCaptionStyleId === style.id" class="absolute bottom-4 right-4">
              <CheckCircle2 :size="20" class="text-secondary" />
            </div>
          </div>
        </div>
      </div>

      <!-- Ajuste de volume do background (quando checkbox ativado) -->
      <div v-if="renderAdjustVolume && hasBgmData" class="mb-6">
        <h3 class="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Volume2 :size="16" />
          Volume do Background
        </h3>

        <!-- Música única (backgroundMusicPrompt) -->
        <div v-if="output.script?.backgroundMusicPrompt && !output.script?.backgroundMusicTracks?.length" class="space-y-3">
          <div class="bg-black/20 p-4 rounded-xl border border-emerald-500/10">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs text-emerald-300 font-medium">Vídeo Todo</span>
              <span class="text-sm font-mono font-bold text-emerald-400">{{ renderBgmVolumeGlobal }}dB</span>
            </div>
            <input
              type="range"
              v-model.number="renderBgmVolumeGlobal"
              min="-40"
              max="0"
              step="1"
              class="w-full accent-emerald-500 cursor-pointer"
            />
            <div class="flex items-center justify-between text-xs text-zinc-600 mt-1">
              <span>-40dB (silencioso)</span>
              <span class="text-emerald-500/60">Original: {{ output.script.backgroundMusicVolume || -18 }}dB</span>
              <span>0dB (máximo)</span>
            </div>
          </div>
        </div>

        <!-- Múltiplas tracks (backgroundMusicTracks) -->
        <div v-else-if="output.script?.backgroundMusicTracks?.length" class="space-y-3">
          <div 
            v-for="(track, idx) in output.script.backgroundMusicTracks" 
            :key="'vol-' + idx" 
            class="bg-black/20 p-4 rounded-xl border border-emerald-500/10"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-mono font-bold text-emerald-300">
                  {{ Number(idx) + 1 }}
                </div>
                <span class="text-xs text-emerald-300 font-medium">
                  Cenas {{ track.startScene }} → {{ track.endScene !== null && track.endScene !== undefined ? track.endScene : 'Fim' }}
                </span>
              </div>
              <span class="text-sm font-mono font-bold text-emerald-400">{{ getTrackVolumeOverride(Number(idx)) }}dB</span>
            </div>
            <input
              type="range"
              :value="getTrackVolumeOverride(Number(idx))"
              @input="setTrackVolumeOverride(Number(idx), Number(($event.target as HTMLInputElement).value))"
              min="-40"
              max="0"
              step="1"
              class="w-full accent-emerald-500 cursor-pointer"
            />
            <div class="flex items-center justify-between text-xs text-zinc-600 mt-1">
              <span>-40dB</span>
              <span class="text-emerald-500/60">Original: {{ track.volume }}dB</span>
              <span>0dB</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-6 border-t border-white/10">
        <button @click="showRenderOptionsModal = false" class="px-6 py-3 text-zinc-400 hover:text-white transition-colors">
          Cancelar
        </button>
        <button
          @click="confirmRenderWithOptions"
          :disabled="rendering || (renderIncludeCaptions && !renderCaptionStyleId)"
          class="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-glow-emerald flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          <span v-if="rendering" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
          <Zap v-else :size="20" />
          {{ rendering ? 'RENDERIZANDO...' : 'RENDERIZAR' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  ArrowLeft, Download, RotateCw, ScrollText, ImageIcon, Mic, Film, CheckCircle2, 
  AlertTriangle, Edit, Eye, Music, X, Zap, Clapperboard, Subtitles, Radio, DollarSign, RefreshCw, Wrench,
  Map, ChevronUp, ChevronDown, Target, TrendingUp, Star, Heart, Volume2, BarChart3, ShieldAlert,
  Undo2, AudioWaveform
} from 'lucide-vue-next'
import VoiceSelector from '~/components/dossier/VoiceSelector.vue'

const route = useRoute()
const router = useRouter()
const outputId = route.params.id as string

const output = ref<any>(null)
const loading = ref(true)
const approving = ref(false)
const addingCaptions = ref(false)

// ═══════════════════════════════════════════════════════════
// PIPELINE STAGE — separação total Plano vs Roteiro
// ═══════════════════════════════════════════════════════════
/** Etapa atual do pipeline: 'PLANO' | 'ROTEIRO' | 'VISUAL' | 'NARRACAO' | 'MUSICA' | 'MOTION' | 'RENDER' | 'FINAL' */
const pipelineStage = computed(() => {
  if (!output.value || output.value.status === 'FAILED') return null
  if (!output.value.script) return 'PLANO'
  if (!output.value.scriptApproved) return 'ROTEIRO'
  if (!output.value.imagesApproved) return 'VISUAL'
  if (!output.value.audioApproved) return 'NARRACAO'
  if (!output.value.bgmApproved) return 'MUSICA'
  if (output.value.enableMotion && !output.value.videosApproved) return 'MOTION'
  if (!output.value.hasVideo) return 'RENDER'
  return 'FINAL'
})
/** True = ainda na etapa Plano narrativo (sem roteiro criado). Conteúdo de plano só aqui. */
const isPlanoStage = computed(() => pipelineStage.value === 'PLANO')
/** True = etapa Roteiro (roteiro existe; aprovação ou conteúdo). Roteiro só aqui. */
const isRoteiroStage = computed(() => pipelineStage.value === 'ROTEIRO')

// Change Voice
const showChangeVoiceModal = ref(false)
const newVoiceId = ref<string | null>(null)
const newTargetWPM = ref(150)
const changingVoice = ref(false)

// ═══════════════════════════════════════════════════════════
// CORRECTION MODE STATE
// Derivado do banco: se o output JÁ teve vídeo renderizado (hasVideo)
// mas está com status PENDING e imagens desaprovadas, está em modo correção.
// Isso persiste ao recarregar a página.
// ═══════════════════════════════════════════════════════════
const correctionMode = computed(() => {
  if (!output.value) return false
  // Já tinha vídeo renderizado + status voltou para PENDING/FAILED + imagens desaprovadas = modo correção
  return output.value.hasVideo 
    && output.value.status === 'PENDING' 
    && output.value.scriptApproved 
    && !output.value.imagesApproved
})
const enteringCorrections = ref(false)
const regeneratingMotionSceneIds = ref<Set<string>>(new Set())
const correctedScenes = ref<Set<string>>(new Set())
const motionRegeneratedScenes = ref<Set<string>>(new Set())
const imageVersions = ref<Record<string, number>>({})
const motionVersions = ref<Record<string, number>>({})

// Edição de Visual Prompt
const editingPromptSceneId = ref<string | null>(null)
const editingPromptText = ref('')

function startEditPrompt(scene: any) {
  editingPromptSceneId.value = scene.id
  editingPromptText.value = scene.visualDescription
}

function cancelEditPrompt(scene: any) {
  editingPromptSceneId.value = null
  editingPromptText.value = ''
}

async function saveEditPrompt(scene: any) {
  if (!editingPromptText.value.trim()) return
  try {
    await $fetch(`/api/scenes/${scene.id}/update`, {
      method: 'PATCH',
      body: { visualDescription: editingPromptText.value.trim() }
    })
    scene.visualDescription = editingPromptText.value.trim()
  } catch (error: any) {
    console.error('Erro ao salvar prompt:', error)
    alert('Erro ao salvar o prompt visual.')
  }
  editingPromptSceneId.value = null
  editingPromptText.value = ''
}

async function sanitizeAndFillEdit(scene: any, level: 'intense' | 'moderate' | 'safe') {
  if (sanitizingSceneId.value) return

  // Se 'intense', restaura o prompt original
  if (level === 'intense') {
    editingPromptText.value = scene.visualDescription
    return
  }

  sanitizingSceneId.value = scene.id
  sanitizingLevel.value = level

  try {
    const result = await $fetch(`/api/scenes/${scene.id}/sanitize-prompt`, {
      method: 'POST',
      body: { level }
    }) as any

    editingPromptText.value = result.sanitizedPrompt
  } catch (error: any) {
    console.error('Erro ao sanitizar prompt:', error)
    alert('Erro ao reescrever o prompt. Tente novamente.')
  } finally {
    sanitizingSceneId.value = null
    sanitizingLevel.value = null
  }
}

async function saveAndRegenerateImage(scene: any) {
  if (regeneratingSceneId.value) return
  if (!editingPromptText.value.trim()) return

  regeneratingSceneId.value = scene.id

  try {
    // 1. Salvar o prompt editado
    const newPrompt = editingPromptText.value.trim()
    await $fetch(`/api/scenes/${scene.id}/update`, {
      method: 'PATCH',
      body: { visualDescription: newPrompt }
    })
    scene.visualDescription = newPrompt

    // 2. Regenerar a imagem com o novo prompt
    await $fetch(`/api/scenes/${scene.id}/regenerate-image`, {
      method: 'POST',
      body: { prompt: newPrompt }
    })

    // Sucesso — fechar editor e recarregar
    editingPromptSceneId.value = null
    editingPromptText.value = ''
    correctedScenes.value = new Set([...correctedScenes.value, scene.id])
    await loadOutput()
    imageVersions.value = { ...imageVersions.value, [scene.id]: Date.now() }

  } catch (error: any) {
    console.error('Erro ao salvar e regenerar:', error)
    if (error?.data?.data?.code === 'CONTENT_RESTRICTED') {
      alert('O prompt ainda foi rejeitado pelo filtro de conteúdo. Tente um nível mais seguro (🟡 Moderado ou 🟢 Seguro).')
    } else {
      handleApiError(error, 'Erro ao salvar e regenerar imagem.')
    }
  } finally {
    regeneratingSceneId.value = null
  }
}

const pendingMotionScenes = computed(() => {
  if (!output.value?.enableMotion) return []
  return [...correctedScenes.value].filter(id => !motionRegeneratedScenes.value.has(id))
})

async function enterCorrectionMode() {
  if (enteringCorrections.value) return
  enteringCorrections.value = true

  try {
    await $fetch(`/api/outputs/${outputId}/enter-corrections`, { method: 'PATCH' })
    
    // Atualizar estado local — correctionMode é computed e reagirá automaticamente
    output.value.status = 'PENDING'
    output.value.imagesApproved = false
    output.value.videosApproved = false
    correctedScenes.value = new Set()
    motionRegeneratedScenes.value = new Set()
    
    // Recarregar dados completos
    await loadOutput()
  } catch (error: any) {
    console.error('Erro ao entrar em modo correção:', error)
    alert(error?.data?.message || 'Erro ao ativar modo correção.')
  } finally {
    enteringCorrections.value = false
  }
}

async function exitCorrectionMode() {
  // Mesmo fluxo de render: abre modal de opções (logo/legendas), ao confirmar aprova stages e dispara render
  await openRenderOptionsModal('again', {
    beforeRender: async () => {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'IMAGES', approved: true }
      })
      if (output.value?.enableMotion) {
        await $fetch(`/api/outputs/${outputId}/approve-stage`, {
          method: 'PATCH',
          body: { stage: 'MOTION', approved: true }
        })
      }
      correctedScenes.value = new Set()
      motionRegeneratedScenes.value = new Set()
    }
  })
}

async function regenerateImageCorrection(scene: any) {
  if (regeneratingSceneId.value) return
  regeneratingSceneId.value = scene.id

  try {
    await $fetch(`/api/scenes/${scene.id}/regenerate-image`, {
      method: 'POST',
      body: { prompt: scene.visualDescription }
    })

    // Marcar cena como corrigida
    correctedScenes.value = new Set([...correctedScenes.value, scene.id])
    
    // Recarregar output completo do banco para garantir dados frescos e reatividade
    await loadOutput()
    
    // Forçar cache-bust nas imagens
    imageVersions.value = { ...imageVersions.value, [scene.id]: Date.now() }
    
  } catch (error: any) {
    console.error('Erro regenerando imagem:', error)
    handleApiError(error, 'Erro ao regenerar imagem.')
  } finally {
    regeneratingSceneId.value = null
  }
}

async function regenerateMotionCorrection(scene: any) {
  if (regeneratingMotionSceneIds.value.has(scene.id)) return
  regeneratingMotionSceneIds.value = new Set([...regeneratingMotionSceneIds.value, scene.id])

  try {
    const result = await $fetch(`/api/scenes/${scene.id}/regenerate-motion`, {
      method: 'POST'
    })

    // Atualizar dados locais - reload a cena
    const freshData = await $fetch(`/api/outputs/${outputId}`)
    const freshScene = (freshData as any).scenes?.find((s: any) => s.id === scene.id)
    if (freshScene) {
      scene.videos = freshScene.videos
    }
    
    // Marcar motion como reprocessado
    motionRegeneratedScenes.value = new Set([...motionRegeneratedScenes.value, scene.id])
    motionVersions.value = { ...motionVersions.value, [scene.id]: Date.now() }
    
    // Recarregar custos
    loadCosts()
  } catch (error: any) {
    console.error('Erro regenerando motion:', error)
    handleApiError(error, 'Erro ao regenerar motion.')
  } finally {
    const next = new Set(regeneratingMotionSceneIds.value)
    next.delete(scene.id)
    regeneratingMotionSceneIds.value = next
  }
}

async function finishCorrectionsAndRender() {
  if (rendering.value) return
  // Mesmo fluxo de render: abre modal de opções (logo/legendas), ao confirmar aprova stages e dispara render
  await openRenderOptionsModal('again', {
    beforeRender: async () => {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'IMAGES', approved: true }
      })
      if (output.value?.enableMotion) {
        await $fetch(`/api/outputs/${outputId}/approve-stage`, {
          method: 'PATCH',
          body: { stage: 'MOTION', approved: true }
        })
      }
      correctedScenes.value = new Set()
      motionRegeneratedScenes.value = new Set()
    }
  })
}

// Thumbnails (Opção A)
const generatingThumbnails = ref(false)
const selectingThumbnail = ref(false)
const removingThumbnail = ref(false)
const selectedThumbnailIdx = ref<number | null>(null)
const showSelectedThumbnail = ref(false)
const thumbnailHookText = ref('')
const thumbnailVersion = ref(Date.now())

// Social Media Kit
const generatingSocialKit = ref(false)
const activeSocialTab = ref('youtube')

const socialKitTabs = [
  { key: 'youtube', label: 'YouTube' },
  { key: 'youtubeShorts', label: 'Shorts' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
]

const activeSocialContent = computed(() => {
  const kit = output.value?.socialKit as any
  if (!kit) return null
  return kit[activeSocialTab.value] || null
})

async function generateSocialKit() {
  if (generatingSocialKit.value) return
  generatingSocialKit.value = true
  try {
    await $fetch(`/api/outputs/${outputId}/generate-social-kit`, { method: 'POST' })
    await loadOutput()
    loadCosts()
  } catch (e: any) {
    handleApiError(e, 'Erro ao gerar Social Media Kit.')
  } finally {
    generatingSocialKit.value = false
  }
}

function copySocialField(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text)
}

function exportScenesJson() {
  if (!output.value?.scenes?.length) return
  const scenes = output.value.scenes.map((scene: any) => ({
    id: scene.id,
    outputId: scene.outputId,
    order: scene.order,
    narration: scene.narration,
    visualDescription: scene.visualDescription,
    audioDescription: scene.audioDescription || null,
    startTime: scene.startTime || null,
    endTime: scene.endTime || null,
    estimatedDuration: scene.estimatedDuration,
    imageRestrictionReason: scene.imageRestrictionReason || null,
    imageStatus: scene.imageStatus,
    sceneEnvironment: scene.sceneEnvironment || null,
    motionDescription: scene.motionDescription || null
  }))
  const exportData = {
    outputId: output.value.id,
    title: output.value.title || output.value.dossier?.theme || 'untitled',
    totalScenes: scenes.length,
    totalDuration: scenes.length * 5,
    exportedAt: new Date().toISOString(),
    scenes
  }
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `scenes-${output.value.id.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function openThumbnailPreview(idx: number) {
  selectedThumbnailIdx.value = idx
}

async function removeThumbnail() {
  if (removingThumbnail.value) return
  removingThumbnail.value = true
  try {
    await $fetch(`/api/outputs/${outputId}/remove-thumbnail`, { method: 'POST' })
    await loadOutput()
  } catch (e: any) {
    handleApiError(e, 'Erro ao remover thumbnail.')
  } finally {
    removingThumbnail.value = false
  }
}

async function generateThumbnails() {
  if (generatingThumbnails.value) return
  generatingThumbnails.value = true
  try {
    await $fetch(`/api/outputs/${outputId}/generate-thumbnails`, {
      method: 'POST',
      body: { hookText: thumbnailHookText.value || undefined }
    })
    await loadOutput()
    loadCosts()
    thumbnailHookText.value = ''
  } catch (e: any) {
    handleApiError(e, 'Erro ao gerar thumbnails.')
  } finally {
    generatingThumbnails.value = false
  }
}

async function selectThumbnail(idx: number) {
  if (selectingThumbnail.value) return
  selectingThumbnail.value = true
  selectedThumbnailIdx.value = idx
  try {
    await $fetch(`/api/outputs/${outputId}/select-thumbnail`, {
      method: 'POST',
      body: { index: idx }
    })
    await loadOutput()
    thumbnailVersion.value = Date.now()
  } catch (e: any) {
    handleApiError(e, 'Erro ao selecionar thumbnail.')
  } finally {
    selectingThumbnail.value = false
    selectedThumbnailIdx.value = null
  }
}

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

/**
 * Retorna custo real das opções extras filtrado dos logs do banco.
 * Se nunca foi executada, retorna 0.
 */
function getExtraCost(key: 'thumbnail' | 'social_kit'): number {
  if (!costs.value?.logs) return 0
  if (key === 'thumbnail') {
    return costs.value.logs
      .filter((l: any) => l.resource === 'thumbnail')
      .reduce((sum: number, l: any) => sum + l.cost, 0)
  }
  if (key === 'social_kit') {
    return costs.value.logs
      .filter((l: any) => l.resource === 'script' && (l.metadata as any)?.step === 'social_kit')
      .reduce((sum: number, l: any) => sum + l.cost, 0)
  }
  return 0
}

// Caption styles (usado no modal de opções de renderização)
const captionStyles = ref<any[]>([])

// Modal de opções de renderização (logo + legendas + volume na renderização principal)
const showRenderOptionsModal = ref(false)
const renderIncludeLogo = ref(true)
const renderIncludeCaptions = ref(false)
const renderCaptionStyleId = ref<string | null>(null)
const renderAction = ref<'master' | 'again'>('master')
const renderAdjustVolume = ref(false)
const renderBgmVolumeGlobal = ref(-18)
const renderBgmVolumePerTrack = ref<Record<number, number>>({})
const pendingRenderOptions = ref<{ includeLogo: boolean; includeCaptions: boolean; captionStyleId: string | null; volumeOverride?: { global?: number; perTrack?: Record<number, number> } } | null>(null)

// Computed: output tem dados de BGM para ajustar volume?
const hasBgmData = computed(() => {
  if (!output.value?.script) return false
  return !!(output.value.script.backgroundMusicPrompt || output.value.script.backgroundMusicTracks?.length)
})

// Helpers para volume por track
function getTrackVolumeOverride(idx: number): number {
  return renderBgmVolumePerTrack.value[idx] ?? output.value?.script?.backgroundMusicTracks?.[idx]?.volume ?? -18
}

function setTrackVolumeOverride(idx: number, value: number) {
  renderBgmVolumePerTrack.value = { ...renderBgmVolumePerTrack.value, [idx]: value }
}
/** Callback opcional a rodar antes de disparar o render (ex.: aprovar stages ao sair do modo correção) */
const pendingBeforeRender = ref<(() => Promise<void>) | null>(null)

async function loadOutput() {
  try {
    const data = await $fetch(`/api/outputs/${outputId}`)
    output.value = data

    // ── DEBUG: Estado completo do pipeline ──
    const d = data as any
    console.log('═══════════════════════════════════════════')
    console.log('📋 [loadOutput] Estado do Pipeline:')
    console.log('  status:', d.status)
    console.log('  hasVideo:', d.hasVideo)
    console.log('  enableMotion:', d.enableMotion)
    console.log('  ── Aprovações ──')
    console.log('  storyOutlineApproved:', d.storyOutlineApproved)
    console.log('  scriptApproved:', d.scriptApproved)
    console.log('  imagesApproved:', d.imagesApproved)
    console.log('  bgmApproved:', d.bgmApproved)
    console.log('  audioApproved:', d.audioApproved)
    console.log('  videosApproved:', d.videosApproved)
    console.log('  renderApproved:', d.renderApproved)
    console.log('  ── Assets ──')
    console.log('  hasScript:', !!d.script)
    console.log('  scenesCount:', d.scenes?.length ?? 0)
    console.log('  scenesWithImages:', d.scenes?.filter((s: any) => s.images?.length > 0).length ?? 0)
    console.log('  scenesWithAudio:', d.scenes?.filter((s: any) => s.audioTracks?.some((a: any) => a.type === 'scene_narration')).length ?? 0)
    console.log('  scenesWithVideos:', d.scenes?.filter((s: any) => s.videos?.length > 0).length ?? 0)
    console.log('  bgmTracks:', d.audioTracks?.filter((a: any) => a.type === 'background_music').length ?? 0)
    console.log('  ── Frontend State ──')
    console.log('  generatingStage:', generatingStage.value)
    console.log('  generationStartedAt:', generationStartedAt.value)
    console.log('  rendering:', rendering.value)
    console.log('  approving:', approving.value)
    console.log('  correctionMode:', correctionMode.value)
    console.log('  canRenderMaster:', d.scriptApproved && d.imagesApproved && d.bgmApproved && d.audioApproved && (d.enableMotion ? d.videosApproved : true))
    console.log('  showRenderTrigger:', (d.scriptApproved && d.imagesApproved && d.bgmApproved && d.audioApproved && (d.enableMotion ? d.videosApproved : true)) && !d.hasVideo)
    console.log('═══════════════════════════════════════════')

    // ── Auto-clear generatingStage quando a geração termina ──
    // Detecta que os assets foram gerados e limpa o loading state
    if (generatingStage.value) {
      const d = data as any
      // Se o output foi atualizado DEPOIS do início da geração, podemos verificar assets
      const outputUpdated = new Date(d.updatedAt).getTime() > generationStartedAt.value
      const shouldClear =
        d.status === 'FAILED' || // Limpar loading em caso de falha
        (generatingStage.value === 'SCRIPT' && d.script && outputUpdated) ||
        (generatingStage.value === 'IMAGES' && d.scenes?.every((s: any) => s.images?.length > 0) && outputUpdated) ||
        (generatingStage.value === 'AUDIO' && d.scenes?.every((s: any) => s.audioTracks?.some((a: any) => a.type === 'scene_narration')) && outputUpdated) ||
        (generatingStage.value === 'BGM' && d.audioTracks?.some((a: any) => a.type === 'background_music') && outputUpdated) ||
        (generatingStage.value === 'MOTION' && d.scenes?.every((s: any) => s.videos?.length > 0) && outputUpdated)
      if (shouldClear) {
        generatingStage.value = null
        generationStartedAt.value = 0
      }
    }

    // Restaurar o nível tonal do hook selecionado (se já foi aprovado)
    if ((data as any).storyOutline?._selectedHookLevel) {
      selectedHookLevel.value = (data as any).storyOutline._selectedHookLevel
    }
    if ((data as any).storyOutline?._customHook) {
      customHookText.value = (data as any).storyOutline._customHook
    }
  } catch (error) {
    console.error('Erro ao carregar output:', error)
  } finally {
    loading.value = false
  }
}

const regeneratingSceneId = ref<string | null>(null)
const restrictedPromptEdits = ref<Record<string, string>>({})
const sanitizingSceneId = ref<string | null>(null)
const sanitizingLevel = ref<string | null>(null)
const lastSanitizeLevel = ref<Record<string, string>>({})

async function sanitizeRestrictedPrompt(scene: any, level: 'intense' | 'moderate' | 'safe') {
  if (sanitizingSceneId.value) return

  // Se 'intense', coloca o prompt original de volta na textarea
  if (level === 'intense') {
    restrictedPromptEdits.value = { ...restrictedPromptEdits.value, [scene.id]: scene.visualDescription }
    delete lastSanitizeLevel.value[scene.id]
    return
  }

  sanitizingSceneId.value = scene.id
  sanitizingLevel.value = level

  try {
    const result = await $fetch(`/api/scenes/${scene.id}/sanitize-prompt`, {
      method: 'POST',
      body: { level }
    }) as any

    // Preencher a textarea com o prompt sanitizado
    restrictedPromptEdits.value = { ...restrictedPromptEdits.value, [scene.id]: result.sanitizedPrompt }
    lastSanitizeLevel.value = { ...lastSanitizeLevel.value, [scene.id]: level }
  } catch (error: any) {
    console.error('Erro ao sanitizar prompt:', error)
    alert('Erro ao reescrever o prompt. Tente novamente.')
  } finally {
    sanitizingSceneId.value = null
    sanitizingLevel.value = null
  }
}

async function retryRestrictedImage(scene: any, mode: 'same' | 'edited') {
  if (regeneratingSceneId.value) return
  regeneratingSceneId.value = scene.id

  const prompt = mode === 'edited' && restrictedPromptEdits.value[scene.id]
    ? restrictedPromptEdits.value[scene.id]
    : scene.visualDescription

  try {
    await $fetch(`/api/scenes/${scene.id}/regenerate-image`, {
      method: 'POST',
      body: { prompt }
    })

    // Sucesso! Limpar edição e recarregar
    delete restrictedPromptEdits.value[scene.id]
    correctedScenes.value = new Set([...correctedScenes.value, scene.id])
    await loadOutput()
    imageVersions.value = { ...imageVersions.value, [scene.id]: Date.now() }

  } catch (error: any) {
    console.error('Erro ao tentar regenerar imagem restrita:', error)

    // Se ainda foi bloqueado, mostrar mensagem específica
    if (error?.data?.data?.code === 'CONTENT_RESTRICTED') {
      handleApiError(error, 'O prompt ainda foi rejeitado pelo filtro de conteúdo. Tente editar o prompt para usar termos mais abstratos.')
    } else {
      handleApiError(error, 'Erro ao regenerar imagem.')
    }
  } finally {
    regeneratingSceneId.value = null
  }
}

// Story Outline
const outlineExpanded = ref(true)
const showOutlineFeedbackModal = ref(false)
const outlineFeedback = ref('')
const outlineSuggestions = ref('') // sugestões na primeira geração do plano
const regeneratingOutline = ref(false)
const selectedHookLevel = ref('moderate') // Nível tonal do hook selecionado pelo usuário
const customHookText = ref('') // Texto do hook personalizado escrito pelo usuário

async function confirmRegenerateOutline() {
  regeneratingOutline.value = true
  try {
    // O backend recupera automaticamente o monetizationContext salvo no Output
    const result = await $fetch(`/api/outputs/${outputId}/generate-outline`, {
      method: 'POST',
      body: { feedback: outlineFeedback.value.trim() || undefined }
    })

    output.value.storyOutline = (result as any).outline
    output.value.storyOutlineApproved = false // novo plano = pendente de aprovação
    showOutlineFeedbackModal.value = false
    outlineFeedback.value = ''
    outlineExpanded.value = true
    selectedHookLevel.value = 'moderate' // Reset ao regenerar
    customHookText.value = '' // Reset hook custom

    await loadOutput()
  } catch (error: any) {
    console.error('Erro ao replanejar narrativa:', error)
    alert(error?.data?.message || 'Erro ao gerar novo plano narrativo.')
  } finally {
    regeneratingOutline.value = false
  }
}

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
/** Detecta render órfão: status=GENERATING mas nenhum render ativo nesta sessão */
const renderStale = ref(false)
let staleCheckTimer: any = null

function startStaleDetection() {
  if (staleCheckTimer) clearTimeout(staleCheckTimer)
  // Se ao carregar a página o status já é GENERATING, aguarda 60s antes de considerar travado
  if (output.value?.status === 'GENERATING' && !rendering.value) {
    staleCheckTimer = setTimeout(() => {
      if (output.value?.status === 'GENERATING' && !rendering.value) {
        console.warn('🔴 Render travado detectado! Status GENERATING há mais de 60s sem render ativo.')
        renderStale.value = true
      }
    }, 60000) // 60 segundos
  }
}

async function cancelStaleRender() {
  try {
    await $fetch(`/api/outputs/${outputId}/cancel`, { method: 'POST' })
    renderStale.value = false
    await loadOutput()
  } catch (e: any) {
    alert('Erro ao cancelar: ' + (e?.data?.message || e?.message))
  }
}
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
  await openRenderOptionsModal('again')
}

// ═══════════════════════════════════════════════════════════
// REVERT TO STAGE — volta para uma etapa anterior
// Desaprova a etapa selecionada e todas as subsequentes.
// Os assets já gerados são mantidos; apenas as flags de aprovação são resetadas.
// ═══════════════════════════════════════════════════════════
const reverting = ref(false)

/** Mapeamento ordenado: stage → campo de aprovação no output */
const STAGE_ORDER: Array<{ stage: string; field: string; label: string }> = [
  { stage: 'STORY_OUTLINE', field: 'storyOutlineApproved', label: 'Plano' },
  { stage: 'SCRIPT', field: 'scriptApproved', label: 'Roteiro' },
  { stage: 'IMAGES', field: 'imagesApproved', label: 'Visual' },
  { stage: 'AUDIO', field: 'audioApproved', label: 'Narração' },
  { stage: 'BGM', field: 'bgmApproved', label: 'Música' },
  { stage: 'MOTION', field: 'videosApproved', label: 'Motion' },
]

async function revertToStage(targetStage: string) {
  if (reverting.value || approving.value) return

  const targetIdx = STAGE_ORDER.findIndex(s => s.stage === targetStage)
  if (targetIdx < 0) return

  const stageInfo = STAGE_ORDER[targetIdx]
  if (!stageInfo) return
  const targetLabel = stageInfo.label
  
  // Identificar quais etapas serão desaprovadas (a etapa clicada + todas as posteriores que estão aprovadas)
  const stagesToRevert = STAGE_ORDER.slice(targetIdx).filter(s => {
    return output.value?.[s.field] === true
  })

  if (stagesToRevert.length === 0) return

  const stageNames = stagesToRevert.map(s => s.label).join(', ')
  if (!confirm(`Voltar para a etapa "${targetLabel}"?\n\nAs seguintes aprovações serão removidas: ${stageNames}.\nOs assets já gerados serão mantidos.`)) return

  reverting.value = true

  try {
    // Desaprovar cada stage sequencialmente (da última para a primeira para consistência)
    for (const stageInfo of [...stagesToRevert].reverse()) {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: stageInfo.stage, approved: false }
      })
      // Atualizar estado local imediatamente
      output.value[stageInfo.field] = false
    }

    // Recarregar dados completos do banco
    await loadOutput()
  } catch (error: any) {
    console.error('Erro ao reverter etapa:', error)
    alert(error?.data?.message || 'Erro ao voltar para a etapa selecionada.')
    // Recarregar para garantir consistência mesmo em caso de erro parcial
    await loadOutput()
  } finally {
    reverting.value = false
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
/** Timestamp (ms) de quando a geração atual foi iniciada — usado para detectar que o backend terminou */
const generationStartedAt = ref<number>(0)
const generatingOutline = ref(false)

// ── Monetization Context (para outline baseado em plano de monetização) ──
const monetizationPlan = ref<any>(null)
const loadingMonetization = ref(false)
const selectedMonetizationItem = ref<{
  itemType: 'teaser' | 'fullVideo'
  title: string
  hook: string
  angle: string
  angleCategory: string
  narrativeRole?: string
  scriptOutline?: string
  cta?: string
  strategicNotes?: string
  scriptStyleId?: string
  scriptStyleName?: string
  editorialObjectiveId?: string
  editorialObjectiveName?: string
  avoidPatterns?: string[]
} | null>(null)

async function loadMonetizationPlan() {
  if (!output.value?.dossierId || monetizationPlan.value) return
  loadingMonetization.value = true
  try {
    const response = await $fetch(`/api/dossiers/${output.value.dossierId}/monetization-plans`) as any
    const plans = response?.data || []
    if (plans.length > 0) {
      // Pegar o plano ativo mais recente
      monetizationPlan.value = plans.find((p: any) => p.isActive) || plans[0]
    }
  } catch (e) {
    // Silencioso — monetização é opcional
    console.debug('[Output] Sem plano de monetização:', e)
  } finally {
    loadingMonetization.value = false
  }
}

function selectMonetizationTeaser(teaser: any, index: number) {
  // Toggle: clicar de novo desmarca
  if (selectedMonetizationItem.value?.title === teaser.title) {
    selectedMonetizationItem.value = null
    return
  }
  selectedMonetizationItem.value = {
    itemType: 'teaser',
    title: teaser.title,
    hook: teaser.hook,
    angle: teaser.angle,
    angleCategory: teaser.angleCategory,
    narrativeRole: teaser.narrativeRole,
    scriptOutline: teaser.scriptOutline,
    cta: teaser.cta,
    strategicNotes: monetizationPlan.value?.planData?.strategicNotes || undefined,
    scriptStyleId: teaser.scriptStyleId,
    scriptStyleName: teaser.scriptStyleName,
    editorialObjectiveId: teaser.editorialObjectiveId,
    editorialObjectiveName: teaser.editorialObjectiveName,
    avoidPatterns: teaser.avoidPatterns
  }
}

function selectMonetizationFullVideo(fullVideo: any) {
  if (selectedMonetizationItem.value?.itemType === 'fullVideo') {
    selectedMonetizationItem.value = null
    return
  }
  selectedMonetizationItem.value = {
    itemType: 'fullVideo',
    title: fullVideo.title,
    hook: fullVideo.hook,
    angle: fullVideo.angle || fullVideo.scriptOutline?.split('→')[0]?.trim() || 'principal',
    angleCategory: fullVideo.angleCategory || 'cronologico',
    scriptOutline: fullVideo.scriptOutline,
    cta: fullVideo.cta,
    strategicNotes: monetizationPlan.value?.planData?.strategicNotes || undefined,
    scriptStyleId: fullVideo.scriptStyleId,
    scriptStyleName: fullVideo.scriptStyleName,
    editorialObjectiveId: fullVideo.editorialObjectiveId,
    editorialObjectiveName: fullVideo.editorialObjectiveName,
    avoidPatterns: fullVideo.avoidPatterns
  }
}

function narrativeRoleBadge(role: string): { label: string; icon: string; color: string } {
  const badges: Record<string, { label: string; icon: string; color: string }> = {
    gateway: { label: 'Porta de Entrada', icon: '🚪', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    'deep-dive': { label: 'Mergulho Direto', icon: '🔍', color: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
    'hook-only': { label: 'Gancho Puro', icon: '💥', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' }
  }
  return badges[role] || { label: role, icon: '📋', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' }
}

async function generateOutlineThenReload() {
  generatingOutline.value = true
  try {
    const body: any = {}
    if (outlineSuggestions.value.trim()) {
      body.feedback = outlineSuggestions.value.trim()
    }
    if (selectedMonetizationItem.value) {
      body.monetizationContext = selectedMonetizationItem.value
    }
    await $fetch(`/api/outputs/${outputId}/generate-outline`, {
      method: 'POST',
      body
    })
    outlineSuggestions.value = ''
    selectedMonetizationItem.value = null
    await loadOutput()
  } catch (e: any) {
    console.error('Erro ao gerar plano:', e)
    alert(e?.data?.message || 'Erro ao gerar plano narrativo.')
  } finally {
    generatingOutline.value = false
  }
}

async function approveStoryOutline() {
  if (approving.value) return
  approving.value = true
  try {
    await $fetch(`/api/outputs/${outputId}/approve-stage`, {
      method: 'PATCH',
      body: {
        stage: 'STORY_OUTLINE',
        approved: true,
        selectedHookLevel: selectedHookLevel.value,
        ...(selectedHookLevel.value === 'custom' && customHookText.value ? { customHook: customHookText.value } : {})
      }
    })
    output.value.storyOutlineApproved = true
    await loadOutput()
  } catch (error) {
    console.error('Erro ao aprovar plano:', error)
    alert('Erro ao aprovar plano.')
  } finally {
    approving.value = false
  }
}

async function startGenerateScript() {
  if (generatingStage.value === 'SCRIPT') return
  generatingStage.value = 'SCRIPT'
  generationStartedAt.value = Date.now()
  try {
    await $fetch(`/api/outputs/${outputId}/generate-script`, { method: 'POST' })
    startPolling()
  } catch (e: any) {
    generatingStage.value = null
    generationStartedAt.value = 0
    alert(e?.data?.message || 'Erro ao iniciar geração do roteiro.')
  }
}

async function generateImages() {
   generatingStage.value = 'IMAGES'
   generationStartedAt.value = Date.now()
   try {
     await $fetch(`/api/outputs/${outputId}/generate-images`, { method: 'POST' })
     startPolling()
   } catch (e: any) {
     generatingStage.value = null
     generationStartedAt.value = 0
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
   generationStartedAt.value = Date.now()
   try {
     const hasExisting = bgmTracks.value.length > 0
     await $fetch(`/api/outputs/${outputId}/generate-background-music`, { 
       method: 'POST',
       body: hasExisting ? { force: true } : undefined
     })
     startPolling()
   } catch (e: any) {
     generatingStage.value = null
     generationStartedAt.value = 0
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
   generationStartedAt.value = Date.now()
   try {
     await $fetch(`/api/outputs/${outputId}/generate-audio`, { method: 'POST' })
     startPolling()
   } catch (e: any) {
     generatingStage.value = null
     generationStartedAt.value = 0
     handleApiError(e, 'Erro ao iniciar geração de áudio')
   }
}

// ── SFX (Sound Effects) ──
const generatingSFX = ref(false)

/** Cenas que possuem audioDescription preenchido */
const hasSFXScenes = computed(() => {
  return output.value?.scenes?.some((s: any) => s.audioDescription?.trim())
})

/** Quantas cenas possuem SFX programado */
const sfxSceneCount = computed(() => {
  return output.value?.scenes?.filter((s: any) => s.audioDescription?.trim()).length || 0
})

/** Todas as cenas com audioDescription já têm scene_sfx gerado */
const allScenesHaveSFX = computed(() => {
  if (!output.value?.scenes) return false
  const sfxScenes = output.value.scenes.filter((s: any) => s.audioDescription?.trim())
  if (sfxScenes.length === 0) return false
  return sfxScenes.every((s: any) => s.audioTracks?.some((a: any) => a.type === 'scene_sfx'))
})

async function generateSFX() {
  if (generatingSFX.value) return
  generatingSFX.value = true
  try {
    await $fetch(`/api/outputs/${outputId}/generate-sfx`, { method: 'POST' })
    // Fire-and-forget — poll para acompanhar
    startPolling()
  } catch (e: any) {
    handleApiError(e, 'Erro ao iniciar geração de SFX')
  } finally {
    // Reset após 3s — SFX é assíncrono, o poll vai atualizar
    setTimeout(() => { generatingSFX.value = false }, 3000)
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

function openChangeVoiceModal() {
  // Inicializar WPM com o valor atual do output
  newTargetWPM.value = output.value.targetWPM || 150
  showChangeVoiceModal.value = true
}

async function confirmChangeVoice() {
  const sameVoice = newVoiceId.value === output.value.voiceId
  const sameWPM = newTargetWPM.value === (output.value.targetWPM || 150)
  if (!newVoiceId.value || (sameVoice && sameWPM)) return

  showChangeVoiceModal.value = false
  changingVoice.value = true
  generatingStage.value = 'AUDIO'
  generationStartedAt.value = Date.now()

  try {
    const result = await $fetch(`/api/outputs/${outputId}/change-voice`, {
      method: 'POST',
      body: { voiceId: newVoiceId.value, targetWPM: newTargetWPM.value }
    })

    console.log('Troca de voz iniciada:', result)

    // Atualizar voiceId e targetWPM locais
    output.value.voiceId = newVoiceId.value
    output.value.targetWPM = newTargetWPM.value

    // Iniciar polling para acompanhar geração
    startPolling()
  } catch (error: any) {
    generatingStage.value = null
    generationStartedAt.value = 0
    const msg = error?.data?.message || error?.message || 'Erro desconhecido'
    alert(`Erro ao trocar narrador: ${msg}`)
  } finally {
    changingVoice.value = false
    newVoiceId.value = null
  }
}

async function generateMotion() {
   generatingStage.value = 'MOTION'
   generationStartedAt.value = Date.now()
   try {
     await $fetch(`/api/outputs/${outputId}/generate-motion`, { method: 'POST' })
     startPolling()
   } catch (e: any) {
     generatingStage.value = null
     generationStartedAt.value = 0
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

async function openRenderOptionsModal(action: 'master' | 'again', options?: { beforeRender?: () => Promise<void> }) {
  renderAction.value = action
  pendingBeforeRender.value = options?.beforeRender ?? null
  try {
    const stylesData = await $fetch(`/api/outputs/${outputId}/caption-styles`)
    captionStyles.value = stylesData.styles
    renderCaptionStyleId.value = stylesData.recommendedStyleId
  } catch (e) {
    captionStyles.value = []
    renderCaptionStyleId.value = null
  }
  // Inicializar volume do background com valores do script
  renderAdjustVolume.value = false
  renderBgmVolumeGlobal.value = output.value?.script?.backgroundMusicVolume ?? -18
  const perTrack: Record<number, number> = {}
  if (output.value?.script?.backgroundMusicTracks?.length) {
    for (const [idx, track] of output.value.script.backgroundMusicTracks.entries()) {
      perTrack[idx] = track.volume ?? -18
    }
  }
  renderBgmVolumePerTrack.value = perTrack
  showRenderOptionsModal.value = true
}

async function confirmRenderWithOptions() {
  if (rendering.value) return
  if (renderIncludeCaptions.value && !renderCaptionStyleId.value) return

  pendingRenderOptions.value = {
    includeLogo: renderIncludeLogo.value,
    includeCaptions: renderIncludeCaptions.value,
    captionStyleId: renderIncludeCaptions.value ? renderCaptionStyleId.value : null,
    ...(renderAdjustVolume.value && hasBgmData.value ? {
      volumeOverride: output.value?.script?.backgroundMusicTracks?.length
        ? { perTrack: { ...renderBgmVolumePerTrack.value } }
        : { global: renderBgmVolumeGlobal.value }
    } : {})
  }
  const beforeRender = pendingBeforeRender.value
  pendingBeforeRender.value = null
  showRenderOptionsModal.value = false

  if (beforeRender) {
    try {
      await beforeRender()
    } catch (e: any) {
      console.error('Erro no passo anterior ao render:', e)
      alert(e?.data?.message || e?.message || 'Erro ao preparar renderização.')
      pendingRenderOptions.value = null
      return
    }
  }
  await doStartRender()
}

async function doStartRender() {
  rendering.value = true
  const opts = pendingRenderOptions.value
  if (opts) pendingRenderOptions.value = null
  try {
    await $fetch(`/api/outputs/${outputId}/render`, {
      method: 'POST',
      body: opts ? {
        includeLogo: opts.includeLogo,
        includeCaptions: opts.includeCaptions,
        captionStyleId: opts.captionStyleId ?? undefined,
        volumeOverride: opts.volumeOverride ?? undefined
      } : undefined
    })
    output.value.status = 'GENERATING'
    startPolling()
  } catch (error) {
    alert('Erro ao iniciar renderização.')
  } finally {
    rendering.value = false
  }
}

async function renderMaster() {
  if (rendering.value) return
  await openRenderOptionsModal('master')
}

async function approveRender() {
  if (approving.value) return
  approving.value = true

  try {
    await $fetch(`/api/outputs/${outputId}/approve-stage`, {
      method: 'PATCH',
      body: { stage: 'RENDER', approved: true }
    })
    
    output.value.renderApproved = true
    output.value.status = 'COMPLETED'
    await loadOutput()
  } catch (error) {
    alert('Erro ao aprovar renderização.')
  } finally {
    approving.value = false
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

// BGM Tracks filtradas dos audioTracks
const bgmTracks = computed(() => {
    if (!output.value?.audioTracks) return []
    return output.value.audioTracks
      .filter((a: any) => a.type === 'background_music')
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
})

// Retorna os metadados da track de música do roteiro correspondente ao índice da BGM gerada
function getBgmTrackMeta(idx: number): any {
    const scriptTracks = output.value?.script?.backgroundMusicTracks
    if (!scriptTracks?.length) return null
    return scriptTracks[idx] || null
}

// Retorna o prompt da track: do roteiro (backgroundMusicTracks) ou do prompt único
function getBgmTrackPrompt(idx: number): string | null {
    const meta = getBgmTrackMeta(idx)
    if (meta?.prompt) return meta.prompt
    // Se é música única (video todo), usar o prompt do script
    if (bgmTracks.value.length === 1 && output.value?.script?.backgroundMusicPrompt) {
        return output.value.script.backgroundMusicPrompt
    }
    return null
}

// Helper para Render Button visibility
const canRenderMaster = computed(() => {
    if (!output.value) return false
    const base = output.value.scriptApproved && output.value.imagesApproved && output.value.bgmApproved && output.value.audioApproved
    if (output.value.enableMotion) {
        return base && output.value.videosApproved
    }
    return base
})

/**
 * Detecta se o render está realmente em andamento.
 * 
 * Usa apenas o flag local. O status GENERATING residual é tratado no backend:
 * approve-stage.patch.ts reseta o status para PENDING quando o GENERATING
 * não pertence a um render ativo.
 */
const isRenderingActive = computed(() => rendering.value)

function getStepClass(isCompleted: boolean, isPreviousCompleted: boolean) {
  if (isCompleted) return 'completed cursor-pointer hover:bg-white/5'
  if (isPreviousCompleted) return 'active'
  return 'pending'
}

function getStatusClass(status: string) {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    case 'RENDERED': return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    case 'FAILED': return 'bg-red-500/10 text-red-400 border-red-500/30'
    case 'PROCESSING': return 'bg-primary/10 text-blue-400 border-blue-500/30 animate-pulse'
    case 'PENDING': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
    case 'GENERATING': return 'bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse'
    default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
  }
}

let pollTimer: any = null
function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (!output.value) return
    // Polling ativo quando: status indica processamento OU uma geração está em andamento
    const statusNeedsPolling = output.value.status === 'PROCESSING' || output.value.status === 'PENDING' || output.value.status === 'GENERATING'
    const generationInProgress = !!generatingStage.value
    if (statusNeedsPolling || generationInProgress) {
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

onMounted(async () => {
  await loadOutput()
  loadCosts()
  loadMonetizationPlan()
  startPolling()
  startStaleDetection()
})
onUnmounted(() => {
  stopPolling()
  if (staleCheckTimer) clearTimeout(staleCheckTimer)
})

const selectedImage = ref<string | null>(null)
function openImage(id: string) {
  selectedImage.value = id
}

/** Retorna a imagem selecionada (isSelected=true) da cena, ou a primeira como fallback */
function getSelectedImage(scene: any) {
  if (!scene.images?.length) return null
  return scene.images.find((img: any) => img.isSelected) || scene.images[0]
}

/** Retorna o vídeo selecionado (isSelected=true) da cena, ou o primeiro como fallback */
function getSelectedVideo(scene: any) {
  if (!scene.videos?.length) return null
  return scene.videos.find((v: any) => v.isSelected) || scene.videos[0]
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

.pipeline-step.completed:hover {
  @apply bg-amber-500/10 border-amber-500/30 text-amber-400;
}

.pipeline-step.pending {
  @apply opacity-50;
}

/* Ícone swap: mostra o ícone do step normalmente, troca por undo no hover */
.step-icon {
  display: block;
  transition: opacity 0.2s;
}
.step-undo-icon {
  display: none;
  transition: opacity 0.2s;
}
.pipeline-step.completed:hover .step-icon {
  display: none;
}
.pipeline-step.completed:hover .step-undo-icon {
  display: block;
}

.shadow-glow-orange {
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.2);
}
</style>
