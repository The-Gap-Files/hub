<script setup lang="ts">
const route = useRoute()
const videoId = route.params.id as string

// Buscar dados do vídeo
const { data: response, error, refresh } = await useFetch(`/api/videos/${videoId}`)
const video = computed(() => response.value?.data)

// Tabs de navegação
const activeTab = ref<'script' | 'audio' | 'images' | 'motion' | 'logs'>('script')

// Handler para refresh button (wrapper para evitar erro de tipo)
const handleRefresh = () => refresh()

// Type para logs (já que pipelineLog é Json no Prisma)
interface LogEntry {
  id: string
  step: string
  status: string
  message: string
  createdAt: string
}

const logs = computed(() => {
  return video.value?.pipeline?.logs || []
})

// Polling de status quando não concluído
let pollInterval: NodeJS.Timeout
onMounted(() => {
  if (video.value && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(video.value.status)) {
    pollInterval = setInterval(refresh, 5000)
  }
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

watch(() => video.value?.status, (newStatus) => {
  if (newStatus && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(newStatus)) {
    if (pollInterval) clearInterval(pollInterval)
  }
})

const isRendering = ref(false)
const isApproving = ref(false)
const isApprovingScript = ref(false)
const isRefiningScript = ref(false)
const isApprovingMotion = ref(false)
const scriptFeedback = ref('')
const regeneratingScenes = ref<Record<string, boolean>>({})
const regeneratingMotion = ref<Record<string, boolean>>({})
const selectedImageUrl = ref<string | null>(null)
const closeLightbox = () => selectedImageUrl.value = null
const openLightbox = (sceneId: string) => selectedImageUrl.value = `/api/scenes/${sceneId}/image`

async function handleApproveScript() {
  if (isApprovingScript.value) return
  isApprovingScript.value = true
  
  try {
    await $fetch(`/api/videos/${videoId}/approve-script`, { method: 'POST' } as any)
    refresh()
  } catch (err) {
    console.error('Erro ao aprovar roteiro:', err)
    alert('Erro ao aprovar roteiro')
  } finally {
    isApprovingScript.value = false
  }
}

async function handleRefineScript() {
  if (isRefiningScript.value || !scriptFeedback.value.trim()) return
  isRefiningScript.value = true
  
  try {
    await $fetch(`/api/videos/${videoId}/refine-script`, { 
      method: 'POST',
      body: { feedback: scriptFeedback.value }
    } as any)
    scriptFeedback.value = ''
    refresh()
  } catch (err) {
    console.error('Erro ao refinar roteiro:', err)
    alert('Erro ao refinar roteiro')
  } finally {
    isRefiningScript.value = false
  }
}

async function handleApproveImages() {
  if (isApproving.value) return
  isApproving.value = true
  
  try {
    await $fetch(`/api/videos/${videoId}/approve`, { method: 'POST' } as any)
    refresh()
  } catch (err) {
    console.error('Erro ao aprovar imagens:', err)
    alert('Erro ao aprovar imagens')
  } finally {
    isApproving.value = false
  }
}

async function handleRegenerateImage(sceneId: string) {
  if (regeneratingScenes.value[sceneId]) return
  regeneratingScenes.value[sceneId] = true
  
  try {
    await $fetch(`/api/scenes/${sceneId}/regenerate`, { method: 'POST' } as any)
    refresh()
  } catch (err) {
    console.error('Erro ao regenerar imagem:', err)
    alert('Erro ao regenerar imagem')
  } finally {
    regeneratingScenes.value[sceneId] = false
  }
}

async function handleApproveMotion() {
  if (isApprovingMotion.value) return
  isApprovingMotion.value = true
  
  try {
    await $fetch(`/api/videos/${videoId}/approve-motion`, { method: 'POST' } as any)
    refresh()
  } catch (err) {
    console.error('Erro ao aprovar vídeos:', err)
    alert('Erro ao aprovar vídeos')
  } finally {
    isApprovingMotion.value = false
  }
}

async function handleRegenerateMotion(sceneId: string) {
  if (regeneratingMotion.value[sceneId]) return
  regeneratingMotion.value[sceneId] = true
  
  try {
    await $fetch(`/api/scenes/${sceneId}/regenerate-motion`, { method: 'POST' } as any)
    refresh()
  } catch (err) {
    console.error('Erro ao regenerar motion:', err)
    alert('Erro ao regenerar motion')
  } finally {
    regeneratingMotion.value[sceneId] = false
  }
}

async function handleReRender() {
  if (isRendering.value) return
  isRendering.value = true
  
  try {
    await $fetch(`/api/videos/${videoId}/render`, { method: 'POST' } as any)
    refresh()
  } catch (err) {
    console.error('Erro ao re-renderizar:', err)
    alert('Erro ao disparar renderização')
  } finally {
    isRendering.value = false
  }
}

// Helpers visuais
function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    PENDING: 'badge-pending',
    COMPLETED: 'badge-success',
    FAILED: 'badge-error',
    CANCELLED: 'badge-muted'
  }
  return classes[status] ?? 'badge-processing'
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    SCRIPT_GENERATING: 'Gerando Roteiro',
    SCRIPT_READY: 'Roteiro Pronto',
    AUDIO_GENERATING: 'Gerando Áudio',
    AUDIO_READY: 'Áudio Pronto',
    IMAGES_GENERATING: 'Gerando Imagens',
    IMAGES_READY: 'Imagens Prontas',
    MOTION_GENERATING: 'Dando Vida às Imagens',
    MOTION_READY: 'Imagens com Vida',
    RENDERING: 'Renderizando',
    COMPLETED: 'Concluído',
    FAILED: 'Falhou',
    CANCELLED: 'Cancelado'
  }
  return labels[status] ?? status
}

