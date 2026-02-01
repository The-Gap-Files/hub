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
const isApprovingMotion = ref(false)
const regeneratingScenes = ref<Record<string, boolean>>({})
const regeneratingMotion = ref<Record<string, boolean>>({})

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
    RENDERING: 'Renderizando',
    COMPLETED: 'Concluído',
    FAILED: 'Falhou',
    CANCELLED: 'Cancelado'
  }
  return labels[status] ?? status
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
        <!-- Left: Tabs & Content -->
        <main class="main-content">
          <nav class="tabs-nav">
            <button 
              :class="['tab-btn', { active: activeTab === 'script' }]" 
              @click="activeTab = 'script'"
            >
              📝 Roteiro
            </button>
            <button 
              :class="['tab-btn', { active: activeTab === 'audio' }]" 
              @click="activeTab = 'audio'"
              :disabled="!video.audioTracks?.length"
            >
              🔊 Áudio
            </button>
            <button 
              :class="['tab-btn', { active: activeTab === 'images' }]" 
              @click="activeTab = 'images'"
              :disabled="!video.scenes?.some(s => s.images?.length > 0)"
            >
              🖼️ Imagens
            </button>
            <button 
              :class="['tab-btn', { active: activeTab === 'motion' }]" 
              @click="activeTab = 'motion'"
              :disabled="!video.enableMotion || !['MOTION_GENERATING', 'MOTION_READY', 'RENDERING', 'COMPLETED'].includes(video.status)"
            >
              ✨ Vida às Imagens
            </button>
            <button 
              :class="['tab-btn', { active: activeTab === 'logs' }]" 
              @click="activeTab = 'logs'"
            >
              ⚙️ Logs
            </button>
          </nav>

          <div class="tab-content">
            <!-- SCRIPT TAB -->
            <div v-if="activeTab === 'script'" class="script-view">
              <div v-if="video.script" class="script-container">
                <div v-for="scene in video.scenes" :key="scene.id" class="scene-item">
                  <div class="scene-header">
                    <span class="scene-number">Cena {{ scene.order }}</span>
                  </div>
                  <div class="scene-body">
                    <div class="visual-desc">
                      <strong>Visual:</strong> {{ scene.visualDescription }}
                    </div>
                    <div class="narration-text">
                      <strong>Narração:</strong> {{ scene.narration }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-tab">
                <p>Roteiro ainda não gerado.</p>
              </div>
            </div>

            <!-- AUDIO TAB -->
            <div v-if="activeTab === 'audio'" class="audio-view">
              <div v-for="track in video.audioTracks || []" :key="track.id" class="audio-track">
                <h3>Faixa de Narração</h3>
                <audio controls class="audio-player">
                  <source :src="`/api/storage/audio/${video.id}/narration.mp3`" type="audio/mpeg">
                  Seu navegador não suporta o elemento de áudio.
                </audio>
                <div class="track-info">
                  <span>Duração: {{ (track.duration || 0).toFixed(1) }}s</span>
                  <span>Voz: Rachel (ElevenLabs)</span>
                </div>
              </div>
            </div>

            <!-- IMAGES TAB -->
            <div v-if="activeTab === 'images'" class="images-view">
              <div class="images-grid">
                <div v-for="scene in video.scenes || []" :key="scene.id" class="scene-images">
                  <h4>Cena {{ scene.order }}</h4>
                  <div class="image-gallery">
                    <div v-for="img in scene.images" :key="img.id" class="image-card">
                      <!-- Usando path relativo para servir via endpoint de storage -->
                      <img :src="`/api/storage/images/${video.id}/${img.filePath.split(/[\\\/]/).pop()}`" alt="Cena gerada">
                      <div class="image-overlay">
                        <button 
                          v-if="!video.imagesApproved"
                          class="btn-mini" 
                          :disabled="regeneratingScenes[scene.id]"
                          @click="handleRegenerateImage(scene.id)"
                        >
                          {{ regeneratingScenes[scene.id] ? '⌛' : '🔄 Regerar' }}
                        </button>
                      </div>
                      <p class="img-prompt">{{ img.promptUsed }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- MOTION TAB -->
            <div v-if="activeTab === 'motion'" class="motion-view">
              <div class="motion-grid">
                <div v-for="scene in video.scenes || []" :key="scene.id" class="scene-motion">
                  <h4>Cena {{ scene.order }}</h4>
                  
                  <div v-if="scene.videos?.length > 0" class="motion-gallery">
                    <div v-for="motion in scene.videos" :key="motion.id" class="motion-card">
                      <video controls class="motion-video">
                        <source :src="`/api/storage/images/${video.id}/${motion.filePath.split(/[\\\/]/).pop()}`" type="video/mp4">
                        Seu navegador não suporta o elemento de vídeo.
                      </video>
                      <div class="image-overlay">
                        <button 
                          v-if="!video.videosApproved"
                          class="btn-mini" 
                          :disabled="regeneratingMotion[scene.id]"
                          @click="handleRegenerateMotion(scene.id)"
                        >
                          {{ regeneratingMotion[scene.id] ? '⌛' : '🔄 Regerar Motion' }}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="motion-empty">
                    <div class="motion-placeholder">
                      <span>⚠️ Sem vídeo</span>
                    </div>
                    <button 
                      v-if="!video.videosApproved"
                      class="btn-secondary btn-sm" 
                      :disabled="regeneratingMotion[scene.id]"
                      @click="handleRegenerateMotion(scene.id)"
                    >
                      {{ regeneratingMotion[scene.id] ? 'Gerando...' : 'Gerar Motion' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- LOGS TAB -->
            <div v-if="activeTab === 'logs'" class="logs-view">
              <div class="terminal-logs">
                <div v-for="log in logs" :key="log.id" class="log-entry">
                  <span class="log-time">{{ new Date(log.createdAt).toLocaleTimeString() }}</span>
                  <span :class="['log-status', log.status]">{{ log.status.toUpperCase() }}</span>
                  <span class="log-step">[{{ log.step }}]</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        <!-- Right: Progress Sidebar -->
        <aside class="sidebar">
          <div class="progress-card">
            <h3>Progresso do Pipeline</h3>
            <div class="progress-steps">
               <!-- Usando uma lógica simplificada baseada no status, já que pipeline.progress não existe no schema atual -->
              <div 
                v-for="(step, index) in ['Script', 'Audio', 'Images', 'Movimento', 'Render']" 
                :key="step"
                :class="['step-item', { 
                  completed: ['SCRIPT_READY', 'AUDIO_READY', 'IMAGES_READY', 'MOTION_READY', 'COMPLETED'].includes(video.status) && index === 0 ||
                             ['AUDIO_READY', 'IMAGES_READY', 'MOTION_READY', 'COMPLETED'].includes(video.status) && index <= 1 ||
                             ['IMAGES_READY', 'MOTION_READY', 'COMPLETED'].includes(video.status) && index <= 2 ||
                             ['MOTION_READY', 'COMPLETED'].includes(video.status) && index <= 3 ||
                             video.status === 'COMPLETED',
                  active: getStatusLabel(video.status).includes(step)
                }]"
              >
                <div class="step-indicator">
                  <span>{{ index + 1 }}</span>
                </div>
                <span>{{ step }}</span>
              </div>
            </div>
          </div>
          
          <div class="render-actions" style="margin-bottom: var(--space-md);">
            <button 
              class="btn-secondary full-width" 
              :disabled="isRendering || !video.scenes?.length"
              @click="handleReRender"
            >
              {{ isRendering ? 'Renderizando...' : '🔄 Re-renderizar Vídeo' }}
            </button>
          </div>
          
          <div v-if="video.status === 'COMPLETED'" class="download-card">
            <a 
              :href="`/api/storage/output/${video.id}/final.mp4`" 
              download
              class="btn-primary full-width text-center"
              style="text-decoration: none; display: block;"
            >
              ⬇ Baixar Vídeo Final
            </a>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-details {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-xl);
}

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
}

