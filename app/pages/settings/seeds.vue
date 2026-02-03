<script setup lang="ts">
interface Seed {
  id: string
  name: string
  description: string | null
  value: number
  visualStyleId: string
  category: string | null
  tags: string | null
  usageCount: number
  isDefault: boolean
  isActive: boolean
  previewUrl: string | null
  createdAt: string
  updatedAt: string
  visualStyle: {
    id: string
    name: string
  }
  _count?: {
    videos: number
  }
}

interface VisualStyle {
  id: string
  name: string
  seeds: Seed[]
}

const { data: seedsData, refresh: refreshSeeds } = await useFetch<{ success: boolean; data: Seed[] }>('/api/seeds')
const { data: stylesData } = await useFetch<{ success: boolean; data: any[] }>('/api/visual-styles')

// Agrupar seeds por estilo visual
const groupedSeeds = computed(() => {
  const seeds = seedsData.value?.data || []
  const styles = stylesData.value?.data || []
  
  return styles.map(style => ({
    id: style.id,
    name: style.name,
    seeds: seeds.filter(s => s.visualStyleId === style.id)
  })).filter(group => group.seeds.length > 0)
})

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showVideosModal = ref(false)
const editingSeed = ref<Seed | null>(null)
const selectedSeed = ref<Seed | null>(null)
const isSubmitting = ref(false)

const formData = ref({
  name: '',
  description: '',
  value: 0,
  visualStyleId: '',
  category: '',
  tags: '',
  isDefault: false,
  isActive: true
})

function openCreateModal() {
  editingSeed.value = null
  formData.value = {
    name: '',
    description: '',
    value: Math.floor(Math.random() * 1000000),
    visualStyleId: '',
    category: '',
    tags: '',
    isDefault: false,
    isActive: true
  }
  showCreateModal.value = true
}

function openEditModal(seed: Seed) {
  editingSeed.value = seed
  formData.value = {
    name: seed.name,
    description: seed.description || '',
    value: seed.value,
    visualStyleId: seed.visualStyleId,
    category: seed.category || '',
    tags: seed.tags || '',
    isDefault: seed.isDefault,
    isActive: seed.isActive
  }
  showEditModal.value = true
}

function closeModal() {
  showCreateModal.value = false
  showEditModal.value = false
  showVideosModal.value = false
  editingSeed.value = null
  selectedSeed.value = null
}

function generateRandomSeed() {
  formData.value.value = Math.floor(Math.random() * 1000000)
}