const downloadVideo = () => {
  if (video.value?.id) {
    const url = `/api/videos/${video.value.id}/download`
    const link = document.createElement('a')
    link.href = url
    link.download = `video-${video.value.id}.mp4`
    link.click()
  }
}
</script>

<template>
  <div class="video-details">
    <!-- Header / Nav -->
    <header class="details-header">
      <NuxtLink to="/" class="btn-back">← Voltar</NuxtLink>
      <div v-if="video" class="header-info">
        <span class="video-id">ID: {{ video.id }}</span>
        <span :class="['badge', getStatusClass(video.status)]">
          {{ getStatusLabel(video.status) }}
        </span>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="!video && !error" class="loading-state">
      <div class="spinner" />
      <p>Carregando detalhes...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <h2>Erro ao carregar vídeo</h2>
      <p>{{ error.message }}</p>
      <button class="btn-primary" @click="handleRefresh">Tentar novamente</button>
    </div>

    <!-- Content -->
    <div v-else-if="video" class="content-wrapper">
      <!-- Title Section -->
      <section class="title-section">
        <h1 class="main-title">{{ video.title }}</h1>
        <p class="theme-text">{{ video.theme }}</p>
        
        <!-- Error Banner -->
        <div v-if="video.status === 'FAILED'" class="error-banner">
          <h3>⚠️ Falha no Pipeline</h3>
          <p>{{ video.errorMessage || 'Verifique os logs para mais detalhes' }}</p>
        </div>

        <!-- Approval Banner -->
        <div v-if="video.status === 'IMAGES_READY' && !video.imagesApproved" class="approval-banner">
          <div class="approval-content">
            <h3>📸 Imagens Prontas para Revisão</h3>
            <p>Verifique as imagens abaixo. Se estiver tudo OK, clique em aprovar para gerar a narração (ElevenLabs) e o movimento (Replicate), que são as etapas de maior custo.</p>
          </div>
          <button 
            class="btn-primary" 
            :disabled="isApproving"
            @click="handleApproveImages"
          >
            {{ isApproving ? 'Processando...' : '✅ Aprovar Imagens e Gerar Vídeo' }}
          </button>
        </div>

        <!-- Motion Approval Banner -->
        <div v-if="video.status === 'MOTION_READY' && !video.videosApproved" class="approval-banner motion-approval">
          <div class="approval-content">
            <h3>✨ Vídeos de Movimento Prontos</h3>
            <p>Revise as animações de cada cena na aba "Vida às Imagens". Se estiver satisfeito, aprove para realizar a renderização final do vídeo.</p>
          </div>
          <button 
            class="btn-primary" 
            :disabled="isApprovingMotion"
            @click="handleApproveMotion"
          >
            {{ isApprovingMotion ? 'Processando...' : '🎬 Aprovar e Renderizar Final' }}
          </button>
        </div>
      </section>

      <!-- Main Columns -->
      <div class="details-grid">
        <!-- Progress Sidebar (Now interactive and visual) -->
        <aside class="sidebar">
          <div class="progress-card glass">
            <h3 class="sidebar-title">Status da Produção</h3>
            <div class="progress-steps-vertical">
              <div 
                v-for="(step, index) in [
                  { id: 'script', label: 'Roteiro', status: ['SCRIPT_READY', 'IMAGES_READY', 'AUDIO_READY', 'MOTION_READY', 'COMPLETED'] },
                  { id: 'images', label: 'Imagens', status: ['IMAGES_READY', 'AUDIO_READY', 'MOTION_READY', 'COMPLETED'] },
                  { id: 'audio', label: 'Narração', status: ['AUDIO_READY', 'MOTION_READY', 'COMPLETED'] },
                  { id: 'motion', label: 'Animação', status: ['MOTION_READY', 'COMPLETED'] },
                  { id: 'render', label: 'Exportação', status: ['COMPLETED'] }
                ]" 
                :key="step.id"
                :class="['step-v-item', { 
                  completed: step.status.includes(video.status),
                  active: getStatusLabel(video.status).includes(step.label),
                  processing: video.status.includes(step.id.toUpperCase()) && !step.status.includes(video.status)
                }]"
              >
                <div class="step-v-indicator">
                  <div class="dot"></div>
                  <div v-if="index < 4" class="connector"></div>
                </div>
                <div class="step-v-content">
                  <span class="step-label">{{ step.label }}</span>
                  <span class="step-status-text">{{ step.status.includes(video.status) ? 'Concluído' : (getStatusLabel(video.status).includes(step.label) ? 'Em andamento...' : 'Aguardando') }}</span>
                </div>
              </div>
            </div>

            <!-- Action Area Inside Sidebar -->
            <div class="sidebar-actions">
              <button 
                v-if="video.status === 'COMPLETED'"
                class="btn-primary full-width glow-pulse"
                @click="downloadVideo"
              >
                <span class="icon">🎬</span> Baixar Vídeo Final
              </button>
              
              <button 
                class="btn-outline full-width" 
                :disabled="isRendering || !video.scenes?.length"
                @click="handleReRender"
              >
                <span class="icon">🔄</span> {{ isRendering ? 'Renderizando...' : 'Re-renderizar' }}
              </button>
            </div>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="main-content">
          <header class="content-header">
            <nav class="premium-tabs glass">
              <button 
                v-for="tab in [
                  { id: 'script', label: 'Roteiro', iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                  { id: 'images', label: 'Cenários', iconPath: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', disabled: !video.scenes?.some(s => s.images?.length > 0) },
                  { id: 'audio', label: 'Áudio', iconPath: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z', disabled: !video.audioTracks?.length },
                  { id: 'motion', label: 'Motion', iconPath: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z', disabled: !video.enableMotion || !['MOTION_GENERATING', 'MOTION_READY', 'RENDERING', 'COMPLETED'].includes(video.status) },
                  { id: 'logs', label: 'Logs', iconPath: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
                ]"
                :key="tab.id"
                :class="['premium-tab-btn', { active: activeTab === tab.id }]" 
                :disabled="tab.disabled"
                @click="activeTab = tab.id as any"
              >
                <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="tab.iconPath" />
                </svg>
                <span class="tab-label">{{ tab.label }}</span>
                <div class="tab-indicator"></div>
              </button>
            </nav>
          </header>

          <section class="tab-viewport glass-card">
            <Transition name="fade-slide" mode="out-in">
              <div :key="activeTab" class="tab-panel">
                <!-- SCRIPT TAB -->
                <div v-if="activeTab === 'script'" class="script-explorer">
                  <!-- Approval Card Floating -->
                  <div v-if="video.status === 'SCRIPT_READY' && !video.scriptApproved" class="glass-alert info-alert">
                    <div class="alert-body">
                      <div class="alert-icon">✍️</div>
                      <div class="alert-text">
                        <h4>Roteiro Gerado</h4>
                        <p>Revise a narrativa histórica e o tom do mistério abaixo.</p>
                      </div>
                    </div>
                    <div class="alert-actions">
                      <div class="input-glow-group">
                        <input v-model="scriptFeedback" placeholder="Feedback para refinamento..." @keyup.enter="handleRefineScript" />
                        <button class="btn-ghost" :disabled="isRefiningScript" @click="handleRefineScript">Refinar</button>
                      </div>
                      <button class="btn-primary" :disabled="isApprovingScript" @click="handleApproveScript">Aprovar e Avançar</button>
                    </div>
                  </div>

                  <div class="scenes-list">
                    <div v-for="scene in video.scenes" :key="scene.id" class="premium-scene-card">
                      <div class="scene-meta">Cena {{ scene.order }}</div>
                      <div class="scene-grid">
                        <div class="scene-narration">
                          <p class="quote">"{{ scene.narration }}"</p>
                        </div>
                        <div class="scene-visual">
                          <span class="label">VISUAL</span>
                          <p>{{ scene.visualDescription }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- IMAGES TAB -->
                <div v-if="activeTab === 'images'" class="gallery-explorer">
                  <div v-if="video.status === 'IMAGES_READY' && !video.imagesApproved" class="glass-alert info-alert sticky-alert">
                    <div class="alert-body">
                      <div class="alert-icon">📸</div>
                      <div class="alert-text">
                        <h4>Visual Ready</h4>
                        <p>Aprove para prosseguir com o áudio e movimento.</p>
                      </div>
                    </div>
                    <button class="btn-primary" :disabled="isApproving" @click="handleApproveImages">Aprovar Cenários</button>
                  </div>

                  <div class="images-masonry">
                    <div v-for="scene in video.scenes" :key="scene.id" class="image-box compact">
                      <div class="image-wrapper" @click="openLightbox(scene.id)">
                        <img :src="`/api/scenes/${scene.id}/image`" loading="lazy" />
                        <div class="image-hover">
                          <div class="hover-actions">
                            <button class="btn-icon-blur mini" title="Regerar" @click.stop="handleRegenerateImage(scene.id)">🔄</button>
                            <button class="btn-icon-blur mini" title="Zoom">🔍</button>
                          </div>
                          <div class="hover-info">Cena {{ scene.order }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- LIGHTBOX OVERLAY -->
                <Teleport to="body">
                  <Transition name="fade">
                    <div v-if="selectedImageUrl" class="lightbox-overlay" @click="closeLightbox">
                      <div class="lightbox-content" @click.stop>
                        <button class="lightbox-close" @click="closeLightbox">×</button>
                        <img :src="selectedImageUrl" class="lightbox-img" />
                      </div>
                    </div>
                  </Transition>
                </Teleport>

                <!-- AUDIO TAB -->
                <div v-if="activeTab === 'audio'" class="audio-explorer">
                  <div class="audio-hero-card">
                    <div class="audio-waves">
                      <div v-for="i in 20" :key="i" class="wave-bar" :style="{ height: Math.random() * 100 + '%' }"></div>
                    </div>
                    <div v-for="track in (video.audioTracks as any[]) || []" :key="track.id" class="audio-interface">
                      <h2 class="voice-name">Voz: Rachel (Cinematic)</h2>
                      <audio controls>
                        <source :src="`/api/videos/${video.id}/audio`" type="audio/mpeg">
                      </audio>
                      <div class="audio-stats">
                        <span>{{ (track.duration || 0).toFixed(1) }}s</span>
                        <div class="status-dot success"></div>
                        <span>Masterizado</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- MOTION TAB -->
                <div v-if="activeTab === 'motion'" class="motion-explorer">
                  <div v-if="video.status === 'MOTION_READY' && !video.videosApproved" class="glass-alert info-alert sticky-alert">
                    <div class="alert-body">
                      <div class="alert-icon">✨</div>
                      <div class="alert-text">
                        <h4>Motion Synthesis Complete</h4>
                        <p>Finalize para iniciar a renderização cinematográfica.</p>
                      </div>
                    </div>
                    <button class="btn-primary" :disabled="isApprovingMotion" @click="handleApproveMotion">Aprovar e Renderizar</button>
                  </div>

                  <div class="motion-grid-modern">
                    <div v-for="scene in video.scenes" :key="scene.id" class="motion-box">
                      <header class="box-header">Cena {{ scene.order }}</header>
                      <div v-if="scene.videos?.length" class="video-container">
                        <video controls preload="metadata">
                          <source :src="`/api/scenes/${scene.id}/video`" type="video/mp4">
                        </video>
                        <button v-if="!video.videosApproved" class="float-regen" @click="handleRegenerateMotion(scene.id)">🔄</button>
                      </div>
                      <div v-else class="motion-placeholder">
                        <div class="spinner"></div>
                        <p>Aguardando síntese...</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- LOGS TAB -->
                <div v-if="activeTab === 'logs'" class="logs-explorer">
                  <div class="terminal-container">
                    <div class="terminal-header">
                      <div class="term-dots"><span></span><span></span><span></span></div>
                      <div class="term-title">pipeline_session.log</div>
                    </div>
                    <div class="terminal-body">
                      <div v-for="log in logs" :key="log.id" class="log-line">
                        <span class="l-time">{{ new Date(log.createdAt).toLocaleTimeString() }}</span>
                        <span :class="['l-status', log.status]">{{ log.status }}</span>
                        <span class="l-msg"><span class="l-step">{{ log.step }}:</span> {{ log.message }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </section>
        </main>
      </div>

    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Outfit:wght@400;600;700&display=swap');
</style>

<style scoped>
/* =============================================================================
   CINEMATIC DASHBOARD - THE GAP FILES HUB
   UX PRO MAX CONSOLIDATED STYLES
   ============================================================================= */

.video-details {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--space-xl);
  font-family: 'Outfit', sans-serif;
  animation: fadeIn 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  color: var(--color-text);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Header & Typography */
.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
}

.btn-back {
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back:hover { color: var(--color-primary); }

.header-info {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.video-id {
  font-family: 'Fira Code', monospace;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.03);
  padding: 4px 8px;
  border-radius: 4px;
}

.main-title {
  font-size: 2.8rem;
  font-weight: 800;
  margin-bottom: var(--space-xs);
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.theme-text {
  color: var(--color-text-muted);
  font-size: 1.1rem;
  margin-bottom: var(--space-2xl);
}

/* Grid Layout */
.details-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--space-2xl);
  align-items: start;
}

/* Glass Primitives */
.glass {
  background: rgba(18, 18, 26, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.glass-card {
  background: rgba(13, 13, 18, 0.4);
  backdrop-filter: blur(10px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

/* Sidebar Pipeline */
.sidebar {
  position: sticky;
  top: var(--space-xl);
  z-index: 10;
}

.progress-card {
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
}

.sidebar-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-xl);
  font-weight: 700;
}

.progress-steps-vertical {
  display: flex;
  flex-direction: column;
}

.step-v-item {
  display: flex;
  gap: var(--space-lg);
  padding-bottom: var(--space-xl);
  position: relative;
  opacity: 0.35;
  transition: all 0.4s ease;
}

.step-v-item.completed, 
.step-v-item.active { 
  opacity: 1; 
}

.step-v-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 14px;
}

.step-v-indicator .dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  border: 2px solid var(--color-border);
  z-index: 2;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.step-v-indicator .connector {
  width: 2px;
  flex-grow: 1;
  background: var(--color-border);
  margin-top: 4px;
  margin-bottom: -14px;
}

.step-v-item.completed .dot {
  background: var(--color-success);
  border-color: var(--color-success);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
}

.step-v-item.active .dot {
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.6);
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 1; }
}

.step-v-item.completed .connector { background: var(--color-success); }

.step-label {
  font-weight: 700;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
}

.step-status-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-family: 'Fira Code', monospace;
}

/* Premium Tabs (FIXED) */
.premium-tabs {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-xl);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.premium-tab-btn {
  flex: 1;
  padding: var(--space-md) var(--space-sm);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
}

.premium-tab-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text);
}

.premium-tab-btn.active {
  background: var(--color-bg-elevated) !important;
  color: var(--color-primary) !important;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.tab-icon-svg {
  width: 22px;
  height: 22px;
  stroke-width: 2;
  transition: transform 0.3s ease;
}

.premium-tab-btn.active .tab-icon-svg {
  transform: translateY(-2px);
  filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.5));
}

.tab-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.premium-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 2px;
  background: var(--color-primary);
  box-shadow: 0 -2px 10px var(--color-primary);
  border-radius: 2px;
}

