<template>
  <div class="container mx-auto p-8 max-w-7xl">
    <header class="flex flex-col md:flex-row justify-between items-end gap-6 mb-16 relative group">
      <div class="absolute -inset-x-8 -top-8 h-40 bg-gradient-to-b from-primary/5 to-transparent blur-3xl opacity-50"></div>

      <div class="relative space-y-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-glow">
            <Tv :size="24" />
          </div>
          <span class="mono-label tracking-[0.4em] text-primary/60">thegapfiles.tv</span>
        </div>
        <h1 class="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
          Canais
        </h1>
        <p class="text-zinc-500 font-medium max-w-md">Central de operações multi-canal. Cada canal é um vetor de distribuição com identidade própria.</p>
      </div>

      <button @click="openCreateModal" class="btn-primary !px-10 !py-4 shadow-glow group/btn">
        <span class="flex items-center gap-3">
          <Plus :size="20" class="group-hover/btn:rotate-90 transition-transform duration-500" />
          NOVO CANAL
        </span>
      </button>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-40 space-y-6">
      <div class="relative">
        <div class="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-2 h-2 bg-primary rounded-full animate-ping"></div>
        </div>
      </div>
      <p class="mono-label !text-xs text-primary animate-pulse tracking-[0.3em]">SCANNING_CHANNELS...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="channels.length === 0" class="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01]">
       <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-8 text-white/5">
         <Tv :size="48" />
       </div>
       <h3 class="text-2xl font-black text-white/30 uppercase italic mb-2">Nenhum Canal</h3>
       <p class="mono-label opacity-40 italic max-w-xs text-center">Crie seu primeiro canal para começar a organizar seus dossiers.</p>
       <button @click="openCreateModal" class="btn-secondary mt-10 !px-12">
         Criar Primeiro Canal
       </button>
    </div>

    <!-- Channel Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-for="channel in channels"
        :key="channel.id"
        class="glass-card group relative p-6 hover:border-primary/50 transition-all duration-700 cursor-pointer overflow-hidden"
        @click="openEditModal(channel)"
      >
        <!-- Background Reveal -->
        <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

        <div class="relative space-y-4">
          <!-- Header: Logo + Name -->
          <div class="flex items-start gap-4">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 group-hover:border-primary/40 transition-colors duration-500"
              :class="channel.logoBase64 ? '' : 'bg-gradient-to-br from-primary/20 to-primary/5'"
            >
              <img v-if="channel.logoBase64" :src="channel.logoBase64" :alt="channel.name" class="w-full h-full rounded-2xl object-cover" />
              <Tv v-else :size="24" class="text-primary/60" />
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-black text-white uppercase tracking-tight leading-tight group-hover:text-primary transition-colors truncate">
                {{ channel.name }}
              </h3>
              <span class="mono-label  text-primary/50">{{ channel.handle }}</span>
            </div>

            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :class="channel.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-600'"
              ></span>
            </div>
          </div>

          <!-- Description -->
          <p v-if="channel.description" class="text-zinc-500 text-xs line-clamp-2 leading-relaxed">
            {{ channel.description }}
          </p>

          <!-- Stats Row -->
          <div class="flex items-center gap-4 pt-2 border-t border-white/5">
            <div class="flex items-center gap-1.5">
              <Library :size="12" class="text-zinc-600" />
              <span class="mono-label  text-zinc-500">{{ channel.dossiersCount || 0 }} <span class="opacity-40">dossiers</span></span>
            </div>

            <div v-if="channel.platform" class="flex items-center gap-1.5 ml-auto">
              <span class="mono-label  px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-zinc-400 uppercase">{{ channel.platform }}</span>
            </div>
          </div>

          <!-- Visual Style + Script Style Tags -->
          <div v-if="channel.defaultVisualStyleId || channel.defaultScriptStyleId" class="flex flex-wrap gap-2">
            <span v-if="channel.defaultVisualStyleId" class="mono-label  px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md text-primary/60">
              🎨 {{ channel.defaultVisualStyleId }}
            </span>
            <span v-if="channel.defaultScriptStyleId" class="mono-label  px-2 py-0.5 bg-blue-400/10 border border-blue-400/20 rounded-md text-blue-400/60">
              📝 {{ channel.defaultScriptStyleId }}
            </span>
          </div>
        </div>

        <!-- Hover Scanline -->
        <div class="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-5 transition-opacity duration-1000 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      </div>
    </div>

    <!-- Channel Modal (Create/Edit) -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeModal"></div>

          <!-- Modal Content -->
          <div class="relative w-full max-w-lg bg-[#0C0C12] border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-white/5">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Tv :size="20" />
                </div>
                <div>
                  <h2 class="text-lg font-black text-white uppercase tracking-tight">
                    {{ isEditing ? 'Editar Canal' : 'Novo Canal' }}
                  </h2>
                  <span class="mono-label  text-zinc-500">{{ isEditing ? 'Protocolo de Modificação' : 'Protocolo de Criação' }}</span>
                </div>
              </div>
              <button @click="closeModal" class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                <X :size="16" />
              </button>
            </div>

            <!-- Form -->
            <div class="flex-1 overflow-y-auto p-6 space-y-5">
              <!-- Name -->
              <div class="space-y-1.5">
                <label class="mono-label  text-zinc-500 uppercase">Nome do Canal *</label>
                <input v-model="form.name" type="text" placeholder="The Gap Files" maxlength="100"
                  class="input-field w-full" />
              </div>

              <!-- Handle -->
              <div class="space-y-1.5">
                <label class="mono-label  text-zinc-500 uppercase">Handle *</label>
                <input v-model="form.handle" type="text" placeholder="@thegapfiles" maxlength="50"
                  class="input-field w-full" />
              </div>

              <!-- Description -->
              <div class="space-y-1.5">
                <label class="mono-label  text-zinc-500 uppercase">Descrição</label>
                <textarea v-model="form.description" placeholder="Mistérios e lacunas da história oficial..." rows="3"
                  class="input-field w-full resize-none"></textarea>
              </div>

              <!-- Platform -->
              <div class="space-y-1.5">
                <label class="mono-label  text-zinc-500 uppercase">Plataforma</label>
                <select v-model="form.platform" class="input-field w-full">
                  <option value="">Selecionar...</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TWITTER">Twitter / X</option>
                  <option value="MULTI">Multi-Plataforma</option>
                </select>
              </div>

              <!-- Visual Style -->
              <div class="space-y-1.5">
                <label class="mono-label  text-zinc-500 uppercase">Estilo Visual Padrão</label>
                <select v-model="form.defaultVisualStyleId" class="input-field w-full">
                  <option value="">Nenhum (herdar do dossier)</option>
                  <option v-for="style in visualStyles" :key="style.id" :value="style.id">
                    {{ style.name }}
                  </option>
                </select>
              </div>

              <!-- Script Style -->
              <div class="space-y-1.5">
                <label class="mono-label  text-zinc-500 uppercase">Estilo de Roteiro Padrão</label>
                <select v-model="form.defaultScriptStyleId" class="input-field w-full">
                  <option value="">Nenhum (herdar da classificação)</option>
                  <option v-for="style in scriptStyles" :key="style.id" :value="style.id">
                    {{ style.name }}
                  </option>
                </select>
              </div>

              <!-- Logo Upload -->
              <div class="space-y-1.5">
                <label class="mono-label  text-zinc-500 uppercase">Logo do Canal</label>
                <div class="flex items-center gap-4">
                  <div class="w-16 h-16 rounded-2xl border border-white/10 flex items-center justify-center bg-white/[0.02] overflow-hidden shrink-0">
                    <img v-if="form.logoBase64" :src="form.logoBase64" class="w-full h-full object-cover" />
                    <Upload v-else :size="20" class="text-zinc-600" />
                  </div>
                  <div class="flex-1">
                    <label class="btn-secondary !text-xs cursor-pointer inline-block">
                      <input type="file" accept="image/*" class="hidden" @change="handleLogoUpload" />
                      {{ form.logoBase64 ? 'Trocar Logo' : 'Selecionar' }}
                    </label>
                    <button v-if="form.logoBase64" @click="form.logoBase64 = ''; form.logoMimeType = ''" class="text-zinc-500 text-xs ml-3 hover:text-red-400 transition-colors">Remover</button>
                  </div>
                </div>
              </div>

              <!-- Active toggle (only in edit mode) -->
              <div v-if="isEditing" class="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <p class="text-xs font-bold text-white uppercase">Status do Canal</p>
                  <p class="mono-label  text-zinc-500">{{ form.isActive ? 'Canal receberá novos dossiers' : 'Canal desativado — não receberá novos dossiers' }}</p>
                </div>
                <button @click="form.isActive = !form.isActive"
                  class="w-12 h-6 rounded-full transition-all duration-300 relative"
                  :class="form.isActive ? 'bg-emerald-500/30 border border-emerald-500/50' : 'bg-zinc-700/30 border border-zinc-600'"
                >
                  <div class="w-5 h-5 rounded-full absolute top-0.5 transition-all duration-300"
                    :class="form.isActive ? 'left-6 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'left-0.5 bg-zinc-500'"
                  ></div>
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="p-6 border-t border-white/5 flex items-center justify-between gap-4">
              <button v-if="isEditing" @click="confirmDelete" class="text-red-400/60 text-xs hover:text-red-400 transition-colors flex items-center gap-2">
                <Trash2 :size="14" />
                Excluir Canal
              </button>
              <div v-else></div>

              <div class="flex gap-3">
                <button @click="closeModal" class="btn-secondary !px-6">Cancelar</button>
                <button @click="saveChannel" :disabled="saving" class="btn-primary !px-8 shadow-glow">
                  <span class="flex items-center gap-2">
                    <Loader2 v-if="saving" :size="16" class="animate-spin" />
                    {{ saving ? 'Salvando...' : (isEditing ? 'Salvar' : 'Criar Canal') }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Error -->
            <div v-if="errorMessage" class="px-6 pb-4">
              <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {{ errorMessage }}
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  Tv, Plus, Library, X, Upload,
  Trash2, Loader2
} from 'lucide-vue-next'

