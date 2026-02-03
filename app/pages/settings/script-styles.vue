<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>Estilos de Roteiro</h1>
        <p class="subtitle">Gerencie os estilos de narrativa disponíveis para geração de scripts</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <span>+</span> Novo Estilo
      </button>
    </header>

    <div class="styles-grid">
      <div 
        v-for="style in scriptStyles" 
        :key="style.id" 
        class="style-card"
        :class="{ inactive: !style.isActive }"
      >
        <div class="style-header">
          <h3>{{ style.name }}</h3>
          <div class="style-actions">
            <button class="btn-icon" @click="editStyle(style)" title="Editar">
              ✏️
            </button>
            <button class="btn-icon" @click="deleteStyle(style.id)" title="Deletar">
              🗑️
            </button>
          </div>
        </div>
        
        <p class="style-description">{{ style.description }}</p>
        
        <div class="style-instructions">
          <strong>Instruções:</strong>
          <p>{{ style.instructions }}</p>
        </div>
        
        <div class="style-meta">
          <span class="badge" :class="style.isActive ? 'badge-success' : 'badge-inactive'">
            {{ style.isActive ? 'Ativo' : 'Inativo' }}
          </span>
          <span class="order-badge">Ordem: {{ style.order }}</span>
        </div>
      </div>
    </div>

    <!-- Modal Create/Edit -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal">
          <header class="modal-header">
            <h2>{{ editingStyle ? 'Editar Estilo' : 'Novo Estilo' }}</h2>
            <button class="btn-close" @click="closeModal">×</button>
          </header>
          
          <div class="modal-body">
            <div class="form-group">
              <label for="name">Nome</label>
              <input 
                id="name"
                v-model="formData.name" 
                type="text"
                placeholder="Ex: Documentário"
              />
            </div>

            <div class="form-group">
              <label for="description">Descrição</label>
              <textarea
                id="description"
                v-model="formData.description"
                rows="3"
                placeholder="Descreva o estilo de narrativa..."
              />
            </div>

            <div class="form-group">
              <label for="instructions">Instruções para IA</label>
              <textarea
                id="instructions"
                v-model="formData.instructions"
                rows="4"
                placeholder="Instruções que serão passadas para o modelo de IA ao gerar o roteiro..."
              />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="order">Ordem</label>
                <input 
                  id="order"
                  v-model.number="formData.order" 
                  type="number"
                  min="0"
                />
              </div>

              <div class="form-group-checkbox">
                <label class="toggle-switch">
                  <input type="checkbox" v-model="formData.isActive">
                  <span class="slider"></span>
                </label>
                <span class="checkbox-label">Ativo</span>
              </div>
            </div>
          </div>

          <footer class="modal-footer">
            <button class="btn-secondary" @click="closeModal">Cancelar</button>
            <button class="btn-primary" @click="saveStyle" :disabled="!isFormValid">
              {{ editingStyle ? 'Salvar' : 'Criar' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface ScriptStyle {
  id: string
  name: string
  description: string
  instructions: string
  order: number
  isActive: boolean
}

const showModal = ref(false)
const editingStyle = ref<ScriptStyle | null>(null)
const formData = ref({
  name: '',
  description: '',
  instructions: '',
  order: 0,
  isActive: true
})

// Fetch styles
const { data: stylesData, refresh } = await useFetch<{ success: boolean; data: ScriptStyle[] }>('/api/script-styles')
const scriptStyles = computed(() => stylesData.value?.data || [])

const isFormValid = computed(() => {
  return formData.value.name.trim() && 
         formData.value.description.trim() && 
         formData.value.instructions.trim()
})

function openCreateModal() {
  editingStyle.value = null
  formData.value = {
    name: '',
    description: '',
    instructions: '',
    order: 0,
    isActive: true
  }
  showModal.value = true
}

function editStyle(style: ScriptStyle) {
  editingStyle.value = style
  formData.value = {
    name: style.name,
    description: style.description,
    instructions: style.instructions,
    order: style.order,
    isActive: style.isActive
  }
  showModal.value = true
}

async function saveStyle() {
  try {
    if (editingStyle.value) {
      // Update
      await $fetch(`/api/script-styles/${editingStyle.value.id}`, {
        method: 'PUT',
        body: formData.value
      })
    } else {
      // Create
      await $fetch('/api/script-styles', {
        method: 'POST',
        body: formData.value
      })
    }
    
    await refresh()
    closeModal()
  } catch (error) {
    console.error('Erro ao salvar estilo:', error)
    alert('Erro ao salvar estilo de roteiro')
  }
}

async function deleteStyle(id: string) {
  if (!confirm('Tem certeza que deseja deletar este estilo?')) return
  
  try {
    await $fetch(`/api/script-styles/${id}`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (error) {
    console.error('Erro ao deletar estilo:', error)
    alert('Erro ao deletar estilo de roteiro')
  }
}

function closeModal() {
  showModal.value = false
  editingStyle.value = null
}
</script>

<style scoped>
.page-container {
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
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: var(--space-xs);
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

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
  transition: all var(--transition-fast);
}

.style-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.style-card.inactive {
  opacity: 0.6;
}

.style-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.style-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
}

.style-actions {
  display: flex;
  gap: var(--space-xs);
}

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.125rem;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.btn-icon:hover {
  background: var(--color-bg-elevated);
}

.style-description {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin-bottom: var(--space-md);
  line-height: 1.5;
}

.style-instructions {
  background: var(--color-bg-elevated);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.style-instructions strong {
  display: block;
  margin-bottom: var(--space-xs);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.style-instructions p {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text);
}

.style-meta {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.badge {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-success {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.badge-inactive {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
}

.order-badge {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Modal styles (reusing from index.vue) */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  padding: var(--space-lg);
  overflow-y: auto;
}

.modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  margin: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
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
  overflow-y: auto;
  flex: 1;
  min-height: 0;
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

.form-group input,
.form-group textarea {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-lg);
  align-items: end;
}

.form-group-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

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
  flex-shrink: 0;
}
</style>
