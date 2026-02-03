<script setup lang="ts">
const { data: response, error, refresh } = await useFetch('/api/videos')
const videos = computed(() => response.value?.data || [])
const pagination = computed(() => response.value?.pagination)

// Polling para atualizar status
let pollInterval: NodeJS.Timeout
onMounted(() => {
  pollInterval = setInterval(refresh, 10000) // Atualiza a cada 10s
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

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
    MOTION_GENERATING: 'Dando Vida',
    MOTION_READY: 'Motion Pronto',
    RENDERING: 'Renderizando',
    COMPLETED: 'Concluído',
    FAILED: 'Falhou',
    CANCELLED: 'Cancelado'
  }
  return labels[status] ?? status
}
</script>

<template>
  <div class="videos-page">
    <header class="page-header">
      <div class="header-content">
        <h1 class="page-title">Vídeos</h1>
        <NuxtLink to="/videos/new" class="btn-primary">
          ➕ Novo Vídeo
        </NuxtLink>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="!response && !error" class="loading-state">
      <div class="spinner" />
      <p>Carregando vídeos...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <h2>Erro ao carregar vídeos</h2>
      <p>{{ error.message }}</p>
      <button class="btn-primary" @click="() => refresh()">Tentar novamente</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="videos.length === 0" class="empty-state">
      <div class="empty-icon">🎬</div>
      <h2>Nenhum vídeo criado ainda</h2>
      <p>Crie seu primeiro vídeo automatizado!</p>
      <NuxtLink to="/videos/new" class="btn-primary">
        Criar Primeiro Vídeo
      </NuxtLink>
    </div>

    <!-- Videos Grid -->
    <div v-else class="videos-container">
      <div class="videos-grid">
        <NuxtLink
          v-for="video in videos"
          :key="video.id"
          :to="`/videos/${video.id}`"
          class="video-card"
        >
          <div class="card-header">
            <span :class="['badge', getStatusClass(video.status)]">
              {{ getStatusLabel(video.status) }}
            </span>
          </div>
          
          <div class="card-body">
            <h3 class="video-title">{{ video.title }}</h3>
            <p class="video-theme">{{ video.theme }}</p>
          </div>

          <div class="card-footer">
            <div class="video-meta">
              <span class="meta-item">
                🌐 {{ video.language === 'pt-BR' ? 'Português' : video.language }}
              </span>
              <span v-if="video.duration" class="meta-item">
                ⏱️ {{ video.duration }}s
              </span>
            </div>
            <div class="video-date">
              {{ new Date(video.createdAt).toLocaleDateString('pt-BR') }}
            </div>
          </div>

          <div v-if="video.downloadUrl" class="download-badge">
            ⬇️ Disponível
          </div>
        </NuxtLink>
      </div>

      <!-- Pagination -->
      <div v-if="pagination && pagination.totalPages > 1" class="pagination">
        <button
          class="btn-secondary"
          :disabled="pagination.page === 1"
          @click="() => {}"
        >
          ← Anterior
        </button>
        <span class="page-info">
          Página {{ pagination.page }} de {{ pagination.totalPages }}
        </span>
        <button
          class="btn-secondary"
          :disabled="pagination.page === pagination.totalPages"
          @click="() => {}"
        >
          Próxima →
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.videos-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-xl);
}

.page-header {
  margin-bottom: var(--space-2xl);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Loading/Error/Empty States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3xl);
  text-align: center;
  min-height: 400px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-lg);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--space-lg);
}

.empty-state h2,
.error-state h2 {
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.empty-state p,
.error-state p {
  color: var(--color-text-muted);
  margin-bottom: var(--space-xl);
}

/* Videos Grid */
.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-2xl);
}

.video-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.video-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.15);
}

.card-header {
  margin-bottom: var(--space-md);
}

.card-body {
  margin-bottom: var(--space-lg);
}

.video-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--space-xs);
  color: var(--color-text);
}

.video-theme {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.video-meta {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.meta-item {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.video-date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.download-badge {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  background: var(--color-success);
  color: black;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-xl) 0;
}

.page-info {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-pending {
  background: rgba(156, 163, 175, 0.2);
  color: #9CA3AF;
}

.badge-processing {
  background: rgba(59, 130, 246, 0.2);
  color: #3B82F6;
}

.badge-success {
  background: rgba(16, 185, 129, 0.2);
  color: #10B981;
}

.badge-error {
  background: rgba(239, 68, 68, 0.2);
  color: #EF4444;
}

.badge-muted {
  background: rgba(107, 114, 128, 0.2);
  color: #6B7280;
}

/* Buttons */
.btn-primary,
.btn-secondary {
  display: inline-block;
  padding: var(--space-md) var(--space-xl);
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 1rem;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-card);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-primary);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