interface Channel {
  id: string
  name: string
  handle: string
  description: string | null
  platform: string | null
  logoBase64: string | null
  logoMimeType: string | null
  defaultVisualStyleId: string | null
  defaultScriptStyleId: string | null
  defaultSeedId: string | null
  isActive: boolean
  dossiersCount?: number
  createdAt: string
}

interface StyleOption {
  id: string
  name: string
}

const channels = ref<Channel[]>([])
const loading = ref(true)
const showModal = ref(false)
const saving = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const errorMessage = ref('')

const visualStyles = ref<StyleOption[]>([])
const scriptStyles = ref<StyleOption[]>([])

const form = ref({
  name: '',
  handle: '',
  description: '',
  platform: '',
  logoBase64: '',
  logoMimeType: '',
  defaultVisualStyleId: '',
  defaultScriptStyleId: '',
  isActive: true
})

// ─── Load Data ────────────────────────────────────────────────

async function loadChannels() {
  loading.value = true
  try {
    const response = await $fetch<any>('/api/channels', { query: { includeInactive: 'true' } })
    channels.value = response.channels
  } catch (error) {
    console.error('Erro ao carregar canais:', error)
  } finally {
    loading.value = false
  }
}

async function loadStyles() {
  try {
    const [vs, ss] = await Promise.all([
      $fetch<any>('/api/styles/visual'),
      $fetch<any>('/api/styles/script')
    ])
    visualStyles.value = vs.styles || vs
    scriptStyles.value = ss.styles || ss
  } catch {
    // Fallback silencioso
  }
}

