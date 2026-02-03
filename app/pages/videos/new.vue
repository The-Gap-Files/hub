<script setup lang="ts">
interface VisualStyle {
  id: string
  name: string
  description: string
  isActive: boolean
}

interface ScriptStyle {
  id: string
  name: string
  description: string
  isActive: boolean
}

interface Seed {
  id: string
  name: string
  description: string | null
  value: number
  usageCount: number
  isDefault: boolean
  _count?: {
    videos: number
  }
}

const router = useRouter()

// Buscar estilos visuais
const { data: stylesData } = await useFetch<{ success: boolean; data: VisualStyle[] }>('/api/visual-styles')
const visualStyles = computed(() => stylesData.value?.data?.filter(s => s.isActive) || [])

// Buscar estilos de roteiro
const { data: scriptStylesData } = await useFetch<{ success: boolean; data: ScriptStyle[] }>('/api/script-styles')
const scriptStyles = computed(() => scriptStylesData.value?.data?.filter(s => s.isActive) || [])

// Form data - PRECISA SER DEFINIDO ANTES de usar em useFetch
const formData = ref({
  theme: '',
  scriptStyle: '',
  visualStyle: '',
  seedMode: 'default' as 'default' | 'specific' | 'random',
  seedId: '',
  aspectRatio: '16:9' as '9:16' | '16:9',
  duration: 185,
  enableMotion: false,
  mustInclude: '',
  mustExclude: ''
})

const selectedVisualStyle = computed(() => formData.value.visualStyle)

// Buscar seeds do estilo visual selecionado - AGORA selectedVisualStyle JÁ EXISTE
const { data: seedsData, refresh: refreshSeeds } = await useFetch<{ success: boolean; data: Seed[] }>(
  () => selectedVisualStyle.value 
    ? `/api/seeds/by-visual-style/${selectedVisualStyle.value}`
    : '/api/seeds',
  { watch: false }
)

const availableSeeds = computed(() => seedsData.value?.data || [])
const defaultSeed = computed(() => availableSeeds.value.find(s => s.isDefault))

const isSubmitting = ref(false)

// Quando muda o estilo visual, buscar seeds
watch(selectedVisualStyle, async (newStyle) => {
  if (newStyle) {
    await refreshSeeds()
    // Auto-selecionar seed padrão se existir
    if (formData.value.seedMode === 'default' && defaultSeed.value) {
      formData.value.seedId = defaultSeed.value.id
    }
  }
})

// Quando muda o modo de seed
watch(() => formData.value.seedMode, (mode) => {
  if (mode === 'default' && defaultSeed.value) {
    formData.value.seedId = defaultSeed.value.id
  } else if (mode === 'random') {
    formData.value.seedId = ''
  }
})

async function handleSubmit() {
  if (isSubmitting.value) return
  
  try {
    isSubmitting.value = true
    
    // Criar vídeo diretamente com $fetch
    await $fetch('/api/videos', {
      method: 'POST',
      body: {
        theme: formData.value.theme,
        style: formData.value.scriptStyle,
        visualStyle: formData.value.visualStyle,
        seedId: formData.value.seedMode === 'random' ? undefined : formData.value.seedId || undefined,
        aspectRatio: formData.value.aspectRatio,
        enableMotion: formData.value.enableMotion,
        targetDuration: formData.value.duration,
        mustInclude: formData.value.mustInclude.trim() || undefined,
        mustExclude: formData.value.mustExclude.trim() || undefined
      }
    })
    
    // Redirecionar para home
    router.push('/')
  } catch (error: any) {
    alert(error.message || 'Erro ao criar vídeo')
  } finally {
    isSubmitting.value = false
  }
}

