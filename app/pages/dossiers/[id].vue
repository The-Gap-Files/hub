<template>
  <div class="min-h-screen bg-oled-black pb-20 selection:bg-primary/30">
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[80vh] space-y-6">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
        <div class="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-1 h-1 bg-primary rounded-full animate-ping"></div>
        </div>
      </div>
      <div class="text-center space-y-2">
        <p class="text-lg font-black tracking-tighter text-white uppercase animate-pulse">Sincronizando Dossier...</p>
        <p class="text-xs font-mono text-muted-foreground uppercase tracking-widest">Protocolo Antigravity v4.0</p>
      </div>
    </div>

    <div v-else-if="dossier" class="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <!-- Header Imersivo UI-UX Pro Max -->
      <header class="relative mb-12 group">
        <div class="absolute -inset-4 bg-gradient-to-r from-primary/5 via-blue-500/5 to-purple-500/5 blur-3xl rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        
        <div class="relative flex flex-col md:flex-row justify-between items-end gap-8 pb-8 border-b border-white/10">
          <div class="flex-1 space-y-4">
            <div class="flex items-center gap-3">
              <span class="mono-label px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md text-primary">Ativo</span>
              <span v-if="dossier.category" class="mono-label text-muted-foreground">{{ dossier.category }}</span>
              <span class="text-muted-foreground/30 px-2">•</span>
              <span class="mono-label text-muted-foreground">{{ formatDate(dossier.updatedAt) }}</span>
            </div>
            
            <h1 class="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
              {{ dossier.title }}
            </h1>
            
            <p class="text-xl text-muted-foreground max-w-3xl font-medium leading-relaxed">
              {{ dossier.theme }}
            </p>
            
            <div class="flex flex-wrap gap-2 pt-2">
              <span v-for="tag in dossier.tags" :key="tag" 
                    class="px-3 py-1 bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-white/10 transition-colors cursor-default">
                #{{ tag }}
              </span>
            </div>
          </div>
          
          <div class="flex items-center gap-4">
             <NuxtLink to="/dossiers" class="btn-secondary group/btn">
               <span class="flex items-center gap-2">
                 <ArrowLeft :size="18" class="group-hover/btn:-translate-x-1 transition-transform" />
                 Voltar
               </span>
             </NuxtLink>
             <button @click="showOutputGenerator = true" class="btn-primary group/btn px-10">
               <span class="flex items-center gap-2">
                 <Zap :size="20" class="fill-current" />
                 GERAR VÍDEO
               </span>
             </button>
          </div>
        </div>
      </header>



      <!-- SEÇÃO 2: Workspace Navigation -->
      <div class="flex flex-wrap items-center gap-4 mb-10">
        <button v-for="tab in workspaceTabs" :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 border flex items-center gap-2',
            activeTab === tab.id 
              ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.25)]' 
              : 'bg-white/5 text-muted-foreground border-white/10 hover:border-white/20 hover:text-white'
          ]"
        >
          <component :is="tab.icon" :size="16" />
          {{ tab.name }}
          <span v-if="tab.id === 'outputs' && dossier.outputsCount" class="ml-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
            {{ dossier.outputsCount }}
          </span>
        </button>
      </div>

      <!-- SEÇÃO 3: Content Displays -->
      <main class="animate-in fade-in slide-in-from-top-4 duration-700">
        <!-- Workspace: Context (Dossier Processing) -->
        <div v-show="activeTab === 'dashboard'" class="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <!-- Main Source Text -->
          <div class="lg:col-span-8 space-y-10">
            <section class="glass-card p-1">
              <div class="p-8 pb-4 flex justify-between items-center border-b border-white/5">
                <div class="flex items-center gap-3">
                   <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                     <FileText :size="20" />
                   </div>
                   <h3 class="text-sm font-black uppercase tracking-widest text-white">Documento Primário</h3>
                </div>
                <button class="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Refinar Conteúdo</button>
              </div>
              <div class="p-8">
                <div class="prose prose-invert max-w-none text-zinc-400 font-sans leading-relaxed max-h-[600px] overflow-y-auto pr-6 custom-scrollbar">
                   <pre class="whitespace-pre-wrap font-sans text-lg tracking-tight">{{ dossier.sourceText }}</pre>
                </div>
              </div>
            </section>
            
            <DossierSources 
              :dossier-id="dossierId" 
              :initial-sources="dossier.sources || []" 
              @updated="loadDossier"
            />
          </div>

          <!-- Semantic Data Column -->
          <div class="lg:col-span-4 space-y-10">
            <!-- NOVO: Universo Visual Editável -->
            <section class="glass-card p-1">
              <div class="p-6 pb-4 flex justify-between items-center border-b border-white/5">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <Palette :size="20" />
                  </div>
                  <h3 class="text-sm font-black uppercase tracking-widest text-white">Universo Visual</h3>
                </div>
                <button 
                  v-if="!editingVisualSettings"
                  @click="startEditingVisualSettings"
                  class="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                  Editar
                </button>
              </div>
              
              <div class="p-6 space-y-6">
                <!-- Modo Visualização -->
                <div v-if="!editingVisualSettings" class="space-y-4">
                  <div class="space-y-2">
                    <label class="mono-label !text-[9px] text-zinc-500">Estilo Visual</label>
                    <p class="text-sm text-white font-medium">
                      {{ getVisualStyleName(dossier.preferredVisualStyleId) || 'Nenhum definido' }}
                    </p>
                  </div>
                  
                  <div class="space-y-2">
                    <label class="mono-label !text-[9px] text-zinc-500">DNA (Seed)</label>
                    <p class="text-sm text-white font-medium font-mono">
                      {{ getSeedValue(dossier.preferredSeedId) || 'Aleatória' }}
                    </p>
                  </div>
                  
                  <div v-if="dossier.visualIdentityContext" class="space-y-2">
                    <label class="mono-label !text-[9px] text-zinc-500">Diretrizes de Identidade</label>
                    <p class="text-xs text-zinc-400 italic leading-relaxed">
                      "{{ dossier.visualIdentityContext }}"
                    </p>
                  </div>
                </div>
                
                <!-- Modo Edição -->
                <div v-else class="space-y-6">
                  <div class="space-y-3">
                    <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
                      <Palette :size="12" />
                      Estilo Visual Direcionador
                    </label>
                    <select 
                      v-model="visualSettingsForm.preferredVisualStyleId"
                      class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-primary outline-none transition-all shadow-inner appearance-none cursor-pointer">
                      <option value="" class="bg-[#0A0A0F]">Nenhum (Usar sistema)</option>
                      <option 
                        v-for="style in visualStyles" 
                        :key="style.id" 
                        :value="style.id"
                        class="bg-[#0A0A0F]">
                        {{ style.name }}
                      </option>
                    </select>
                  </div>
                  
                  <div class="space-y-3">
                    <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
                      <Dna :size="12" />
                      Assinatura Genética (Seed)
                    </label>
                    <select 
                      v-model="visualSettingsForm.preferredSeedId"
                      class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-primary outline-none transition-all shadow-inner appearance-none cursor-pointer">
                      <option value="" class="bg-[#0A0A0F]">Gerar Nova Seed Aleatória</option>
                      <option 
                        v-for="seed in allSeeds" 
                        :key="seed.id" 
                        :value="seed.id"
                        class="bg-[#0A0A0F]">
                        DNA {{ seed.value }}
                      </option>
                    </select>
                  </div>
                  
                  <div class="space-y-3">
                    <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
                      <AlertTriangle :size="12" />
                      Diretrizes de Identidade
                    </label>
                    <textarea
                      v-model="visualSettingsForm.visualIdentityContext"
                      rows="3"
                      class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-primary outline-none transition-all shadow-inner resize-none custom-scrollbar"
                      placeholder="Ex: Este dossiê pertence a um universo Noir. Evite cores vibrantes...">
                    </textarea>
                  </div>
                  
                  <!-- Botões de Ação -->
                  <div class="flex gap-3 pt-4 border-t border-white/5">
                    <button 
                      @click="saveVisualSettings"
                      :disabled="savingVisualSettings"
                      class="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      <span v-if="!savingVisualSettings">Salvar</span>
                      <span v-else class="flex items-center gap-2">
                        <div class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Salvando...
                      </span>
                    </button>
                    <button 
                      @click="cancelEditingVisualSettings"
                      :disabled="savingVisualSettings"
                      class="px-4 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50">
                      Cancelar
                    </button>
                  </div>
                  
                  <!-- Mensagem de Sucesso -->
                  <div v-if="visualSettingsSaved" 
                       class="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                    <div class="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                      <div class="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                    <span class="text-[10px] font-bold text-green-500 uppercase tracking-wider">
                      Configurações visuais atualizadas com sucesso!
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <DossierNotes 
              :dossier-id="dossierId" 
              :initial-notes="dossier.notes || []" 
              @updated="loadDossier" 
            />
            
            <DossierImages 
              :dossier-id="dossierId" 
              :initial-images="dossier.images || []" 
              @updated="loadDossier"
            />
          </div>
        </div>

        <!-- Workspace: Production Outputs -->
        <div v-show="activeTab === 'outputs'">
          <DossierOutputs 
            ref="outputsComponent"
            :dossier-id="dossierId" 
            @open-generator="showOutputGenerator = true"
          />
        </div>
      </main>

      <!-- SEÇÃO 4: Modals (Cyberpunk Style) -->
      <div v-if="showOutputGenerator"
        class="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[100] p-4 sm:p-8"
        @click.self="showOutputGenerator = false">
        
        <div class="glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-500 border-primary/20 shadow-glow">
          <button @click="showOutputGenerator = false" class="absolute top-8 right-8 text-white/50 hover:text-white">
            <X :size="32" stroke-width="1.5" />
          </button>

          <div class="p-12">
            <div class="mb-12 space-y-2">
               <div class="flex items-center gap-2 text-primary">
                 <Zap :size="24" />
                 <span class="mono-label text-primary">Engine: Antigravity Orchestrator</span>
               </div>
               <h2 class="text-5xl font-black text-white tracking-tighter uppercase">Iniciar Produção</h2>
               <p class="text-zinc-500 font-medium">Selecione os vetores de produção para injetar no pipeline.</p>
            </div>

            <!-- NOVO: Contexto de Universo Visual -->
            <div v-if="dossier?.visualIdentityContext" class="mb-10 p-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-start gap-4 animate-pulse-slow">
              <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500 shrink-0">
                <Palette :size="20" />
              </div>
              <div class="space-y-1">
                <p class="text-[10px] font-black uppercase tracking-widest text-purple-400">Diretriz do Universo</p>
                <p class="text-sm text-purple-200/80 italic font-medium">"{{ dossier.visualIdentityContext }}"</p>
              </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div class="space-y-10">
                <!-- Passo 1: Formatos -->
                <div class="space-y-6">
                  <header class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-[10px] font-black border border-white/10">01</div>
                    <label class="mono-label !text-zinc-400">Dimensões & Formatos</label>
                  </header>
                  
                  <div class="grid grid-cols-1 gap-3">
                    <label v-for="fmt in formats" :key="fmt.id"
                      class="relative group cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-300"
                      :class="[selectedFormats.includes(fmt.id) ? 'border-primary bg-primary/5' : 'border-white/5 bg-white/5 hover:border-white/20']">
                      <input type="checkbox" v-model="selectedFormats" :value="fmt.id" class="hidden" @change="onFormatToggle(fmt)" />
                      <div class="p-5">
                        <div class="flex items-start gap-4 mb-4">
                          <div class="w-10 h-10 rounded-xl flex items-center justify-center border transition-all"
                               :class="selectedFormats.includes(fmt.id) ? 'bg-primary border-primary text-white shadow-glow' : 'bg-white/5 border-white/10 text-white/30'">
                             <component :is="fmt.icon" :size="20" />
                          </div>
                          <div class="flex-1">
                            <p class="font-black text-white uppercase text-xs tracking-wider">{{ fmt.name }}</p>
                            <p class="text-[9px] font-mono text-zinc-500 mt-0.5">{{ fmt.details }}</p>
                          </div>
                        </div>
                        
                        <!-- Duration Slider (inline quando selecionado) -->
                        <div v-if="selectedFormats.includes(fmt.id)" 
                             class="pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div class="flex items-center gap-3 mb-2">
                            <Gauge :size="12" class="text-zinc-500" />
                            <span class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex-1">Duração</span>
                            <span class="text-xs font-mono text-white">{{ Math.floor((formatDurations[fmt.id] || 0) / 60) }}:{{ String((formatDurations[fmt.id] || 0) % 60).padStart(2, '0') }}</span>
                          </div>
                          <input 
                            type="range" 
                            v-model.number="formatDurations[fmt.id]"
                            min="10"
                            :max="fmt.maxDuration || 300"
                            step="5"
                            class="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary 
                                   [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:cursor-pointer
                                   [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                                   [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full 
                                   [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 
                                   [&::-moz-range-thumb]:shadow-glow [&::-moz-range-thumb]:cursor-pointer"
                          />
                          <div class="flex items-center justify-between mt-1">
                            <span class="text-[8px] text-zinc-600 font-mono">10s</span>
                            <button 
                              v-if="formatDurations[fmt.id] !== fmt.defaultDuration"
                              @click.stop="formatDurations[fmt.id] = fmt.defaultDuration"
                              class="text-[8px] text-primary/60 hover:text-primary font-bold uppercase tracking-wider transition-colors">
                              Padrão ({{ fmt.defaultDuration }}s)
                            </button>
                            <span class="text-[8px] text-zinc-600 font-mono">{{ fmt.id === 'full-youtube' ? '60m' : '5m' }}</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Passo 2: Estilo Narrativo (Movido para Coluna 1) -->
                <div class="space-y-6 pt-6 border-t border-white/5">
                  <header class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-[10px] font-black border border-white/10">02</div>
                    <label class="mono-label !text-zinc-400">Narrativa</label>
                  </header>
                  <div class="grid grid-cols-1 gap-2">
                    <button v-for="style in scriptStyles" :key="style.id"
                      @click="selectedScriptStyle = style.id"
                      class="px-5 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-left transition-all border"
                      :class="[selectedScriptStyle === style.id ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20 hover:text-white']">
                      {{ style.name }}
                    </button>
                  </div>
                </div>

                <!-- Passo 3: Estilo Visual (Movido para Coluna 1) -->
                <div class="space-y-6 pt-6 border-t border-white/5">
                  <header class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-[10px] font-black border border-white/10">03</div>
                    <label class="mono-label !text-zinc-400">Direção Visual</label>
                  </header>
                  
                  <!-- Alerta de inconsistência se mudar o estilo preferido -->
                  <div v-if="dossier?.preferredVisualStyleId && selectedVisualStyle !== dossier.preferredVisualStyleId" 
                       class="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                    <AlertTriangle :size="14" class="text-yellow-500" />
                    <span class="text-[9px] font-bold text-yellow-500 uppercase tracking-tighter">Cuidado: Esta seleção foge do padrão visual definido no Dossier.</span>
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <button v-for="style in visualStyles" :key="style.id"
                      @click="selectedVisualStyle = style.id"
                      class="px-5 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-left transition-all border relative"
                      :class="[selectedVisualStyle === style.id ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20 hover:text-white']">
                      {{ style.name }}
                      <span v-if="style.id === dossier?.preferredVisualStyleId" class="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] bg-white/10 px-1.5 py-0.5 rounded-md">DNA</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="space-y-10">
                <!-- Passo 04: Configurações Adicionais (Agora no topo da Coluna 2) -->
                <div class="space-y-6">
                  <header class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-[10px] font-black border border-white/10">04</div>
                    <label class="mono-label !text-zinc-400">Inteligência Adicional</label>
                  </header>

                    <!-- Toggle Motion -->
                    <label class="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all group">
                      <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <Wind :size="20" />
                        </div>
                        <div>
                          <p class="text-xs font-black text-white uppercase tracking-wider">Habilitar Motion (IA)</p>
                          <p class="text-[9px] text-zinc-500 uppercase font-mono">Animação de imagens via Runway/SVD</p>
                        </div>
                      </div>
                      <div class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" v-model="enableMotion" class="sr-only peer">
                        <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-500 after:border-zinc-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white peer-checked:after:border-white"></div>
                      </div>
                    </label>

                    <!-- Velocidade da Fala -->
                    <div class="space-y-4">
                      <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
                        <Gauge :size="12" />
                        Velocidade da Narração (WPM)
                      </label>
                      <div class="grid grid-cols-3 gap-2">
                        <button v-for="wpm in [120, 150, 180]" :key="wpm"
                          @click="selectedWPM = wpm"
                          class="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border"
                          :class="[selectedWPM === wpm ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/10']">
                          {{ wpm === 120 ? 'Lento' : wpm === 150 ? 'Normal' : 'Rápido' }}
                          <span class="block text-[8px] opacity-50 mt-0.5">{{ wpm }} WPM</span>
                        </button>
                      </div>
                    </div>

                  <!-- Voice Selection -->
                  <VoiceSelector 
                    v-model="selectedVoiceId" 
                    :initial-voices="availableVoices"
                    :initial-cursor="initialVoiceCursor"
                  />

                  <!-- Passo 05: Objetivo Editorial -->
                  <div class="space-y-4 pt-6 border-t border-white/5">
                    <header class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-[10px] font-black border border-white/10">05</div>
                      <label class="mono-label !text-zinc-400">Objetivo Editorial</label>
                    </header>
                    
                    <p class="text-[9px] text-zinc-600 uppercase tracking-wider font-mono">Define a intenção narrativa do vídeo. Opcional mas recomendado.</p>

                    <div class="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                      <!-- Opção: Nenhum -->
                      <button
                        @click="selectedObjectiveId = ''; customObjective = ''"
                        class="px-4 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest text-left transition-all border flex items-center gap-3"
                        :class="[!selectedObjectiveId ? 'bg-zinc-600 border-zinc-500 text-white' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20 hover:text-white']">
                        <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <X :size="12" />
                        </div>
                        Sem diretriz específica
                      </button>

                      <!-- Presets -->
                      <button 
                        v-for="obj in editorialObjectives" 
                        :key="obj.id"
                        @click="selectedObjectiveId = obj.id; customObjective = ''"
                        class="px-4 py-3 rounded-xl text-left transition-all border group/obj"
                        :class="[selectedObjectiveId === obj.id ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_15px_rgba(217,119,6,0.2)]' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20 hover:text-white']">
                        <div class="flex items-center gap-3">
                          <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                               :class="selectedObjectiveId === obj.id ? 'bg-white/20' : 'bg-white/5'">
                            <component :is="objectiveIconMap[obj.icon] || Target" :size="12" />
                          </div>
                          <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-black uppercase tracking-widest">{{ obj.name }}</p>
                            <p class="text-[8px] opacity-60 mt-0.5 truncate">{{ obj.description }}</p>
                          </div>
                        </div>
                      </button>

                      <!-- Opção Custom -->
                      <button
                        @click="selectedObjectiveId = 'custom'"
                        class="px-4 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest text-left transition-all border flex items-center gap-3"
                        :class="[selectedObjectiveId === 'custom' ? 'bg-primary border-primary text-white shadow-glow' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20 hover:text-white']">
                        <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                             :class="selectedObjectiveId === 'custom' ? 'bg-white/20' : 'bg-white/5'">
                          <PenLine :size="12" />
                        </div>
                        Escrever meu próprio objetivo
                      </button>
                    </div>

                    <!-- Campo de texto custom -->
                    <div v-if="selectedObjectiveId === 'custom'" class="animate-in fade-in slide-in-from-top-2 duration-300">
                      <textarea
                        v-model="customObjective"
                        rows="3"
                        class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all resize-none custom-scrollbar"
                        placeholder="Ex: Este vídeo deve revelar a verdade oculta sobre o assunto, sem rodeios, usando provas concretas..."
                      ></textarea>
                    </div>

                    <!-- Preview da instrução selecionada -->
                    <div v-if="selectedObjectiveId && selectedObjectiveId !== 'custom' && resolvedObjective" 
                         class="px-4 py-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                      <p class="text-[8px] font-black uppercase tracking-widest text-amber-500/60 mb-1">Preview da diretriz:</p>
                      <p class="text-[10px] text-amber-200/60 italic leading-relaxed line-clamp-3">"{{ resolvedObjective }}"</p>
                    </div>
                  </div>

                  <!-- Seed (Movido para fim da Coluna 2) -->
                  <div class="space-y-4 pt-4 border-t border-white/5">
                    <label class="mono-label !text-[9px] text-zinc-500 flex items-center gap-2">
                      <Dna :size="12" />
                      Assinatura Genética (DNA)
                    </label>

                    <!-- Alerta de inconsistência de Seed -->
                    <div v-if="dossier?.preferredSeedId && selectedSeed !== dossier.preferredSeedId" 
                         class="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                      <AlertTriangle :size="14" class="text-yellow-500" />
                      <span class="text-[9px] font-bold text-yellow-500 uppercase tracking-tighter">
                        Cuidado: Alterar o DNA afetará a consistência de geração.
                      </span>
                    </div>

                    <select 
                      v-model="selectedSeed"
                      class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-purple-500 transition-all shadow-inner"
                    >
                      <option value="" class="bg-[#0A0A0F] text-zinc-400">Aleatória (DNA Fixado no Render)</option>
                      <option v-for="seed in allSeeds" :key="seed.id" :value="seed.id" class="bg-[#0A0A0F] text-white">
                        DNA {{ seed.value }} {{ seed.id === dossier?.preferredSeedId ? '(Padrão do Dossier)' : '' }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Warning: Voice Required -->
            <div v-if="!selectedVoiceId" 
                 class="mt-10 px-6 py-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2">
              <AlertTriangle :size="20" class="text-yellow-500 shrink-0" />
              <div class="flex-1">
                <p class="text-sm font-bold text-yellow-500 uppercase tracking-wider">Voz Obrigatória</p>
                <p class="text-xs text-yellow-500/80 mt-1">Selecione uma voz da lista ou cole um Voice ID manualmente para continuar.</p>
              </div>
            </div>

            <div class="mt-20 pt-10 border-t border-white/10 flex flex-col sm:flex-row gap-6">
              <button @click="generateOutputs"
                :disabled="selectedFormats.length === 0 || generatingOutputs || !selectedScriptStyle || !selectedVisualStyle || !selectedVoiceId"
                class="btn-primary py-6 rounded-3xl text-2xl font-black flex-1 shadow-glow group/go disabled:opacity-50 disabled:cursor-not-allowed">
                <span v-if="!generatingOutputs" class="flex items-center justify-center gap-4">
                  INJETAR PIPELINE
                  <ChevronRight :size="32" class="group-hover/go:translate-x-2 transition-transform" />
                </span>
                <span v-else class="flex items-center justify-center gap-4">
                  <div class="animate-spin rounded-full h-8 w-8 border-4 border-white/20 border-t-white"></div>
                  PIPELINE EM EXECUÇÃO...
                </span>
              </button>
              <button @click="showOutputGenerator = false" 
                      class="btn-secondary px-10 rounded-3xl text-sm font-black uppercase text-zinc-500">
                Abortar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  ArrowLeft, Zap, FileText, Database, Palette, AlertTriangle, Dna,
  LayoutDashboard, PlayCircle, X, 
  ChevronRight, Smartphone, Monitor, Instagram, Wind, Gauge,
  Target, Eye, EyeOff, Clock, Layers, BookOpen, GraduationCap, Heart, Flame, Swords, PenLine
} from 'lucide-vue-next'
import DossierSources from '~/components/dossier/DossierSources.vue'
import DossierImages from '~/components/dossier/DossierImages.vue'
import DossierNotes from '~/components/dossier/DossierNotes.vue'
import DossierOutputs from '~/components/dossier/DossierOutputs.vue'
import VoiceSelector from '~/components/dossier/VoiceSelector.vue'


const route = useRoute()
const dossierId = route.params.id as string

const dossier = ref<any>(null)
const loading = ref(true)
const activeTab = ref('dashboard')
const showOutputGenerator = ref(false)
const selectedFormats = ref<string[]>([])
const formatDurations = ref<Record<string, number>>({})
const selectedScriptStyle = ref('')
const selectedVisualStyle = ref('')
const selectedSeed = ref('')
const selectedWPM = ref(150)
const selectedVoiceId = ref('')
const enableMotion = ref(true)
const generatingOutputs = ref(false)
const selectedObjectiveId = ref('')
const customObjective = ref('')
const editorialObjectives = ref<any[]>([])

const availableVoices = ref<any[]>([])
const initialVoiceCursor = ref<string | undefined>(undefined)

const scriptStyles = ref<any[]>([])
const visualStyles = ref<any[]>([])
const allSeeds = ref<any[]>([])
const outputsComponent = ref<any>(null)

// Estados para edição de configurações visuais
const editingVisualSettings = ref(false)
const savingVisualSettings = ref(false)
const visualSettingsSaved = ref(false)
const visualSettingsForm = ref({
  preferredVisualStyleId: '',
  preferredSeedId: '',
  visualIdentityContext: ''
})

// Computed para o estado do pipeline baseado no dossier


const workspaceTabs = [
  { id: 'dashboard', name: 'Intelligence Context', icon: Database },
  { id: 'outputs', name: 'Production Pipeline', icon: PlayCircle }
]

const videoFormatsRaw = ref<any[]>([])

// Resolve o objetivo editorial: usa o custom se 'custom' selecionado, senão usa a instruction do preset
const resolvedObjective = computed(() => {
  if (selectedObjectiveId.value === 'custom') {
    return customObjective.value.trim()
  }
  if (selectedObjectiveId.value) {
    const preset = editorialObjectives.value.find((o: any) => o.id === selectedObjectiveId.value)
    return preset?.instruction || ''
  }
  return ''
})

// Mapeia nomes de ícones para componentes
const objectiveIconMap: Record<string, any> = {
  Eye, EyeOff, Clock, Layers, BookOpen, GraduationCap, Heart, Flame, Swords
}

const formats = computed(() => {
  return videoFormatsRaw.value.map(f => {
    let icon = Monitor
    if (f.platform === 'Instagram') icon = Instagram
    else if (f.orientation === 'VERTICAL') icon = Smartphone
    return {
      ...f,
      icon,
      details: `${f.aspectRatio} • ${f.orientation}`
    }
  })
})

async function loadDossier() {
  try {
    const data = await $fetch(`/api/dossiers/${dossierId}`)
    dossier.value = data
  } catch (error) {
    console.error('Erro ao carregar dossier:', error)
  } finally {
    loading.value = false
  }
}

async function loadStyles() {
  try {
    const [scriptsRes, visualsRes, seedsRes, voicesRes, formatsRes, objectivesRes] = await Promise.all([
      $fetch('/api/script-styles'),
      $fetch('/api/visual-styles'),
      $fetch('/api/seeds'),
      $fetch('/api/voices'),
      $fetch('/api/video-formats'),
      $fetch('/api/editorial-objectives')
    ])
    scriptStyles.value = (scriptsRes as any).data || []
    visualStyles.value = (visualsRes as any).data || []
    allSeeds.value = (seedsRes as any).data || []
    videoFormatsRaw.value = (formatsRes as any).data || []
    editorialObjectives.value = (objectivesRes as any).data || []
    availableVoices.value = (voicesRes as any).voices || []
    initialVoiceCursor.value = (voicesRes as any).nextCursor
    
    // Configurar padrões baseados nas preferências do dossiê
    if (scriptStyles.value.length > 0) {
      selectedScriptStyle.value = scriptStyles.value[0].id
    }

    if (dossier.value?.preferredVisualStyleId) {
      selectedVisualStyle.value = dossier.value.preferredVisualStyleId
    } else if (visualStyles.value.length > 0) {
      selectedVisualStyle.value = visualStyles.value[0].id
    }

    if (dossier.value?.preferredSeedId) {
      selectedSeed.value = dossier.value.preferredSeedId
    }

  } catch (error) {
    console.error('Erro ao carregar estilos:', error)
  }
}

function onFormatToggle(fmt: any) {
  // Quando um formato é selecionado, inicializa com duração padrão
  if (selectedFormats.value.includes(fmt.id)) {
    if (!formatDurations.value[fmt.id]) {
      formatDurations.value[fmt.id] = fmt.defaultDuration
    }
  } else {
    // Remove a duração quando desmarca
    delete formatDurations.value[fmt.id]
  }
}


async function generateOutputs() {
  if (selectedFormats.value.length === 0) return

  generatingOutputs.value = true
  try {
    const outputConfigs = selectedFormats.value.map((formatId) => {
      const isTeaser = formatId.includes('teaser')
      const customDuration = formatDurations.value[formatId]
      
      console.log(`[Frontend] Formato ${formatId}: Duração customizada = ${customDuration}s`)
      
      return {
        outputType: isTeaser ? 'VIDEO_TEASER' : 'VIDEO_FULL',
        format: isTeaser ? 'teaser' : 'full',
        duration: customDuration || 60, // Usa duração customizada ou fallback
        aspectRatio: isTeaser ? '9:16' : '16:9',
        platform: formatId.split('-')[1],
        scriptStyleId: selectedScriptStyle.value,
        visualStyleId: selectedVisualStyle.value,
        seedId: selectedSeed.value || undefined,
        enableMotion: enableMotion.value,
        targetWPM: selectedWPM.value,
        voiceId: selectedVoiceId.value || undefined,
        objective: resolvedObjective.value || undefined
      }
    })


    await $fetch(`/api/dossiers/${dossierId}/outputs`, {
      method: 'POST',
      body: { outputs: outputConfigs }
    })

    showOutputGenerator.value = false
    selectedFormats.value = []
    selectedObjectiveId.value = ''
    customObjective.value = ''
    activeTab.value = 'outputs'
    
    if (outputsComponent.value) {
      outputsComponent.value.refresh()
    }
    
    await loadDossier()
  } catch (error: any) {
    console.error('Erro ao gerar outputs:', error)
    alert(error.data?.message || 'Erro ao iniciar produção')
  } finally {
    generatingOutputs.value = false
  }
}

// Watcher para garantir que as preferências sejam carregadas toda vez que o modal abrir
watch(showOutputGenerator, (isOpen) => {
  if (isOpen && dossier.value) {
    if (dossier.value.preferredVisualStyleId) {
      selectedVisualStyle.value = dossier.value.preferredVisualStyleId
    }
    
    if (dossier.value.preferredSeedId) {
      selectedSeed.value = dossier.value.preferredSeedId
    }
  }
})

// Funções para edição de configurações visuais
function getVisualStyleName(styleId: string | null) {
  if (!styleId) return null
  const style = visualStyles.value.find(s => s.id === styleId)
  return style?.name
}

function getSeedValue(seedId: string | null) {
  if (!seedId) return null
  const seed = allSeeds.value.find(s => s.id === seedId)
  return seed ? `DNA ${seed.value}` : null
}

function startEditingVisualSettings() {
  visualSettingsForm.value = {
    preferredVisualStyleId: dossier.value?.preferredVisualStyleId || '',
    preferredSeedId: dossier.value?.preferredSeedId || '',
    visualIdentityContext: dossier.value?.visualIdentityContext || ''
  }
  editingVisualSettings.value = true
  visualSettingsSaved.value = false
}

async function saveVisualSettings() {
  if (savingVisualSettings.value) return
  
  savingVisualSettings.value = true
  try {
    // Preparar dados para envio
    const updateData: any = {
      preferredVisualStyleId: visualSettingsForm.value.preferredVisualStyleId || undefined,
      visualIdentityContext: visualSettingsForm.value.visualIdentityContext || undefined
    }
    
    // Se o usuário selecionou "Nenhuma (Aleatória)" para seed, gerar uma nova
    if (!visualSettingsForm.value.preferredSeedId && visualSettingsForm.value.preferredVisualStyleId) {
      // Gerar seed aleatória
      const randomValue = Math.floor(Math.random() * 2147483647)
      
      // Criar/buscar seed no banco
      const seedResponse = await $fetch('/api/seeds', {
        method: 'POST',
        body: { value: randomValue }
      })
      
      updateData.preferredSeedId = (seedResponse as any).data.id
    } else {
      updateData.preferredSeedId = visualSettingsForm.value.preferredSeedId || undefined
    }
    
    await $fetch(`/api/dossiers/${dossierId}`, {
      method: 'PATCH',
      body: updateData
    })
    
    // Recarregar dossier para refletir mudanças
    await loadDossier()
    
    // Mostrar feedback de sucesso
    visualSettingsSaved.value = true
    editingVisualSettings.value = false
    
    // Esconder mensagem de sucesso após 3 segundos
    setTimeout(() => {
      visualSettingsSaved.value = false
    }, 3000)
  } catch (error: any) {
    console.error('Erro ao salvar configurações visuais:', error)
    alert(error.data?.message || 'Erro ao salvar configurações visuais')
  } finally {
    savingVisualSettings.value = false
  }
}

function cancelEditingVisualSettings() {
  editingVisualSettings.value = false
  visualSettingsSaved.value = false
}

function formatDate(dateString: string) {
  if (!dateString) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(dateString))
}

onMounted(async () => {
  await loadDossier()
  await loadStyles()
})
</script>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