// ─── Modal ────────────────────────────────────────────────────

function openCreateModal() {
  isEditing.value = false
  editingId.value = null
  errorMessage.value = ''
  form.value = {
    name: '',
    handle: '',
    description: '',
    platform: '',
    logoBase64: '',
    logoMimeType: '',
    defaultVisualStyleId: '',
    defaultScriptStyleId: '',
    isActive: true
  }
  showModal.value = true
}

function openEditModal(channel: Channel) {
  isEditing.value = true
  editingId.value = channel.id
  errorMessage.value = ''
  form.value = {
    name: channel.name,
    handle: channel.handle,
    description: channel.description || '',
    platform: channel.platform || '',
    logoBase64: channel.logoBase64 || '',
    logoMimeType: channel.logoMimeType || '',
    defaultVisualStyleId: channel.defaultVisualStyleId || '',
    defaultScriptStyleId: channel.defaultScriptStyleId || '',
    isActive: channel.isActive
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  errorMessage.value = ''
}

// ─── Save ─────────────────────────────────────────────────────

async function saveChannel() {
  if (!form.value.name.trim() || !form.value.handle.trim()) {
    errorMessage.value = 'Nome e handle são obrigatórios.'
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    if (isEditing.value && editingId.value) {
      await $fetch(`/api/channels/${editingId.value}`, {
        method: 'PATCH',
        body: form.value
      })
    } else {
      await $fetch('/api/channels', {
        method: 'POST',
        body: form.value
      })
    }

    closeModal()
    await loadChannels()
  } catch (error: any) {
    const msg = error?.data?.message || error?.message || 'Erro ao salvar canal'
    errorMessage.value = msg
  } finally {
    saving.value = false
  }
}

// ─── Delete ───────────────────────────────────────────────────

async function confirmDelete() {
  if (!editingId.value) return
  if (!confirm('Tem certeza que deseja excluir este canal? Dossiers vinculados ficarão sem canal.')) return

  try {
    await $fetch(`/api/channels/${editingId.value}`, { method: 'DELETE' })
    closeModal()
    await loadChannels()
  } catch (error: any) {
    errorMessage.value = error?.data?.message || 'Erro ao excluir canal'
  }
}

// ─── Logo Upload ──────────────────────────────────────────────

function handleLogoUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    errorMessage.value = 'Logo deve ter no máximo 2MB'
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    form.value.logoBase64 = e.target?.result as string
    form.value.logoMimeType = file.type
  }
  reader.readAsDataURL(file)
}

// ─── Lifecycle ────────────────────────────────────────────────

onMounted(() => {
  loadChannels()
  loadStyles()
})
</script>

<style scoped>
.input-field {
  @apply bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all duration-300;
  @apply focus:border-primary/50 focus:bg-white/[0.05] focus:shadow-[0_0_20px_rgba(250,84,1,0.05)];
}

select.input-field {
  @apply appearance-none cursor-pointer;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.75rem center;
  background-repeat: no-repeat;
  background-size: 1.25em 1.25em;
}

select.input-field option {
  @apply bg-[#0C0C12] text-white;
}

.modal-enter-active, .modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