.btn-back:hover {
  color: var(--color-primary);
}

.header-info {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.video-id {
  font-family: monospace;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.title-section {
  margin-bottom: var(--space-2xl);
}

.main-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: var(--space-xs);
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.theme-text {
  color: var(--color-text-muted);
  font-size: 1.125rem;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-xl);
}

/* Tabs */
.tabs-nav {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 2px;
}

.tab-btn {
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover:not(:disabled) {
  color: var(--color-text);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Content Areas */
.tab-content {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-lg);
  min-height: 400px;
}

/* Script View */
.scene-item {
  background: var(--color-bg-elevated);
  margin-bottom: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
}

.scene-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.scene-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.visual-desc, .narration-text {
  line-height: 1.5;
}

/* Audio View */
.audio-track {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  align-items: center;
  padding: var(--space-xl);
}

.audio-player {
  width: 100%;
  max-width: 600px;
}

/* Motion View */
.motion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-lg);
}

.scene-motion {
  background: var(--color-bg-elevated);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

.motion-gallery {
  margin-top: var(--space-sm);
}

.motion-video {
  width: 100%;
  border-radius: var(--radius-sm);
  background: #000;
}

.motion-card {
  position: relative;
}

.motion-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
}

.motion-placeholder {
  width: 100%;
  aspect-ratio: 16/9;
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.btn-sm {
  padding: 4px 12px;
  font-size: 0.8125rem;
}

/* Logs View */
.terminal-logs {
  background: #000;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  font-family: monospace;
  font-size: 0.875rem;
  max-height: 500px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  gap: var(--space-md);
  padding: 4px 0;
  border-bottom: 1px solid #222;
}

.log-time { color: #666; }
.log-step { color: #888; }
.log-status.started { color: #3b82f6; }
.log-status.completed { color: #10b981; }
.log-status.failed { color: #ef4444; }

/* Sidebar */
.progress-card {
  background: var(--color-bg-card);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.progress-steps {
  margin-top: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.step-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  opacity: 0.5;
}

.step-item.active,
.step-item.completed {
  opacity: 1;
}

.step-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.step-item.completed .step-indicator {
  background: var(--color-success);
  color: black;
  border-color: var(--color-success);
}

.step-item.active .step-indicator {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.error-banner, .approval-banner {
  margin-top: var(--space-lg);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

.error-banner {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.approval-banner {
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid var(--color-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-lg);
}

.approval-content h3 {
  color: var(--color-primary);
  margin-bottom: 4px;
}

.approval-content p {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.image-card {
  position: relative;
}

.image-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.btn-mini {
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: all 0.2s;
}

.btn-mini:hover:not(:disabled) {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.full-width {
  width: 100%;
}
</style>
