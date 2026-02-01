<script setup lang="ts">
// useVideoStore é auto-importado pelo @pinia/nuxt na pasta stores/

// Inicializamos a store como null e pegamos ela no onMounted
// Isso garante que o erro getActivePinia() não ocorra no SSR do Nuxt
const videoStore = ref<ReturnType<typeof useVideoStore> | null>(null)

const showCreateModal = ref(false)
const newVideoTheme = ref('')
const newVideoStyle = ref<'documentary' | 'mystery' | 'narrative' | 'educational'>('documentary')
const newVideoVisualStyle = ref('epictok')
const newVideoAspectRatio = ref<'9:16' | '16:9'>('16:9')
const newVideoDuration = ref(185) // 3 minutos e pouco padrão
const enableMotion = ref(false)

const VISUAL_STYLES = [
  { id: 'epictok', name: 'Epictok Imersivo' },
  { id: 'gta6', name: 'Estilo GTA VI' },
  { id: 'cyberpunk', name: 'Cyberpunk Futurista' },
  { id: 'oil-painting', name: 'Pintura a Óleo' },
  { id: 'photorealistic', name: 'Fotorrealista' }
]

onMounted(() => {
  videoStore.value = useVideoStore()
  videoStore.value.fetchVideos()
})

// Criar novo vídeo
async function handleCreateVideo() {
  if (!newVideoTheme.value.trim() || !videoStore.value) return
  
  try {
    await videoStore.value.createVideo(newVideoTheme.value, {
      style: newVideoStyle.value,
      visualStyle: newVideoVisualStyle.value,
      aspectRatio: newVideoAspectRatio.value,
      enableMotion: enableMotion.value,
      targetDuration: newVideoDuration.value
    })
    showCreateModal.value = false
    newVideoTheme.value = ''
  } catch {
    // Erro já tratado no store
  }
}

// Status badge helper
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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="dashboard">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-content">
        <div class="logo">
          <span class="logo-icon">◈</span>
          <h1>The Gap Files</h1>
        </div>
        <p class="tagline">Video Automation Engine</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true">
        <span class="icon">+</span>
        Novo Vídeo
      </button>
    </header>

    <ClientOnly>
      <!-- Stats Cards -->
      <section v-if="videoStore" class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{{ videoStore.videos.length }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat-card stat-processing">
          <span class="stat-value">{{ videoStore.processingVideos.length }}</span>
          <span class="stat-label">Em Processamento</span>
        </div>
        <div class="stat-card stat-completed">
          <span class="stat-value">{{ videoStore.completedVideos.length }}</span>
          <span class="stat-label">Concluídos</span>
        </div>
        <div class="stat-card stat-failed">
          <span class="stat-value">{{ videoStore.failedVideos.length }}</span>
          <span class="stat-label">Falhas</span>
        </div>
      </section>

      <!-- Filters -->
      <section v-if="videoStore" class="filters">
      <select 
        :value="videoStore.filters.status ?? ''" 
        class="filter-select"
        @change="videoStore.setFilter('status', ($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">Todos os status</option>
        <option value="PENDING">Pendente</option>
        <option value="SCRIPT_GENERATING">Gerando Roteiro</option>
        <option value="AUDIO_GENERATING">Gerando Áudio</option>
        <option value="IMAGES_GENERATING">Gerando Imagens</option>
        <option value="RENDERING">Renderizando</option>
        <option value="COMPLETED">Concluído</option>
        <option value="FAILED">Falhou</option>
      </select>
      
      <input
        type="search"
        placeholder="Buscar por tema..."
        class="filter-search"
        :value="videoStore.filters.search"
        @input="videoStore.setFilter('search', ($event.target as HTMLInputElement).value || undefined)"
      >
    </section>

      <!-- Video List -->
      <section v-if="videoStore" class="video-list">
      <div v-if="videoStore.loading" class="loading-state">
        <div class="spinner" />
        <span>Carregando vídeos...</span>
      </div>

      <div v-else-if="videoStore.error" class="error-state">
        <span>{{ videoStore.error }}</span>
        <button class="btn-secondary" @click="videoStore.fetchVideos()">
          Tentar novamente
        </button>
      </div>

      <div v-else-if="videoStore.videos.length === 0" class="empty-state">
        <span class="empty-icon">🎬</span>
        <h3>Nenhum vídeo encontrado</h3>
        <p>Crie seu primeiro vídeo para começar a produção automática.</p>
        <button class="btn-primary" @click="showCreateModal = true">
          Criar Primeiro Vídeo
        </button>
      </div>

      <div v-else class="video-grid">
        <article 
          v-for="video in videoStore.videos" 
          :key="video.id"
          class="video-card"
        >
          <div class="video-thumbnail">
            <img 
              v-if="video.thumbnailPath" 
              :src="video.thumbnailPath" 
              :alt="video.title"
            >
            <div v-else class="thumbnail-placeholder">
              <span>🎬</span>
            </div>
          </div>
          
          <div class="video-info">
            <h3 class="video-title">{{ video.title }}</h3>
            <p class="video-theme">{{ video.theme }}</p>
            
            <div class="video-meta">
              <span :class="['badge', getStatusClass(video.status)]">
                {{ getStatusLabel(video.status) }}
              </span>
              <span class="date">{{ formatDate(video.createdAt) }}</span>
            </div>
          </div>

          <div class="video-actions">
            <NuxtLink :to="`/videos/${video.id}`" class="btn-icon" title="Ver detalhes">
              👁
            </NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <!-- Pagination -->
    <section v-if="videoStore && videoStore.pagination.totalPages > 1" class="pagination">
      <button 
        class="btn-page"
        :disabled="videoStore.pagination.page <= 1"
        @click="videoStore.fetchVideos(videoStore.pagination.page - 1)"
      >
        ← Anterior
      </button>
      
      <span class="page-info">
        Página {{ videoStore.pagination.page }} de {{ videoStore.pagination.totalPages }}
      </span>
      
      <button 
        class="btn-page"
        :disabled="videoStore.pagination.page >= videoStore.pagination.totalPages"
        @click="videoStore.fetchVideos(videoStore.pagination.page + 1)"
      >
        Próxima →
      </button>
    </section>
    </ClientOnly>

    <div v-if="!videoStore" class="loading-overlay">
      <div class="spinner"></div>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal">
          <header class="modal-header">
            <h2>Novo Vídeo</h2>
            <button class="btn-close" @click="showCreateModal = false">×</button>
          </header>
          
          <div class="modal-body">
            <div class="form-group">
              <label for="theme">Tema do Vídeo</label>
              <textarea
                id="theme"
                v-model="newVideoTheme"
                placeholder="Ex: A verdade oculta sobre as Pirâmides de Gizé e as teorias sobre a civilização perdida de Atlântida..."
                rows="4"
              />
            </div>

            <div class="form-group">
              <label for="style">Estilo do Roteiro</label>
              <select id="style" v-model="newVideoStyle">
                <option value="documentary">Documentário</option>
                <option value="mystery">Mistério</option>
                <option value="narrative">Narrativo</option>
                <option value="educational">Educacional</option>
              </select>
            </div>

            <div class="form-group">
              <label for="visualStyle">Estilo Visual (Imagens)</label>
              <select id="visualStyle" v-model="newVideoVisualStyle">
                <option v-for="s in VISUAL_STYLES" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="aspectRatio">Formato do Vídeo</label>
              <select id="aspectRatio" v-model="newVideoAspectRatio">
                <option value="16:9">Celular Deitado (Horizontal - 16:9)</option>
                <option value="9:16">Celular em Pé (Vertical - 9:16)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="duration">Duração da Narração</label>
              <select id="duration" v-model="newVideoDuration">
                <option :value="65">Curta (65 segundos)</option>
                <option :value="130">Média (2m 10s)</option>
                <option :value="185">Padrão (3m 05s)</option>
                <option :value="305">Longa (5m 05s)</option>
                <option :value="605">Documentário (10m 05s)</option>
              </select>
            </div>

            <div class="form-group-checkbox">
              <label class="toggle-switch">
                <input type="checkbox" v-model="enableMotion">
                <span class="slider"></span>
              </label>
              <div class="checkbox-label">
                <span class="label-title">Habilitar Movimento (Beta)</span>
                <span class="label-desc">Gera vídeos curtos para cada cena. Aumenta o tempo de produção.</span>
              </div>
            </div>
          </div>

          <footer class="modal-footer">
            <button class="btn-secondary" @click="showCreateModal = false">
              Cancelar
            </button>
            <button 
              class="btn-primary" 
              :disabled="!newVideoTheme.trim() || !!(videoStore && videoStore.loading)"
              @click="handleCreateVideo"
            >
              {{ videoStore && videoStore.loading ? 'Criando...' : 'Criar e Iniciar Pipeline' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Dashboard Layout */
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-xl);
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2xl);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.logo-icon {
  font-size: 2rem;
  color: var(--color-primary);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.logo h1 {
  font-size: 1.75rem;
  font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tagline {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-lg);
  margin-bottom: var(--space-2xl);
}

.stat-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  transition: all var(--transition-base);
}

.stat-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-glow);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.stat-processing .stat-value { color: var(--color-info); }
.stat-completed .stat-value { color: var(--color-success); }
.stat-failed .stat-value { color: var(--color-error); }

