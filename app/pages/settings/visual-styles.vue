<script setup lang="ts">
interface VisualStyle {
  id: string
  name: string
  description: string
  baseStyle: string
  lightingTags: string
  atmosphereTags: string
  compositionTags: string
  tags: string
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const { data: stylesData, refresh } = await useFetch<{ success: boolean; data: VisualStyle[] }>('/api/visual-styles')
const styles = computed(() => stylesData.value?.data || [])

const showModal = ref(false)
const editingStyle = ref<VisualStyle | null>(null)
const isSubmitting = ref(false)

const formData = ref({
  name: '',
  description: '',
  baseStyle: '',
  lightingTags: '',
  atmosphereTags: '',
  compositionTags: '',
  tags: '',
  order: 0,
  isActive: true
})

function openCreateModal() {
  editingStyle.value = null
  formData.value = {
    name: '',
    description: '',
    baseStyle: '',
    lightingTags: '',
    atmosphereTags: '',
    compositionTags: '',
    tags: '',
    order: styles.value.length,
    isActive: true
  }
  showModal.value = true
}

function openEditModal(style: VisualStyle) {
  editingStyle.value = style
  formData.value = {
    name: style.name,
    description: style.description,
    baseStyle: style.baseStyle,
    lightingTags: style.lightingTags,
    atmosphereTags: style.atmosphereTags,
    compositionTags: style.compositionTags,
    tags: style.tags,
    order: style.order,
    isActive: style.isActive
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingStyle.value = null
}

async function handleSubmit() {
  isSubmitting.value = true
  try {
    if (editingStyle.value) {
      // Atualizar
      await $fetch(`/api/visual-styles/${editingStyle.value.id}`, {
        method: 'PUT',
        body: formData.value
      })
    } else {
      // Criar
      await $fetch('/api/visual-styles', {
        method: 'POST',
        body: formData.value
      })
    }
    
    await refresh()
    closeModal()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao salvar estilo visual')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(id: string) {
  if (!confirm('Tem certeza que deseja deletar este estilo?')) return
  
  try {
    await $fetch(`/api/visual-styles/${id}`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao deletar estilo visual')
  }
}

async function toggleActive(style: VisualStyle) {
  try {
    await $fetch(`/api/visual-styles/${style.id}`, {
      method: 'PUT',
      body: { isActive: !style.isActive }
    })
    await refresh()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao atualizar estilo visual')
  }
}
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1 class="page-title">Estilos Visuais</h1>
        <p class="page-description">
          Gerencie os estilos visuais disponíveis para geração de imagens
        </p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <span>➕</span>
        Novo Estilo
      </button>
    </header>

    <!-- Lista de Estilos -->
    <div class="styles-grid">
      <div
        v-for="style in styles"
        :key="style.id"
        class="style-card"
        :class="{ inactive: !style.isActive }"
      >
        <div class="card-header">
          <h3 class="card-title">{{ style.name }}</h3>
          <div class="card-actions">
            <button
              class="btn-icon"
              :class="{ active: style.isActive }"
              @click="toggleActive(style)"
              :title="style.isActive ? 'Desativar' : 'Ativar'"
            >
              {{ style.isActive ? '✓' : '○' }}
            </button>
            <button class="btn-icon" @click="openEditModal(style)" title="Editar">
              ✏️
            </button>
            <button class="btn-icon danger" @click="handleDelete(style.id)" title="Deletar">
              🗑️
            </button>
          </div>
        </div>
        
        <p class="card-description">{{ style.description }}</p>
        
        <div class="card-tags">
          <span class="tag">{{ (style.tags.split(',')[0] || '').trim() }}</span>
          <span v-if="style.tags.split(',').length > 1" class="tag-more">
            +{{ style.tags.split(',').length - 1 }}
          </span>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingStyle ? 'Editar' : 'Novo' }} Estilo Visual</h2>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>

        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label>Nome</label>
            <input
              v-model="formData.name"
              type="text"
              required
              maxlength="100"
              placeholder="Ex: Cyberpunk Futurista"
            />
          </div>

          <div class="form-group">
            <label>Descrição</label>
            <textarea
              v-model="formData.description"
              required
              rows="2"
              placeholder="Descreva o estilo visual..."
            ></textarea>
          </div>

          <div class="form-group">
            <label>Estilo Base</label>
            <input
              v-model="formData.baseStyle"
              type="text"
              required
              placeholder="Ex: Cinematic 2D illustration, Studio Ghibli style"
            />
            <small>Ancoragem do estilo (define o "cérebro" do modelo)</small>
          </div>

          <div class="form-group">
            <label>Iluminação (narrativa)</label>
            <textarea
              v-model="formData.lightingTags"
              required
              rows="2"
              placeholder="Ex: warm golden hour light, soft volumetric rays filtering through clouds"
            ></textarea>
            <small>Descreva a iluminação de forma narrativa</small>
          </div>

          <div class="form-group">
            <label>Atmosfera (narrativa)</label>
            <textarea
              v-model="formData.atmosphereTags"
              required
              rows="2"
              placeholder="Ex: dreamlike, nostalgic, epic adventure"
            ></textarea>
            <small>Descreva a atmosfera e o mood</small>
          </div>

          <div class="form-group">
            <label>Composição (narrativa)</label>
            <textarea
              v-model="formData.compositionTags"
              required
              rows="2"
              placeholder="Ex: wide establishing shot, low angle emphasizing vastness"
            ></textarea>
            <small>Descreva ângulos de câmera e enquadramento</small>
          </div>

          <div class="form-group">
            <label>Tags Gerais (separadas por vírgula)</label>
            <textarea
              v-model="formData.tags"
              required
              rows="4"
              placeholder="cyberpunk, neon lights, futuristic, ..."
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Ordem</label>
              <input
                v-model.number="formData.order"
                type="number"
                min="0"
              />
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="formData.isActive"
                  type="checkbox"
                />
                <span>Ativo</span>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="closeModal">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-2xl);
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}

.page-description {
  color: var(--color-text-muted);
  font-size: 1rem;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Styles Grid */
.styles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--space-lg);
}

.style-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  transition: all var(--transition-base);
}

.style-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.style-card.inactive {
  opacity: 0.5;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.card-actions {
  display: flex;
  gap: var(--space-xs);
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
  font-size: 0.9rem;
}

.btn-icon:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-primary);
}

.btn-icon.active {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.btn-icon.danger:hover {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.card-description {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin-bottom: var(--space-md);
  line-height: 1.5;
}

.card-tags {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.tag {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
}

.tag-more {
  background: var(--color-primary);
  color: white;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
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
  padding: var(--space-lg);
}

.modal {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  overflow-y: auto;
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group label {
  display: block;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
  font-size: 0.9rem;
}

.form-group input[type="text"],
.form-group input[type="number"],
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
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.form-group small {
  display: block;
  margin-top: var(--space-xs);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  padding-top: var(--space-md);
}

.checkbox-label input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-lg);
}

.btn-secondary {
  padding: var(--space-md) var(--space-lg);
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-secondary:hover {
  background: var(--color-bg-card);
  border-color: var(--color-primary);
}
</style>