/* Content Viewport */
.tab-viewport {
  min-height: 700px;
}

.tab-panel {
  padding: var(--space-xl);
  animation: slideIn 0.4s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Image Storyboard */
.images-masonry {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-xl);
}

.image-box.compact {
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: #000;
  cursor: zoom-in;
  overflow: hidden;
  position: relative;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.image-box.compact:hover {
  transform: translateY(-8px) scale(1.02);
  border-color: var(--color-primary);
  box-shadow: 0 25px 50px rgba(0,0,0,0.7), 0 0 20px rgba(139, 92, 246, 0.2);
  z-index: 5;
}

.image-wrapper img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
  transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}

.image-box.compact:hover img {
  transform: scale(1.15);
}

.image-hover {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 40%, transparent 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: var(--space-lg);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.image-box.compact:hover .image-hover {
  opacity: 1;
}

.hover-actions {
  position: absolute;
  top: 15px;
  right: 15px;
  display: flex;
  gap: 10px;
}

.btn-icon-blur.mini {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(20, 20, 25, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-icon-blur.mini:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  transform: scale(1.1) rotate(5deg);
}

/* Lightbox */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(15px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl);
}

.lightbox-content {
  position: relative;
  max-width: 95%;
  max-height: 90vh;
  border-radius: var(--radius-xl);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 100px rgba(139, 92, 246, 0.25);
  overflow: hidden;
}

.lightbox-img {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
}

.lightbox-close {
  position: absolute;
  top: 25px;
  right: 25px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  font-size: 30px;
  cursor: pointer;
  z-index: 1001;
}

/* Utilities */
.btn-primary.glow-pulse {
  background: var(--gradient-primary);
  box-shadow: 0 0 25px rgba(139, 92, 246, 0.4);
}

.btn-outline {
  background: transparent !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text) !important;
  padding: 12px;
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: all 0.3s;
  cursor: pointer;
}

.btn-outline:hover {
  border-color: var(--color-primary) !important;
  background: rgba(139, 92, 246, 0.05) !important;
}

.full-width { width: 100%; }

/* Transitions */
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateX(20px); }
.fade-slide-leave-to { opacity: 0; transform: translateX(-20px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Global conflict resolution */
:deep(button) {
  background-color: transparent;
}
</style>