/* Filters */
.filters {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.filter-select,
.filter-search {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.filter-select:focus,
.filter-search:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.filter-search {
  flex: 1;
  max-width: 300px;
}

/* Video List */
.video-list {
  margin-bottom: var(--space-xl);
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-lg);
}

.video-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-base);
}

.video-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-lg);
}

.video-thumbnail {
  aspect-ratio: 16/9;
  background: var(--color-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  font-size: 3rem;
  opacity: 0.3;
}

.video-info {
  padding: var(--space-md);
}

.video-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--space-xs);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-theme {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: var(--space-sm);
}

.video-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.video-actions {
  padding: 0 var(--space-md) var(--space-md);
  display: flex;
  justify-content: flex-end;
}

/* Badges */
.badge {
  display: inline-flex;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-pending {
  background: rgba(113, 113, 122, 0.2);
  color: var(--color-text-muted);
}

.badge-processing {
  background: rgba(59, 130, 246, 0.2);
  color: var(--color-info);
}

.badge-success {
  background: rgba(16, 185, 129, 0.2);
  color: var(--color-success);
}

.badge-error {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-error);
}

.badge-muted {
  background: rgba(113, 113, 122, 0.1);
  color: var(--color-text-muted);
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl);
  gap: var(--space-md);
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 4rem;
  opacity: 0.3;
}

.empty-state h3 {
  font-size: 1.25rem;
  color: var(--color-text);
}

.empty-state p {
  color: var(--color-text-muted);
  max-width: 400px;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-lg);
}

.btn-page {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-page:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.btn-page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 500px;
  box-shadow: var(--shadow-lg);
  animation: modalIn 200ms ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.btn-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.btn-close:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}

.modal-body {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.form-group textarea,
.form-group select {
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
  transition: all var(--transition-fast);
}

.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.form-group-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
}

.checkbox-label {
  display: flex;
  flex-direction: column;
}

.label-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.label-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-border);
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--color-primary);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--color-primary);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.modal-footer {
  padding: var(--space-lg);
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
}
</style>