function cancel() {
  router.push('/')
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="header-top">
        <button class="btn-back" @click="cancel">
          ← Voltar
        </button>
        <h1>Criar Novo Vídeo</h1>
      </div>
      <p>Configure todos os parâmetros para gerar seu vídeo</p>
    </div>

    <form @submit.prevent="handleSubmit" class="create-form">
      <!-- Tema -->
      <div class="form-section">
        <h2>📝 Tema</h2>
        <div class="form-group">
          <label>Tema do vídeo *</label>
          <input
            v-model="formData.theme"
            type="text"
            required
            placeholder="Ex: A Conspiração de Roswell"
          />
          <small>Sobre o que será o vídeo? Seja específico.</small>
        </div>
      </div>

      <!-- Estilos -->
      <div class="form-section">
        <h2>🎨 Estilos</h2>
        
        <div class="form-row">
          <div class="form-group">
            <label>Estilo de Roteiro *</label>
            <select v-model="formData.scriptStyle" required>
              <option value="">Selecione...</option>
              <option v-for="style in scriptStyles" :key="style.id" :value="style.id">
                {{ style.name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Estilo Visual *</label>
            <select v-model="formData.visualStyle" required>
              <option value="">Selecione...</option>
              <option v-for="style in visualStyles" :key="style.id" :value="style.id">
                {{ style.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Seed -->
      <div class="form-section">
        <h2>🌱 Seed (Controle Visual)</h2>
        
        <div class="seed-modes">
          <label class="radio-card" :class="{ active: formData.seedMode === 'default' }">
            <input type="radio" v-model="formData.seedMode" value="default" />
            <div class="radio-content">
              <div class="radio-header">
                <span class="radio-icon">🌟</span>
                <strong>Usar seed padrão</strong>
              </div>
              <p v-if="defaultSeed" class="radio-description">
                {{ defaultSeed.name }} ({{ defaultSeed.value }})<br>
                <small>Usado em {{ defaultSeed._count?.videos || 0 }} vídeos</small>
              </p>
              <p v-else class="radio-description muted">
                Nenhuma seed padrão definida para este estilo
              </p>
            </div>
          </label>

          <label class="radio-card" :class="{ active: formData.seedMode === 'specific' }">
            <input type="radio" v-model="formData.seedMode" value="specific" />
            <div class="radio-content">
              <div class="radio-header">
                <span class="radio-icon">🎯</span>
                <strong>Escolher seed específica</strong>
              </div>
              <p class="radio-description">
                Selecione uma receita visual testada
              </p>
            </div>
          </label>

          <label class="radio-card" :class="{ active: formData.seedMode === 'random' }">
            <input type="radio" v-model="formData.seedMode" value="random" />
            <div class="radio-content">
              <div class="radio-header">
                <span class="radio-icon">🎲</span>
                <strong>Aleatório (experimental)</strong>
              </div>
              <p class="radio-description">
                Gera uma nova seed a cada imagem
              </p>
            </div>
          </label>
        </div>

        <!-- Seletor de seed específica -->
        <div v-if="formData.seedMode === 'specific'" class="form-group">
          <label>Selecione a seed</label>
          <select v-model="formData.seedId" required>
            <option value="">Escolha...</option>
            <option v-for="seed in availableSeeds" :key="seed.id" :value="seed.id">
              {{ seed.name }} ({{ seed.value }}) - {{ seed.usageCount }} usos
            </option>
          </select>
        </div>
      </div>

      <!-- Configurações Técnicas -->
      <div class="form-section">
        <h2>⚙️ Configurações Técnicas</h2>
        
        <div class="form-row">
          <div class="form-group">
            <label>Proporção</label>
            <select v-model="formData.aspectRatio">
              <option value="16:9">16:9 (Paisagem)</option>
              <option value="9:16">9:16 (Retrato)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Duração Alvo (segundos)</label>
            <input
              v-model.number="formData.duration"
              type="number"
              min="60"
              max="600"
            />
            <small>{{ Math.floor(formData.duration / 60) }}min {{ formData.duration % 60 }}s</small>
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="formData.enableMotion" />
            <div>
              <strong>Habilitar Motion (Animação)</strong>
              <small>Adiciona movimento às imagens estáticas (aumenta tempo de processamento)</small>
            </div>
          </label>
        </div>
      </div>

      <!-- Diretrizes de Conteúdo -->
      <div class="form-section">
        <h2>📋 Diretrizes de Conteúdo (Opcional)</h2>
        
        <div class="form-group">
          <label>Deve incluir</label>
          <textarea
            v-model="formData.mustInclude"
            rows="2"
            placeholder="Ex: Mencionar teorias de conspiração, incluir dados históricos..."
          ></textarea>
          <small>O que o roteiro DEVE conter</small>
        </div>

        <div class="form-group">
          <label>Deve excluir</label>
          <textarea
            v-model="formData.mustExclude"
            rows="2"
            placeholder="Ex: Não mencionar nomes específicos, evitar teorias desmentidas..."
          ></textarea>
          <small>O que o roteiro NÃO deve conter</small>
        </div>
      </div>

      <!-- Botões -->
      <div class="form-actions">
        <button type="button" class="btn-secondary" @click="cancel">
          Cancelar
        </button>
        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Criando...' : 'Criar Vídeo' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page {
  padding: var(--space-xl);
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-2xl);
}

.header-top {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.btn-back {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-back:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-primary);
}

.page-header h1 {
  font-size: 2rem;
  color: var(--color-text);
}

.page-header p {
  color: var(--color-text-muted);
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
}

.form-section {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  border: 1px solid var(--color-border);
}

.form-section h2 {
  font-size: 1.25rem;
  color: var(--color-text);
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group:last-child {
  margin-bottom: 0;
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

/* Seed Modes */
.seed-modes {
  display: grid;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.radio-card {
  display: block;
  padding: var(--space-lg);
  background: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.radio-card:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-elevated);
}

.radio-card.active {
  border-color: var(--color-primary);
  background: rgba(139, 92, 246, 0.05);
}

.radio-card input[type="radio"] {
  display: none;
}

.radio-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.radio-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.radio-icon {
  font-size: 1.5rem;
}

.radio-header strong {
  color: var(--color-text);
  font-size: 1rem;
}

.radio-description {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0;
}

.radio-description.muted {
  font-style: italic;
}

.radio-description small {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

/* Checkbox Label */
.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.checkbox-label:hover {
  border-color: var(--color-primary);
}

.checkbox-label input[type="checkbox"] {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  cursor: pointer;
}

.checkbox-label strong {
  display: block;
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}

.checkbox-label small {
  display: block;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  padding-top: var(--space-xl);
  border-top: 1px solid var(--color-border);
}

.btn-primary,
.btn-secondary {
  padding: var(--space-md) var(--space-xl);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 1rem;
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
</style>