async function handleSubmit() {
  if (isSubmitting.value) return
  
  try {
    isSubmitting.value = true
    
    if (editingSeed.value) {
      // Atualizar
      await $fetch(`/api/seeds/${editingSeed.value.id}`, {
        method: 'PUT',
        body: formData.value
      })
    } else {
      // Criar
      await $fetch('/api/seeds', {
        method: 'POST',
        body: formData.value
      })
    }
    
    await refreshSeeds()
    closeModal()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao salvar seed')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(seed: Seed) {
  if (!confirm(`Deletar seed "${seed.name}"?`)) return
  
  try {
    await $fetch(`/api/seeds/${seed.id}`, {
      method: 'DELETE'
    })
    await refreshSeeds()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao deletar seed')
  }
}

async function setAsDefault(seed: Seed) {
  try {
    await $fetch(`/api/seeds/${seed.id}`, {
      method: 'PUT',
      body: { isDefault: true }
    })
    await refreshSeeds()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao definir como padrão')
  }
}

async function openVideosModal(seed: Seed) {
  selectedSeed.value = seed
  showVideosModal.value = true
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Seeds</h1>
        <p>Gerencie receitas visuais (combinações de seed + estilo visual)</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <span>+</span> Nova Seed
      </button>
    </div>

    <div class="content">
      <div v-if="groupedSeeds.length === 0" class="empty-state">
        <p>Nenhuma seed cadastrada</p>
        <button class="btn-primary" @click="openCreateModal">Criar primeira seed</button>
      </div>

      <div v-for="group in groupedSeeds" :key="group.id" class="style-group">
        <div class="group-header">
          <h2>📁 {{ group.name }}</h2>
          <span class="count">{{ group.seeds.length }} seed{{ group.seeds.length !== 1 ? 's' : '' }}</span>
        </div>

        <div class="seeds-list">
          <div v-for="seed in group.seeds" :key="seed.id" class="seed-card">
            <div class="seed-header">
              <div class="seed-title">
                <span v-if="seed.isDefault" class="default-badge">🌟 Padrão</span>
                <h3>{{ seed.name }}</h3>
              </div>
              <div class="seed-actions">
                <button class="btn-icon" @click="openVideosModal(seed)" title="Ver vídeos">
                  🎬
                </button>
                <button class="btn-icon" @click="openEditModal(seed)" title="Editar">
                  ✏️
                </button>
                <button v-if="!seed.isDefault" class="btn-icon" @click="setAsDefault(seed)" title="Definir como padrão">
                  ⭐
                </button>
                <button class="btn-icon btn-danger" @click="handleDelete(seed)" title="Deletar">
                  🗑️
                </button>
              </div>
            </div>

            <div class="seed-info">
              <div class="seed-value">Valor: <strong>{{ seed.value }}</strong></div>
              <div v-if="seed.description" class="seed-description">{{ seed.description }}</div>
              <div class="seed-meta">
                <span>Usado {{ seed.usageCount }} vez{{ seed.usageCount !== 1 ? 'es' : '' }}</span>
                <span v-if="seed.category">{{ seed.category }}</span>
                <span v-if="seed.tags" class="tags">{{ seed.tags }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Criar -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Nova Seed</h2>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>

        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label>Nome *</label>
            <input
              v-model="formData.name"
              type="text"
              required
              maxlength="100"
              placeholder="Ex: Cyberpunk Noturno Épico"
            />
          </div>

          <div class="form-group">
            <label>Descrição</label>
            <textarea
              v-model="formData.description"
              rows="2"
              placeholder="Descreva o que esta seed gera..."
            ></textarea>
          </div>

          <div class="form-group">
            <label>Valor da Seed *</label>
            <div class="input-with-button">
              <input
                v-model.number="formData.value"
                type="number"
                required
                min="0"
              />
              <button type="button" class="btn-secondary" @click="generateRandomSeed">
                🎲 Aleatório
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>Estilo Visual *</label>
            <select v-model="formData.visualStyleId" required>
              <option value="">Selecione...</option>
              <option v-for="style in stylesData?.data" :key="style.id" :value="style.id">
                {{ style.name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Categoria</label>
            <input
              v-model="formData.category"
              type="text"
              maxlength="50"
              placeholder="Ex: urban, nature, portrait"
            />
          </div>

          <div class="form-group">
            <label>Tags (separadas por vírgula)</label>
            <textarea
              v-model="formData.tags"
              rows="2"
              placeholder="Ex: epic, low-angle, neon"
            ></textarea>
          </div>

          <div class="form-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="formData.isActive" />
              Ativo
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="formData.isDefault" />
              Definir como padrão
            </label>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? 'Salvando...' : 'Criar Seed' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Editar -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Editar Seed</h2>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>

        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label>Nome *</label>
            <input
              v-model="formData.name"
              type="text"
              required
              maxlength="100"
            />
          </div>

          <div class="form-group">
            <label>Descrição</label>
            <textarea
              v-model="formData.description"
              rows="2"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Valor da Seed *</label>
            <div class="input-with-button">
              <input
                v-model.number="formData.value"
                type="number"
                required
                min="0"
              />
              <button type="button" class="btn-secondary" @click="generateRandomSeed">
                🎲 Aleatório
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>Categoria</label>
            <input
              v-model="formData.category"
              type="text"
              maxlength="50"
            />
          </div>

          <div class="form-group">
            <label>Tags</label>
            <textarea
              v-model="formData.tags"
              rows="2"
            ></textarea>
          </div>

          <div class="form-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="formData.isActive" />
              Ativo
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="formData.isDefault" />
              Definir como padrão
            </label>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Ver Vídeos -->
    <div v-if="showVideosModal && selectedSeed" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Vídeos usando "{{ selectedSeed.name }}"</h2>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>

        <div class="modal-body">
          <p class="info-text">
            💡 Estes vídeos usaram a mesma combinação de estilo + seed e ficaram visualmente consistentes!
          </p>
          
          <div class="videos-list">
            <p>Carregando vídeos...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: var(--space-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-xl);
}

.page-header h1 {
  font-size: 2rem;
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}

.page-header p {
  color: var(--color-text-muted);
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--color-border);
}

.style-group {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.group-header h2 {
  font-size: 1.25rem;
  color: var(--color-text);
}

.count {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.seeds-list {
  display: grid;
  gap: var(--space-md);
}

.seed-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  transition: all var(--transition-base);
}

.seed-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
}

.seed-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.seed-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.default-badge {
  font-size: 0.75rem;
  color: var(--color-warning);
  font-weight: 600;
}

.seed-title h3 {
  font-size: 1.1rem;
  color: var(--color-text);
}

.seed-actions {
  display: flex;
  gap: var(--space-xs);
}

.seed-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.seed-value {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.seed-value strong {
  color: var(--color-primary);
  font-family: 'Courier New', monospace;
}

.seed-description {
  color: var(--color-text);
  font-size: 0.9rem;
}

.seed-meta {
  display: flex;
  gap: var(--space-md);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.tags {
  font-style: italic;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-lg);
}

.modal {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  font-size: 1.5rem;
  color: var(--color-text);
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
}

.btn-close:hover {
  background: var(--color-bg-card);
  color: var(--color-text);
}

.modal-body {
  padding: var(--space-lg);
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-sm);
  color: var(--color-text);
  font-weight: 500;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.9rem;
  transition: all var(--transition-base);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.input-with-button {
  display: flex;
  gap: var(--space-sm);
}

.input-with-button input {
  flex: 1;
}

.form-row {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

.info-text {
  padding: var(--space-md);
  background: var(--color-bg-card);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-lg);
  color: var(--color-text-muted);
}

.videos-list {
  padding: var(--space-lg);
  text-align: center;
  color: var(--color-text-muted);
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-icon {
  padding: var(--space-sm) var(--space-lg);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
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
}

.btn-icon {
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: 1px solid var(--color-border);
  font-size: 1rem;
}

.btn-icon:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-primary);
}

.btn-danger:hover {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}
</style>
