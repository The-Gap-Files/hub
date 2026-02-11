<script setup lang="ts">
import { 
  Zap, Cpu, Settings, Activity,
  Brain, Sparkles, Film, Scan,
  GitBranch, DollarSign, MessageCircle, Palette,
  ChevronDown, Check, AlertTriangle, RefreshCw,
  Loader2, Shield, Server, Key, Plus, Trash2,
  Eye, EyeOff, X,
  Image, Mic, Music, Video, Layout,
  ArrowRightLeft
} from 'lucide-vue-next'

// ─── Types ──────────────────────────────────────────────────────

interface LlmModel {
  id: string
  modelId?: string  // ID da API (ex: "gpt-4o") — vem do banco via Prisma
  name: string
  contextWindow: number
  costTier: 1 | 2 | 3 | 4 | 5
  supportsStructuredOutput: boolean
  supportsVision: boolean
}

interface LlmProvider {
  id: string
  name: string
  description: string
  envKey: string
  iconKey: string
  models: LlmModel[]
}

interface LlmTask {
  id: string
  label: string
  description: string
  iconKey: string
  requiresStructuredOutput: boolean
  requiresLargeContext: boolean
  defaultProvider: string
  defaultModel: string
}

interface LlmAssignment {
  taskId: string
  provider: string
  model: string
  temperature: number
}

interface AssignmentsResponse {
  assignments: LlmAssignment[]
  providers: LlmProvider[]
  tasks: LlmTask[]
  availableProviders: string[]
}

interface DbProvider {
  id: string
  name: string
  description: string | null
  apiKey: string | null
  baseUrl: string | null
  iconKey: string
  isActive: boolean
  models: DbModel[]
}

interface DbModel {
  id: string
  modelId: string
  name: string
  providerId: string
  contextWindow: number
  costTier: number
  supportsStructuredOutput: boolean
  supportsVision: boolean
  isActive: boolean
  inputSchema: any | null
}

interface ProviderStatusEntry {
  id: string
  name: string
  available: boolean
  envKey: string
}

interface StatusResponse {
  providers: ProviderStatusEntry[]
  availableCount: number
  totalCount: number
}

// ─── Data ──────────────────────────────────────────────────────

const { data: assignmentsData, refresh: refreshAssignments } = await useFetch<AssignmentsResponse>('/api/llm/assignments')
const { data: statusData, refresh: refreshStatus } = await useFetch<StatusResponse>('/api/llm/status')
const { data: dbProviders, refresh: refreshDbProviders } = await useFetch<DbProvider[]>('/api/llm/providers')
const { data: mediaData, refresh: refreshMedia } = await useFetch<any>('/api/media/assignments')

const isRefreshing = ref(false)
const savingTaskId = ref<string | null>(null)
const saveSuccess = ref<string | null>(null)
const expandedTaskId = ref<string | null>(null)

// ─── Media State ──────────────────────────────────────────────
const expandedMediaTaskId = ref<string | null>(null)
const savingMediaTaskId = ref<string | null>(null)
const saveMediaSuccess = ref<string | null>(null)

// ─── Provider Management State ──────────────────────────────
const editingProviderId = ref<string | null>(null)
const expandedProviderModels = ref<string | null>(null)
const showNewProviderForm = ref(false)
const savingProviderId = ref<string | null>(null)
const addingModelForProvider = ref<string | null>(null)

// Provider edit form
const editForm = reactive({
  apiKey: '',
  baseUrl: '',
  isActive: true,
  apiKeyChanged: false,
  showApiKey: false,
})

// New provider form
const newProviderForm = reactive({
  id: '',
  name: '',
  description: '',
  apiKey: '',
  iconKey: 'brain',
  showApiKey: false,
})

// New model form
const newModelForm = reactive({
  modelId: '',
  name: '',
  contextWindow: 128000,
  costTier: 2,
  supportsStructuredOutput: true,
  supportsVision: false,
  inputSchema: '',
})

// Estado para edição de schema em modelos existentes
const editingSchemaModelId = ref<string | null>(null)
const editSchemaText = ref('')
const savingSchemaModelId = ref<string | null>(null)
const convertingSchema = ref(false)

// Estado para teste de LLM (Inferência)
const llmTestMessage = ref('')
const llmTestLoading = ref<string | null>(null)
const llmTestResult = ref<{ taskId: string; success: boolean; response?: string; error?: string; elapsed?: string } | null>(null)

// Estado para teste de modelo de mídia
const testingMediaModelId = ref<string | null>(null)
const mediaTestResult = ref<{ modelId: string; success: boolean; type: string; message: string; previewUrl?: string; elapsed?: string; needsImage?: boolean } | null>(null)
const testImageBase64 = ref<string | null>(null)
const testImageName = ref<string | null>(null)

// ─── Computed ──────────────────────────────────────────────────

const tasks = computed(() => assignmentsData.value?.tasks || [])
const providers = computed(() => assignmentsData.value?.providers || [])

// Converter array de assignments para mapa indexado por taskId
const assignments = computed<Record<string, LlmAssignment>>(() => {
  const arr = assignmentsData.value?.assignments || []
  const map: Record<string, LlmAssignment> = {}
  arr.forEach(a => { map[a.taskId] = a })
  return map
})

const availableProviders = computed(() => assignmentsData.value?.availableProviders || [])

// Converter array de status para mapa indexado por provider id
const providerStatus = computed<Record<string, boolean>>(() => {
  const arr = statusData.value?.providers || []
  const map: Record<string, boolean> = {}
  arr.forEach(p => { map[p.id] = p.available })
  return map
})

const totalConfigured = computed(() => Object.keys(assignments.value).length)
const totalAvailable = computed(() => availableProviders.value.length)
const dbProviderCount = computed(() => (dbProviders.value || []).length)
const dbProvidersWithKey = computed(() => (dbProviders.value || []).filter(p => p.apiKey).length)

// ─── Media Computed ──────────────────────────────────────────────

const mediaTasks = computed(() => mediaData.value?.tasks || [])
const mediaProviders = computed(() => mediaData.value?.providers || [])
const mediaAssignments = computed<Record<string, any>>(() => {
  const arr = mediaData.value?.assignments || []
  const map: Record<string, any> = {}
  arr.forEach((a: any) => { map[a.taskId] = a })
  return map
})

// ─── Icon Mapping ──────────────────────────────────────────────

const taskIcons: Record<string, any> = {
  film: Film,
  scan: Scan,
  'git-branch': GitBranch,
  'dollar-sign': DollarSign,
  'message-circle': MessageCircle,
  palette: Palette,
}

const providerIcons: Record<string, any> = {
  brain: Brain,
  sparkles: Sparkles,
  zap: Zap,
}

const mediaTaskIcons: Record<string, any> = {
  image: Image,
  mic: Mic,
  music: Music,
  video: Video,
  layout: Layout,
}

const providerColors: Record<string, string> = {
  openai: 'emerald',
  anthropic: 'orange',
  groq: 'cyan',
  gemini: 'blue',
}

function getTaskIcon(iconKey: string) {
  return taskIcons[iconKey] || Cpu
}

function getProviderIcon(iconKey: string) {
  return providerIcons[iconKey] || Server
}

function getProviderColor(providerId: string): string {
  return providerColors[providerId] || 'zinc'
}

function getAssignmentForTask(taskId: string): LlmAssignment | undefined {
  return assignments.value[taskId]
}

function getModelForTask(taskId: string): LlmModel | undefined {
  const assignment = assignments.value[taskId]
  if (!assignment) return undefined
  const provider = providers.value.find(p => p.id === assignment.provider)
  return provider?.models.find(m => (m.modelId || m.id) === assignment.model)
}

function getProviderColorForAssignment(providerId: string | undefined): { bg: string, border: string, text: string } {
  if (providerId === 'openai') return { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#10b981' }
  if (providerId === 'anthropic') return { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', text: '#f97316' }
  if (providerId === 'gemini') return { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: '#3b82f6' }
  return { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)', text: '#06b6d4' }
}

function getProviderForTask(taskId: string): LlmProvider | undefined {
  const assignment = assignments.value[taskId]
  if (!assignment) return undefined
  return providers.value.find(p => p.id === assignment.provider)
}

function getCostLabel(tier: number): string {
  const labels = ['', 'Ultra Low', 'Low', 'Medium', 'High', 'Premium']
  return labels[tier] || 'Unknown'
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  return `${(tokens / 1000).toFixed(0)}K`
}

// ─── Media Helpers ──────────────────────────────────────────────

function getMediaTaskIcon(iconKey: string) {
  return mediaTaskIcons[iconKey] || Film
}

function getMediaAssignmentForTask(taskId: string): any | undefined {
  return mediaAssignments.value[taskId]
}

function getMediaProviderForTask(taskId: string): any | undefined {
  const assignment = mediaAssignments.value[taskId]
  if (!assignment) return undefined
  return mediaProviders.value.find((p: any) => p.id === assignment.provider)
}

function getMediaModelForTask(taskId: string): any | undefined {
  const assignment = mediaAssignments.value[taskId]
  if (!assignment) return undefined
  const provider = mediaProviders.value.find((p: any) => p.id === assignment.provider)
  return provider?.models.find((m: any) => m.id === assignment.model)
}

// ─── Actions ──────────────────────────────────────────────────

function toggleTask(taskId: string) {
  expandedTaskId.value = expandedTaskId.value === taskId ? null : taskId
}

function toggleMediaTask(taskId: string) {
  expandedMediaTaskId.value = expandedMediaTaskId.value === taskId ? null : taskId
}

async function updateAssignment(taskId: string, providerId: string, modelId: string, temperature?: number) {
  savingTaskId.value = taskId
  saveSuccess.value = null
  try {
    await $fetch('/api/llm/assignments', {
      method: 'PUT',
      body: { taskId, provider: providerId, model: modelId, temperature }
    })
    await refreshAssignments()
    saveSuccess.value = taskId
    setTimeout(() => {
      if (saveSuccess.value === taskId) saveSuccess.value = null
    }, 2000)
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao salvar configuração')
  } finally {
    savingTaskId.value = null
  }
}

async function selectProvider(taskId: string, providerId: string) {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider) return
  // Seleciona o primeiro modelo do provider (usa modelId da API, nao o UUID do Prisma)
  const firstModel = provider.models[0]
  if (!firstModel) return
  await updateAssignment(taskId, providerId, firstModel.modelId || firstModel.id)
}

async function selectModel(taskId: string, modelId: string) {
  const assignment = assignments.value[taskId]
  if (!assignment) return
  await updateAssignment(taskId, assignment.provider, modelId)
}

async function resetToDefault(taskId: string) {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return
  await updateAssignment(taskId, task.defaultProvider, task.defaultModel)
}

/** Testa o modelo LLM da task: envia mensagem e exibe a resposta */
async function testLlm(taskId: string) {
  const msg = llmTestMessage.value.trim()
  if (!msg) return
  llmTestLoading.value = taskId
  llmTestResult.value = null
  try {
    const result = await $fetch<{ success: boolean; response?: string; error?: string; elapsed?: string }>('/api/llm/test-model', {
      method: 'POST',
      body: { taskId, message: msg }
    })
    llmTestResult.value = {
      taskId,
      success: result.success,
      response: result.response,
      error: result.error,
      elapsed: result.elapsed
    }
  } catch (err: any) {
    llmTestResult.value = {
      taskId,
      success: false,
      error: err.data?.message || err.message || 'Erro ao testar'
    }
  } finally {
    llmTestLoading.value = null
  }
}

// ─── Media Actions ──────────────────────────────────────────────

async function updateMediaAssignment(taskId: string, provider: string, model: string) {
  savingMediaTaskId.value = taskId
  saveMediaSuccess.value = null
  try {
    await $fetch('/api/media/assignments', {
      method: 'PUT',
      body: { taskId, provider, model }
    })
    await refreshMedia()
    saveMediaSuccess.value = taskId
    setTimeout(() => { if (saveMediaSuccess.value === taskId) saveMediaSuccess.value = null }, 2000)
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao salvar configuração')
  } finally {
    savingMediaTaskId.value = null
  }
}

async function selectMediaProvider(taskId: string, providerId: string) {
  const provider = mediaProviders.value.find((p: any) => p.id === providerId)
  if (!provider) return
  const firstModel = provider.models[0]
  if (!firstModel) return
  await updateMediaAssignment(taskId, providerId, firstModel.modelId)
}

async function selectMediaModel(taskId: string, modelId: string) {
  const assignment = mediaAssignments.value[taskId]
  if (!assignment) return
  await updateMediaAssignment(taskId, assignment.provider, modelId)
}

async function resetMediaToDefault(taskId: string) {
  const task = mediaTasks.value.find((t: any) => t.id === taskId)
  if (!task) return
  await updateMediaAssignment(taskId, task.defaultProvider, task.defaultModel)
}

/** Testa o modelo de mídia atualmente selecionado para uma task */
async function testMediaModel(taskId: string) {
  const assignment = mediaAssignments.value[taskId]
  if (!assignment?.provider || !assignment?.model) return

  testingMediaModelId.value = assignment.model
  mediaTestResult.value = null

  try {
    const result = await $fetch<{
      success: boolean
      type: string
      modelName: string
      message: string
      previewUrl?: string
      elapsed?: string
      error?: string
      needsImage?: boolean
    }>('/api/media/test-model', {
      method: 'POST',
      body: {
        providerId: assignment.provider,
        modelId: assignment.model,
        testImageBase64: testImageBase64.value || undefined
      }
    })

    mediaTestResult.value = {
      modelId: assignment.model,
      success: result.success,
      type: result.type,
      message: result.message,
      previewUrl: result.previewUrl,
      elapsed: result.elapsed,
      needsImage: result.needsImage
    }
  } catch (error: any) {
    mediaTestResult.value = {
      modelId: assignment.model,
      success: false,
      type: 'unknown',
      message: `❌ Erro ao testar modelo: ${error.data?.message || error.message || 'Erro desconhecido'}`
    }
  } finally {
    testingMediaModelId.value = null
  }
}

/** Handler do input file para imagem de teste */
function onTestImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  testImageName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    testImageBase64.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

/** Remove imagem de teste */
function clearTestImage() {
  testImageBase64.value = null
  testImageName.value = null
}

/** Detecta se a task de mídia atualmente tem modelo de motion (precisa de imagem) */
function isMotionTask(taskId: string): boolean {
  const assignment = mediaAssignments.value[taskId]
  if (!assignment?.provider || !assignment?.model) return false
  const provider = mediaProviders.value.find((p: any) => p.id === assignment.provider)
  if (!provider) return false
  const model = provider.models?.find((m: any) => (m.modelId || m.id) === assignment.model)
  const schema = model?.inputSchema as any
  return !!schema?.imageField
}

async function handleRefresh() {
  isRefreshing.value = true
  try {
    await Promise.all([refreshAssignments(), refreshStatus(), refreshDbProviders(), refreshMedia()])
  } finally {
    setTimeout(() => { isRefreshing.value = false }, 600)
  }
}

// ─── Provider Management Actions ────────────────────────────

function startEditProvider(provider: DbProvider) {
  editingProviderId.value = provider.id
  editForm.apiKey = ''
  editForm.baseUrl = provider.baseUrl || ''
  editForm.isActive = provider.isActive
  editForm.apiKeyChanged = false
  editForm.showApiKey = false
}

function cancelEditProvider() {
  editingProviderId.value = null
  editForm.apiKey = ''
  editForm.baseUrl = ''
  editForm.isActive = true
  editForm.apiKeyChanged = false
  editForm.showApiKey = false
}

async function saveProviderApiKey(providerId: string) {
  savingProviderId.value = providerId
  try {
    const body: Record<string, unknown> = {
      baseUrl: editForm.baseUrl || undefined,
      isActive: editForm.isActive,
    }
    // Só envia apiKey se o usuário digitou algo novo
    if (editForm.apiKeyChanged && editForm.apiKey) {
      body.apiKey = editForm.apiKey
    }
    await $fetch(`/api/llm/providers/${providerId}`, {
      method: 'PUT',
      body
    })
    await Promise.all([refreshDbProviders(), refreshStatus(), refreshAssignments()])
    editingProviderId.value = null
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao salvar provider')
  } finally {
    savingProviderId.value = null
  }
}

function resetNewProviderForm() {
  newProviderForm.id = ''
  newProviderForm.name = ''
  newProviderForm.description = ''
  newProviderForm.apiKey = ''
  newProviderForm.iconKey = 'brain'
  newProviderForm.showApiKey = false
}

async function addProvider() {
  if (!newProviderForm.id || !newProviderForm.name) {
    alert('ID e Nome são obrigatórios')
    return
  }
  savingProviderId.value = '__new__'
  try {
    await $fetch('/api/llm/providers', {
      method: 'POST',
      body: {
        id: newProviderForm.id,
        name: newProviderForm.name,
        description: newProviderForm.description || undefined,
        apiKey: newProviderForm.apiKey || undefined,
        iconKey: newProviderForm.iconKey,
      }
    })
    await Promise.all([refreshDbProviders(), refreshStatus(), refreshAssignments()])
    showNewProviderForm.value = false
    resetNewProviderForm()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao criar provider')
  } finally {
    savingProviderId.value = null
  }
}

async function deleteProvider(id: string) {
  if (!confirm(`Remover provider "${id}" e todos os seus modelos?`)) return
  try {
    await $fetch(`/api/llm/providers/${id}`, { method: 'DELETE' })
    await Promise.all([refreshDbProviders(), refreshStatus(), refreshAssignments()])
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao remover provider')
  }
}

function resetNewModelForm() {
  newModelForm.modelId = ''
  newModelForm.name = ''
  newModelForm.contextWindow = 128000
  newModelForm.costTier = 2
  newModelForm.supportsStructuredOutput = true
  newModelForm.supportsVision = false
  newModelForm.inputSchema = ''
}

async function addModel(providerId: string) {
  if (!newModelForm.modelId || !newModelForm.name) {
    alert('Model ID e Nome são obrigatórios')
    return
  }
  savingProviderId.value = providerId
  try {
    await $fetch('/api/llm/models', {
      method: 'POST',
      body: {
        modelId: newModelForm.modelId,
        name: newModelForm.name,
        providerId,
        contextWindow: newModelForm.contextWindow,
        costTier: newModelForm.costTier,
        supportsStructuredOutput: newModelForm.supportsStructuredOutput,
        supportsVision: newModelForm.supportsVision,
        inputSchema: newModelForm.inputSchema.trim() || undefined,
      }
    })
    await Promise.all([refreshDbProviders(), refreshAssignments()])
    addingModelForProvider.value = null
    resetNewModelForm()
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao adicionar modelo')
  } finally {
    savingProviderId.value = null
  }
}

function toggleEditSchema(model: any) {
  if (editingSchemaModelId.value === model.id) {
    editingSchemaModelId.value = null
    return
  }
  editingSchemaModelId.value = model.id
  editSchemaText.value = model.inputSchema ? JSON.stringify(model.inputSchema, null, 2) : ''
}

async function saveSchema(modelId: string) {
  savingSchemaModelId.value = modelId
  try {
    const inputSchema = editSchemaText.value.trim() || null
    // Validar JSON antes de enviar
    if (inputSchema) {
      try { JSON.parse(inputSchema) } catch { alert('JSON inválido'); return }
    }
    await $fetch(`/api/llm/models/${modelId}`, {
      method: 'PUT',
      body: { inputSchema }
    })
    await Promise.all([refreshDbProviders(), refreshMedia()])
    editingSchemaModelId.value = null
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao salvar schema')
  } finally {
    savingSchemaModelId.value = null
  }
}

/** Converte JSON Schema do Replicate no editor de schema existente. */
async function convertEditSchema() {
  return convertReplicateSchema(() => editSchemaText.value, v => { editSchemaText.value = v })
}

/** Converte JSON Schema do Replicate no formulário de novo modelo. */
async function convertNewModelSchema() {
  return convertReplicateSchema(() => newModelForm.inputSchema, v => { newModelForm.inputSchema = v })
}

/** Converte JSON Schema do Replicate para formato interno. getText/setText para o textarea. */
async function convertReplicateSchema(getText: () => string, setText: (v: string) => void) {
  const raw = getText().trim()
  if (!raw) {
    alert('Cole o JSON Schema do Replicate no campo e clique em Converter.')
    return
  }
  convertingSchema.value = true
  try {
    const parsed = JSON.parse(raw)
    const { inputSchema } = await $fetch<{ inputSchema: object }>('/api/llm/convert-replicate-schema', {
      method: 'POST',
      body: { jsonSchema: parsed }
    })
    setText(JSON.stringify(inputSchema, null, 2))
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao converter. Cole o JSON Schema do Replicate (type, properties, required).')
  } finally {
    convertingSchema.value = false
  }
}

async function deleteModel(modelId: string) {
  if (!confirm('Remover este modelo?')) return
  try {
    await $fetch(`/api/llm/models/${modelId}`, { method: 'DELETE' })
    await Promise.all([refreshDbProviders(), refreshAssignments()])
  } catch (error: any) {
    alert(error.data?.message || 'Erro ao remover modelo')
  }
}

const iconOptions = [
  { value: 'brain', label: 'Brain' },
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'zap', label: 'Zap' },
  { value: 'cpu', label: 'CPU' },
  { value: 'server', label: 'Server' },
]
</script>

<template>
  <div class="min-h-screen bg-oled-black pb-20 selection:bg-amber-500/30">
    <div class="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-1000">
      <!-- ─── Header Heroico ──────────────────────────────────── -->
      <header class="relative mb-16 group">
        <!-- Backglow animado -->
        <div class="absolute -inset-x-8 -top-8 h-48 bg-gradient-to-b from-amber-500/[0.07] via-amber-500/[0.03] to-transparent blur-3xl opacity-70 animate-pulse-slow"></div>
        <div class="absolute -inset-x-4 -top-4 h-32 bg-gradient-to-r from-transparent via-amber-500/[0.04] to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        
        <div class="relative flex flex-col md:flex-row justify-between items-end gap-6">
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.25)] border border-amber-500/20">
                <Zap :size="24" />
              </div>
              <div>
                <span class="mono-label tracking-[0.4em] text-amber-500/60 font-black">AI Core Matrix</span>
                <div class="flex items-center gap-2 mt-0.5">
                  <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_#10b981]"></div>
                  <span class="text-[10px] font-mono text-emerald-500/70 uppercase tracking-widest">System Online</span>
                </div>
              </div>
            </div>
            <h1 class="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
              Núcleos de <span class="text-amber-500">IA</span>
            </h1>
            <p class="text-zinc-500 font-medium max-w-md">Configure os terminais de inferência — escolha provider e modelo para cada tarefa de IA.</p>
          </div>

          <div class="flex items-center gap-3">
            <button 
              @click="handleRefresh" 
              class="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-amber-500 hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all"
              :class="{ 'animate-spin': isRefreshing }"
            >
              <RefreshCw :size="16" />
            </button>
            <!-- Métricas compactas inline -->
            <div class="flex items-center gap-3 bg-white/[0.02] border border-white/5 px-4 py-3 rounded-2xl">
              <div class="flex items-center gap-2 pr-3 border-r border-white/5">
                <Cpu :size="14" class="text-amber-500/60" />
                <div class="flex flex-col">
                  <span class="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Tasks</span>
                  <span class="text-xs font-black text-white">{{ totalConfigured }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 pr-3 border-r border-white/5">
                <Shield :size="14" class="text-emerald-500/60" />
                <div class="flex flex-col">
                  <span class="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Online</span>
                  <span class="text-xs font-black" :class="dbProvidersWithKey > 0 ? 'text-emerald-500' : 'text-red-500'">{{ dbProvidersWithKey }}/{{ dbProviderCount }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Activity :size="14" class="text-violet-500/60" />
                <div class="flex flex-col">
                  <span class="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Modelos</span>
                  <span class="text-xs font-black text-white">{{ providers.reduce((acc, p) => acc + p.models.length, 0) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- ─── Provider Node Grid ──────────────────────────────── -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 animate-in slide-in-from-bottom-5 duration-700">
        <div 
          v-for="dp in (dbProviders || [])" 
          :key="dp.id"
          class="glass-card p-5 border-white/5 flex items-center gap-4 group/provider relative overflow-hidden transition-all duration-300"
          :class="[
            dp.apiKey 
              ? 'hover:border-emerald-500/30' 
              : 'hover:border-red-500/30 opacity-60'
          ]"
        >
          <div 
            class="w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300 shrink-0"
            :style="{
              backgroundColor: dp.apiKey 
                ? (dp.id === 'openai' ? 'rgba(16,185,129,0.1)' : dp.id === 'anthropic' ? 'rgba(249,115,22,0.1)' : 'rgba(6,182,212,0.1)') 
                : 'rgba(239,68,68,0.1)',
              color: dp.apiKey 
                ? (dp.id === 'openai' ? '#10b981' : dp.id === 'anthropic' ? '#f97316' : '#06b6d4') 
                : 'rgba(239,68,68,0.5)',
              borderColor: dp.apiKey
                ? (dp.id === 'openai' ? 'rgba(16,185,129,0.2)' : dp.id === 'anthropic' ? 'rgba(249,115,22,0.2)' : 'rgba(6,182,212,0.2)')
                : 'rgba(239,68,68,0.2)'
            }"
          >
            <component :is="getProviderIcon(dp.iconKey)" :size="22" />
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="text-sm font-bold text-white">{{ dp.name }}</h4>
              <div 
                class="w-1.5 h-1.5 rounded-full"
                :class="dp.apiKey ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-red-500/50'"
              ></div>
            </div>
            <p class="text-xs text-zinc-600 truncate">{{ dp.models.length }} modelos disponíveis</p>
          </div>

          <div class="mono-label !text-xs" :class="dp.apiKey ? 'text-emerald-500/60' : 'text-red-500/40'">
            {{ dp.apiKey ? 'ONLINE' : 'NO KEY' }}
          </div>

          <!-- Scanline on hover -->
          <div class="absolute inset-0 pointer-events-none opacity-0 group-hover/provider:opacity-[0.03] transition-opacity duration-700 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
          <!-- Bottom scanline bar -->
          <div class="absolute inset-x-0 bottom-0 h-0.5 scale-x-0 group-hover/provider:scale-x-100 transition-transform duration-500 origin-left"
               :class="dp.apiKey ? 'bg-emerald-500' : 'bg-red-500/50'"></div>
        </div>
      </div>

      <!-- ─── Providers & API Keys ─────────────────────────────── -->
      <div class="mb-12 animate-in slide-in-from-bottom-8 duration-700 delay-100">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <Key :size="20" />
            </div>
            <div>
              <h2 class="text-lg font-black text-white tracking-wider uppercase">Providers & API Keys</h2>
              <p class="text-xs text-zinc-500">Credenciais e modelos registrados</p>
            </div>
          </div>
          <button
            @click="showNewProviderForm = !showNewProviderForm"
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all text-xs font-bold uppercase tracking-widest group/btn"
          >
            <Plus :size="14" class="group-hover/btn:rotate-90 transition-transform duration-300" />
            <span>Add Provider</span>
          </button>
        </div>

        <div class="space-y-3">
          <!-- Provider Cards -->
          <div 
            v-for="dp in (dbProviders || [])" 
            :key="'mgmt-' + dp.id"
            class="glass-card overflow-hidden transition-all duration-300"
            :class="editingProviderId === dp.id ? 'border-amber-500/30' : 'border-white/5 hover:border-white/10'"
          >
            <!-- Provider Summary Row -->
            <div class="p-5 flex items-center gap-4">
              <!-- Icon -->
              <div 
                class="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                :style="{
                  backgroundColor: dp.id === 'openai' ? 'rgba(16,185,129,0.1)' : dp.id === 'anthropic' ? 'rgba(249,115,22,0.1)' : 'rgba(6,182,212,0.1)',
                  color: dp.id === 'openai' ? '#10b981' : dp.id === 'anthropic' ? '#f97316' : '#06b6d4',
                  borderColor: dp.id === 'openai' ? 'rgba(16,185,129,0.2)' : dp.id === 'anthropic' ? 'rgba(249,115,22,0.2)' : 'rgba(6,182,212,0.2)'
                }"
              >
                <component :is="getProviderIcon(dp.iconKey)" :size="18" />
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <h4 class="text-sm font-bold text-white">{{ dp.name }}</h4>
                  <span class="mono-label text-zinc-600">{{ dp.id }}</span>
                  <span v-if="!dp.isActive" class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 text-xs font-bold">Inativo</span>
                </div>
                <p v-if="dp.description" class="text-xs text-zinc-600 line-clamp-1">{{ dp.description }}</p>
              </div>

              <!-- API Key badge -->
              <div class="flex items-center gap-2 shrink-0">
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold"
                  :class="dp.apiKey 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20'"
                >
                  <Key :size="11" />
                  <span>{{ dp.apiKey ? 'Configurada' : 'Não configurada' }}</span>
                </div>
                <span v-if="dp.apiKey" class="text-xs text-zinc-600 font-mono hidden md:block">{{ dp.apiKey }}</span>
              </div>

              <!-- Model count + expand toggle -->
              <button
                @click="expandedProviderModels = expandedProviderModels === dp.id ? null : dp.id"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all shrink-0"
              >
                <Cpu :size="12" />
                <span class="font-bold">{{ dp.models.length }} modelos</span>
                <ChevronDown :size="12" class="transition-transform duration-200" :class="expandedProviderModels === dp.id ? 'rotate-180' : ''" />
              </button>

              <!-- Edit button -->
              <button
                v-if="editingProviderId !== dp.id"
                @click="startEditProvider(dp)"
                class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-amber-500 hover:border-amber-500/30 transition-all font-bold shrink-0"
              >
                Editar
              </button>
              <button
                v-else
                @click="cancelEditProvider()"
                class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-all shrink-0"
              >
                <X :size="14" />
              </button>

              <!-- Delete button -->
              <button
                @click="deleteProvider(dp.id)"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
              >
                <Trash2 :size="14" />
              </button>
            </div>

            <!-- Edit Form (inline) -->
            <div v-if="editingProviderId === dp.id" class="border-t border-white/5 bg-white/[0.01] p-5 animate-in slide-in-from-top-2 fade-in duration-200">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <!-- API Key -->
                <div class="md:col-span-2">
                  <label class="field-label mb-1.5 block">API Key</label>
                  <div class="relative">
                    <input 
                      :type="editForm.showApiKey ? 'text' : 'password'"
                      v-model="editForm.apiKey"
                      @input="editForm.apiKeyChanged = true"
                      :placeholder="dp.apiKey || 'Nenhuma API key configurada'"
                      class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 font-mono focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 pr-10 transition-colors"
                    />
                    <button
                      type="button"
                      @click="editForm.showApiKey = !editForm.showApiKey"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <Eye v-if="!editForm.showApiKey" :size="16" />
                      <EyeOff v-else :size="16" />
                    </button>
                  </div>
                </div>

                <!-- Base URL -->
                <div>
                  <label class="field-label mb-1.5 block">Base URL <span class="text-zinc-600">(opcional)</span></label>
                  <input 
                    type="text"
                    v-model="editForm.baseUrl"
                    placeholder="https://api.provider.com/v1"
                    class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 font-mono focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                  />
                </div>

                <!-- isActive -->
                <div class="flex items-center gap-3">
                  <label class="field-label">Ativo</label>
                  <button
                    type="button"
                    @click="editForm.isActive = !editForm.isActive"
                    class="w-10 h-5 rounded-full transition-colors duration-200 relative"
                    :class="editForm.isActive ? 'bg-emerald-500' : 'bg-zinc-700'"
                  >
                    <div 
                      class="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200"
                      :class="editForm.isActive ? 'left-5' : 'left-0.5'"
                    ></div>
                  </button>
                </div>
              </div>

              <!-- Save -->
              <div class="mt-4 flex items-center gap-3">
                <button
                  @click="saveProviderApiKey(dp.id)"
                  :disabled="savingProviderId === dp.id"
                  class="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs uppercase tracking-widest hover:bg-amber-400 transition-all disabled:opacity-50"
                >
                  <Loader2 v-if="savingProviderId === dp.id" :size="14" class="animate-spin" />
                  <Check v-else :size="14" />
                  <span>Salvar</span>
                </button>
                <button
                  @click="cancelEditProvider()"
                  class="px-4 py-2 rounded-xl text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>

            <!-- Models Grid (expandable) -->
            <div v-if="expandedProviderModels === dp.id" class="border-t border-white/5 bg-white/[0.01] p-5 animate-in slide-in-from-top-2 fade-in duration-200">
              <div class="flex items-center justify-between mb-3">
                <span class="mono-label text-zinc-500">Modelos de {{ dp.name }}</span>
                <button
                  @click="addingModelForProvider = addingModelForProvider === dp.id ? null : dp.id; resetNewModelForm()"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all text-xs font-bold"
                >
                  <Plus :size="12" />
                  <span>Modelo</span>
                </button>
              </div>

              <!-- Model chips -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div 
                  v-for="model in dp.models" 
                  :key="model.id"
                  class="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/5 group/model"
                >
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-white truncate">{{ model.name }}</div>
                    <div class="text-xs text-zinc-600 font-mono truncate">{{ model.modelId }}</div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 text-xs font-mono">{{ formatContextWindow(model.contextWindow) }}</span>
                    <span 
                      class="px-1.5 py-0.5 rounded text-xs font-bold"
                      :class="[
                        model.costTier <= 2 ? 'bg-emerald-500/10 text-emerald-400' :
                        model.costTier <= 3 ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-red-500/10 text-red-400'
                      ]"
                    >
                      ${{ '·'.repeat(model.costTier) }}
                    </span>
                    <span v-if="model.supportsStructuredOutput" class="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-xs font-bold">JSON</span>
                    <span v-if="model.supportsVision" class="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-xs font-bold">V</span>
                    <!-- Schema badge -->
                    <button
                      @click.stop="toggleEditSchema(model)"
                      class="px-1.5 py-0.5 rounded text-xs font-bold cursor-pointer transition-all"
                      :class="model.inputSchema ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-white/5 text-zinc-600 hover:text-zinc-400'"
                    >
                      {{ model.inputSchema ? 'Schema' : '+ Schema' }}
                    </button>
                  </div>
                  <button
                    @click="deleteModel(model.id)"
                    class="w-6 h-6 rounded flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover/model:opacity-100 shrink-0"
                  >
                    <X :size="12" />
                  </button>
                  <!-- Schema editor (expandible) - DENTRO do v-for do model -->
                  <div v-if="editingSchemaModelId === model.id" class="col-span-full mt-2 p-3 rounded-lg bg-black/40 border border-amber-500/15 animate-in fade-in duration-200">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-bold text-amber-400 uppercase tracking-wider">Input Schema</span>
                      <div class="flex items-center gap-2">
                        <button
                          @click="convertEditSchema"
                          :disabled="convertingSchema"
                          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                          title="Converter JSON Schema do Replicate para formato interno"
                        >
                          <ArrowRightLeft :size="12" />
                          {{ convertingSchema ? 'Convertendo...' : 'Converter Replicate' }}
                        </button>
                        <button
                          @click="saveSchema(model.id)"
                          :disabled="savingSchemaModelId === model.id"
                          class="px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all disabled:opacity-50"
                        >
                          {{ savingSchemaModelId === model.id ? 'Salvando...' : 'Salvar' }}
                        </button>
                        <button @click="editingSchemaModelId = null" class="text-zinc-600 hover:text-white transition-colors">
                          <X :size="12" />
                        </button>
                      </div>
                    </div>
                    <textarea
                      v-model="editSchemaText"
                      rows="8"
                      placeholder='{"promptField":"prompt","dimensionMode":"aspect_ratio","defaults":{}}'
                      class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500/40 outline-none transition-all resize-y"
                    ></textarea>
                    <p class="text-xs text-zinc-600 mt-1">JSON que define como montar o payload da API. Deixe vazio para remover.</p>
                  </div>
                </div>
              </div>

              <!-- Add Model Form (inline) -->
              <div v-if="addingModelForProvider === dp.id" class="mt-4 p-4 rounded-xl bg-black/30 border border-amber-500/20 animate-in fade-in duration-200">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label class="field-label mb-1 block">Model ID</label>
                    <input 
                      v-model="newModelForm.modelId" 
                      placeholder="gpt-4o-mini"
                      class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 font-mono focus:border-amber-500/40 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label class="field-label mb-1 block">Nome</label>
                    <input 
                      v-model="newModelForm.name" 
                      placeholder="GPT-4o Mini"
                      class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label class="field-label mb-1 block">Context Window</label>
                    <input 
                      v-model.number="newModelForm.contextWindow" 
                      type="number"
                      class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500/40 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label class="field-label mb-1 block">Cost Tier (1-5)</label>
                    <input 
                      v-model.number="newModelForm.costTier" 
                      type="number" min="1" max="5"
                      class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500/40 focus:outline-none transition-colors"
                    />
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" v-model="newModelForm.supportsStructuredOutput" class="accent-amber-500" />
                      <span class="text-xs text-zinc-400">JSON</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" v-model="newModelForm.supportsVision" class="accent-amber-500" />
                      <span class="text-xs text-zinc-400">Vision</span>
                    </label>
                  </div>
                  <!-- Input Schema (JSON) -->
                  <div class="col-span-full space-y-1.5">
                    <div class="flex items-center justify-between">
                      <label class="text-xs text-zinc-500 font-medium">Input Schema (JSON)</label>
                      <button
                        type="button"
                        @click="convertNewModelSchema"
                        :disabled="convertingSchema"
                        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                        title="Converter JSON Schema do Replicate para formato interno"
                      >
                        <ArrowRightLeft :size="12" />
                        {{ convertingSchema ? 'Convertendo...' : 'Converter Replicate' }}
                      </button>
                    </div>
                    <textarea
                      v-model="newModelForm.inputSchema"
                      rows="4"
                      placeholder='Cole o JSON Schema do Replicate ou use formato: {"promptField":"prompt","dimensionMode":"aspect_ratio","defaults":{}}'
                      class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500/40 outline-none transition-all resize-y"
                    ></textarea>
                    <p class="text-xs text-zinc-600">Opcional. Cole o schema do Replicate e clique em Converter, ou escreva manualmente.</p>
                  </div>
                  <div class="flex items-end gap-2">
                    <button
                      @click="addModel(dp.id)"
                      :disabled="savingProviderId === dp.id"
                      class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-black font-bold text-xs uppercase tracking-widest hover:bg-amber-400 transition-all disabled:opacity-50"
                    >
                      <Loader2 v-if="savingProviderId === dp.id" :size="12" class="animate-spin" />
                      <Plus v-else :size="12" />
                      <span>Add</span>
                    </button>
                    <button
                      @click="addingModelForProvider = null"
                      class="px-3 py-2 rounded-lg text-zinc-500 hover:text-white text-xs font-bold transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- New Provider Form -->
          <div v-if="showNewProviderForm" class="glass-card border-amber-500/20 overflow-hidden animate-in slide-in-from-bottom-3 fade-in duration-300">
            <div class="p-5">
              <div class="flex items-center gap-2 mb-4">
                <Plus :size="16" class="text-amber-500" />
                <span class="text-sm font-bold text-white">Novo Provider</span>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label class="field-label mb-1.5 block">ID (slug)</label>
                  <input 
                    v-model="newProviderForm.id" 
                    placeholder="my-provider"
                    class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 font-mono focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                  />
                </div>
                <div>
                  <label class="field-label mb-1.5 block">Nome</label>
                  <input 
                    v-model="newProviderForm.name" 
                    placeholder="My Provider"
                    class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                  />
                </div>
                <div>
                  <label class="field-label mb-1.5 block">Ícone</label>
                  <select
                    v-model="newProviderForm.iconKey"
                    class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                  >
                    <option v-for="ico in iconOptions" :key="ico.value" :value="ico.value">{{ ico.label }}</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="field-label mb-1.5 block">Descrição <span class="text-zinc-600">(opcional)</span></label>
                  <input 
                    v-model="newProviderForm.description" 
                    placeholder="Descrição do provider"
                    class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                  />
                </div>
                <div>
                  <label class="field-label mb-1.5 block">API Key <span class="text-zinc-600">(opcional)</span></label>
                  <div class="relative">
                    <input 
                      :type="newProviderForm.showApiKey ? 'text' : 'password'"
                      v-model="newProviderForm.apiKey"
                      placeholder="sk-..."
                      class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 font-mono focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 pr-10 transition-colors"
                    />
                    <button
                      type="button"
                      @click="newProviderForm.showApiKey = !newProviderForm.showApiKey"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <Eye v-if="!newProviderForm.showApiKey" :size="16" />
                      <EyeOff v-else :size="16" />
                    </button>
                  </div>
                </div>
              </div>
              <div class="mt-4 flex items-center gap-3">
                <button
                  @click="addProvider()"
                  :disabled="savingProviderId === '__new__'"
                  class="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs uppercase tracking-widest hover:bg-amber-400 transition-all disabled:opacity-50"
                >
                  <Loader2 v-if="savingProviderId === '__new__'" :size="14" class="animate-spin" />
                  <Plus v-else :size="14" />
                  <span>Criar Provider</span>
                </button>
                <button
                  @click="showNewProviderForm = false; resetNewProviderForm()"
                  class="px-4 py-2 rounded-xl text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Task Cards ──────────────────────────────────────── -->
      <div class="space-y-4 animate-in slide-in-from-bottom-10 duration-700 delay-200">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
            <Brain :size="22" />
          </div>
          <div>
            <h2 class="text-lg font-black text-white uppercase tracking-wider">Inferência LLM</h2>
            <p class="text-xs text-zinc-500">Roteamento de tarefas de linguagem natural</p>
          </div>
        </div>

        <div 
          v-for="task in tasks" 
          :key="task.id"
          class="glass-card overflow-hidden transition-all duration-500 group/task relative"
          :class="[
            expandedTaskId === task.id 
              ? 'border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.08)]' 
              : 'border-white/5 hover:border-white/10'
          ]"
        >
          <!-- Task Summary Row -->
          <button
            @click="toggleTask(task.id)"
            class="w-full p-6 flex items-center gap-5 text-left transition-colors hover:bg-white/[0.02]"
          >
            <!-- Task Icon -->
            <div 
              class="w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 shrink-0"
              :class="expandedTaskId === task.id 
                ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]' 
                : 'bg-white/5 text-zinc-500 border-white/10 group-hover/task:text-white'"
            >
              <component :is="getTaskIcon(task.iconKey)" :size="22" />
            </div>

            <!-- Task Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-1">
                <h3 class="text-base font-bold text-white tracking-tight">{{ task.label }}</h3>
                <!-- Badges -->
                <span v-if="task.requiresStructuredOutput" class="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 text-xs font-bold uppercase tracking-wider border border-violet-500/20">
                  JSON
                </span>
                <span v-if="task.requiresLargeContext" class="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider border border-blue-500/20">
                  Large CTX
                </span>
              </div>
              <p class="text-xs text-zinc-600 line-clamp-1">{{ task.description }}</p>
            </div>

            <!-- Current Assignment Preview -->
            <div v-if="assignments[task.id]" class="flex items-center gap-3 shrink-0">
              <!-- Save success indicator -->
              <div v-if="saveSuccess === task.id" class="flex items-center gap-1.5 text-emerald-500 animate-in fade-in zoom-in duration-300">
                <Check :size="14" />
                <span class="text-xs font-bold uppercase tracking-widest">Saved</span>
              </div>
              
              <!-- Provider badge -->
              <div 
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold"
                :style="{
                  backgroundColor: getProviderColorForAssignment(getAssignmentForTask(task.id)?.provider).bg,
                  borderColor: getProviderColorForAssignment(getAssignmentForTask(task.id)?.provider).border,
                  color: getProviderColorForAssignment(getAssignmentForTask(task.id)?.provider).text
                }"
              >
                <component :is="getProviderIcon(getProviderForTask(task.id)?.iconKey || 'brain')" :size="12" />
                {{ getProviderForTask(task.id)?.name }}
              </div>
              
              <!-- Model name -->
              <span class="text-xs text-zinc-500 font-mono max-w-[180px] truncate hidden md:block">
                {{ getModelForTask(task.id)?.name || getAssignmentForTask(task.id)?.model }}
              </span>
            </div>

            <!-- Expand chevron -->
            <ChevronDown 
              :size="18" 
              class="text-zinc-600 transition-transform duration-300 shrink-0"
              :class="expandedTaskId === task.id ? 'rotate-180 text-amber-500' : ''"
            />
          </button>

          <!-- Expanded Configuration Panel -->
          <div 
            v-if="expandedTaskId === task.id" 
            class="border-t border-white/5 bg-white/[0.01] animate-in slide-in-from-top-2 fade-in duration-300"
          >
            <div class="p-6 space-y-6">
              <!-- Provider Selection -->
              <div>
                <label class="mono-label !text-zinc-500 mb-3 block">Provider</label>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    v-for="provider in providers"
                    :key="provider.id"
                    @click="selectProvider(task.id, provider.id)"
                    :disabled="!providerStatus[provider.id] || savingTaskId === task.id"
                    class="relative p-4 rounded-xl border transition-all duration-300 text-left group/prov"
                    :class="[
                      assignments[task.id]?.provider === provider.id
                        ? 'border-amber-500/40 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                        : providerStatus[provider.id]
                          ? 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                          : 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                    ]"
                  >
                    <!-- Selected indicator -->
                    <div 
                      v-if="assignments[task.id]?.provider === provider.id"
                      class="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"
                    >
                      <Check :size="12" class="text-black" />
                    </div>

                    <div class="flex items-center gap-3 mb-2">
                      <component 
                        :is="getProviderIcon(provider.iconKey)" 
                        :size="18" 
                        :style="{
                          color: provider.id === 'openai' ? '#10b981' 
                            : provider.id === 'anthropic' ? '#f97316' 
                            : '#06b6d4'
                        }"
                      />
                      <span class="text-sm font-bold text-white">{{ provider.name }}</span>
                    </div>
                    <p class="text-xs text-zinc-600 leading-relaxed line-clamp-2">{{ provider.description }}</p>
                    
                    <!-- Not available warning -->
                    <div v-if="!providerStatus[provider.id]" class="flex items-center gap-1.5 mt-2 text-red-500/60">
                      <AlertTriangle :size="10" />
                      <span class="text-xs font-medium">{{ provider.envKey }} não configurada</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Model Selection -->
              <div v-if="assignments[task.id]">
                <label class="mono-label !text-zinc-500 mb-3 block">Modelo</label>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <button
                    v-for="model in getProviderForTask(task.id)?.models || []"
                    :key="model.modelId || model.id"
                    @click="selectModel(task.id, model.modelId || model.id)"
                    :disabled="savingTaskId === task.id"
                    class="relative p-4 rounded-xl border transition-all duration-300 text-left"
                    :class="[
                      assignments[task.id]?.model === (model.modelId || model.id)
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    ]"
                  >
                    <!-- Selected dot -->
                    <div 
                      v-if="assignments[task.id]?.model === (model.modelId || model.id)" 
                      class="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"
                    >
                      <Check :size="12" class="text-black" />
                    </div>

                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-sm font-bold text-white">{{ model.name }}</span>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 mt-2">
                      <!-- Context Window -->
                      <span class="px-2 py-0.5 rounded-md bg-white/5 text-zinc-400 text-xs font-mono border border-white/5">
                        {{ formatContextWindow(model.contextWindow) }} ctx
                      </span>
                      <!-- Cost Tier -->
                      <span 
                        class="px-2 py-0.5 rounded-md text-xs font-bold border"
                        :class="[
                          model.costTier <= 2 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          model.costTier <= 3 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        ]"
                      >
                        ${{ '·'.repeat(model.costTier) }} {{ getCostLabel(model.costTier) }}
                      </span>
                      <!-- Structured Output -->
                      <span v-if="model.supportsStructuredOutput" class="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 text-xs font-bold border border-violet-500/20">
                        JSON
                      </span>
                      <!-- Vision -->
                      <span v-if="model.supportsVision" class="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 text-xs font-bold border border-sky-500/20">
                        👁 Vision
                      </span>
                    </div>
                    </button>
                </div>
              </div>

              <!-- Testar modelo (conversa / pergunta) -->
              <div v-if="assignments[task.id]" class="space-y-3 pt-4 border-t border-white/5">
                <label class="mono-label !text-zinc-500 block">Testar modelo</label>
                <p class="text-xs text-zinc-600">Envie uma pergunta ou mensagem e veja a resposta do modelo configurado para esta task.</p>
                <textarea
                  v-model="llmTestMessage"
                  rows="3"
                  placeholder="Digite sua pergunta ou conversa..."
                  class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 resize-y transition-colors"
                />
                <div class="flex items-center gap-3">
                  <button
                    @click="testLlm(task.id)"
                    :disabled="!llmTestMessage.trim() || llmTestLoading !== null"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40"
                    :class="llmTestLoading === task.id ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400'"
                  >
                    <Loader2 v-if="llmTestLoading === task.id" :size="14" class="animate-spin" />
                    <Zap v-else :size="14" />
                    <span>{{ llmTestLoading === task.id ? 'Enviando...' : 'Enviar' }}</span>
                  </button>
                  <span v-if="llmTestResult && llmTestResult.taskId === task.id && llmTestResult.elapsed" class="text-xs text-zinc-500 font-mono">⏱ {{ llmTestResult.elapsed }}</span>
                </div>
                <!-- Resultado -->
                <div
                  v-if="llmTestResult && llmTestResult.taskId === task.id"
                  class="rounded-xl border p-4 text-sm animate-in fade-in duration-200"
                  :class="llmTestResult.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'"
                >
                  <p v-if="llmTestResult.success" class="text-zinc-300 whitespace-pre-wrap">{{ llmTestResult.response }}</p>
                  <p v-else class="text-red-400">{{ llmTestResult.error }}</p>
                </div>
              </div>

              <!-- Footer Actions -->
              <div class="flex items-center justify-between pt-4 border-t border-white/5">
                <button 
                  @click="resetToDefault(task.id)"
                  :disabled="savingTaskId === task.id"
                  class="flex items-center gap-2 text-xs text-zinc-600 hover:text-amber-500 transition-colors"
                >
                  <RefreshCw :size="12" />
                  <span>Restaurar padrão</span>
                </button>

                <div v-if="savingTaskId === task.id" class="flex items-center gap-2 text-amber-500">
                  <Loader2 :size="14" class="animate-spin" />
                  <span class="text-xs font-bold uppercase tracking-widest">Salvando...</span>
                </div>

                <div v-if="getAssignmentForTask(task.id)" class="flex items-center gap-4 text-xs text-zinc-600">
                  <span class="font-mono">temp: {{ getAssignmentForTask(task.id)?.temperature }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Scanline on hover -->
          <div class="absolute inset-0 pointer-events-none opacity-0 group-hover/task:opacity-[0.02] transition-opacity duration-700 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
          <div class="absolute inset-x-0 bottom-0 h-0.5 bg-amber-500 scale-x-0 group-hover/task:scale-x-100 transition-transform duration-500 origin-left"></div>
        </div>
      </div>

      <!-- ─── Produção de Mídia ──────────────────────────────────── -->
      <div class="mt-12 space-y-4 animate-in slide-in-from-bottom-10 duration-700 delay-300">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
            <Film :size="22" />
          </div>
          <div>
            <h2 class="text-lg font-black text-white uppercase tracking-wider">Produção de Mídia</h2>
            <p class="text-xs text-zinc-500">Imagem, narração, trilha sonora e motion</p>
          </div>
        </div>

        <div 
          v-for="task in mediaTasks" 
          :key="'media-' + task.id"
          class="glass-card overflow-hidden transition-all duration-500 group/task relative"
          :class="[
            expandedMediaTaskId === task.id 
              ? 'border-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.08)]' 
              : 'border-white/5 hover:border-white/10'
          ]"
        >
          <!-- Media Task Summary Row -->
          <button
            @click="toggleMediaTask(task.id)"
            class="w-full p-6 flex items-center gap-5 text-left transition-colors hover:bg-white/[0.02]"
          >
            <!-- Task Icon -->
            <div 
              class="w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 shrink-0"
              :class="expandedMediaTaskId === task.id 
                ? 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
                : 'bg-white/5 text-zinc-500 border-white/10 group-hover/task:text-white'"
            >
              <component :is="getMediaTaskIcon(task.iconKey)" :size="22" />
            </div>

            <!-- Task Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-1">
                <h3 class="text-base font-bold text-white tracking-tight">{{ task.label }}</h3>
              </div>
              <p class="text-xs text-zinc-600 line-clamp-1">{{ task.description }}</p>
            </div>

            <!-- Current Assignment Preview -->
            <div v-if="mediaAssignments[task.id]" class="flex items-center gap-3 shrink-0">
              <!-- Save success indicator -->
              <div v-if="saveMediaSuccess === task.id" class="flex items-center gap-1.5 text-emerald-500 animate-in fade-in zoom-in duration-300">
                <Check :size="14" />
                <span class="text-xs font-bold uppercase tracking-widest">Saved</span>
              </div>
              
              <!-- Provider badge -->
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                <component :is="getMediaTaskIcon(getMediaProviderForTask(task.id)?.iconKey || 'video')" :size="12" />
                {{ getMediaProviderForTask(task.id)?.name || mediaAssignments[task.id]?.provider }}
              </div>
              
              <!-- Model name -->
              <span class="text-xs text-zinc-500 font-mono max-w-[180px] truncate hidden md:block">
                {{ getMediaModelForTask(task.id)?.name || mediaAssignments[task.id]?.model }}
              </span>
            </div>

            <!-- Expand chevron -->
            <ChevronDown 
              :size="18" 
              class="text-zinc-600 transition-transform duration-300 shrink-0"
              :class="expandedMediaTaskId === task.id ? 'rotate-180 text-indigo-500' : ''"
            />
          </button>

          <!-- Expanded Configuration Panel -->
          <div 
            v-if="expandedMediaTaskId === task.id" 
            class="border-t border-white/5 bg-white/[0.01] animate-in slide-in-from-top-2 fade-in duration-300"
          >
            <div class="p-6 space-y-6">
              <!-- Provider Selection -->
              <div>
                <label class="mono-label !text-zinc-500 mb-3 block">Provider</label>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    v-for="provider in mediaProviders"
                    :key="'mp-' + provider.id"
                    @click="selectMediaProvider(task.id, provider.id)"
                    :disabled="savingMediaTaskId === task.id"
                    class="relative p-4 rounded-xl border transition-all duration-300 text-left group/prov"
                    :class="[
                      mediaAssignments[task.id]?.provider === provider.id
                        ? 'border-indigo-500/40 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    ]"
                  >
                    <!-- Selected indicator -->
                    <div 
                      v-if="mediaAssignments[task.id]?.provider === provider.id"
                      class="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"
                    >
                      <Check :size="12" class="text-white" />
                    </div>

                    <div class="flex items-center gap-3 mb-2">
                      <component 
                        :is="getMediaTaskIcon(provider.iconKey || 'video')" 
                        :size="18" 
                        class="text-indigo-400"
                      />
                      <span class="text-sm font-bold text-white">{{ provider.name }}</span>
                    </div>
                    <p class="text-xs text-zinc-600 leading-relaxed line-clamp-2">{{ provider.description }}</p>
                  </button>
                </div>
              </div>

              <!-- Model Selection -->
              <div v-if="mediaAssignments[task.id]">
                <label class="mono-label !text-zinc-500 mb-3 block">Modelo</label>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <button
                    v-for="model in (getMediaProviderForTask(task.id)?.models || [])"
                    :key="'mm-' + model.modelId"
                    @click="selectMediaModel(task.id, model.modelId)"
                    :disabled="savingMediaTaskId === task.id"
                    class="relative p-4 rounded-xl border transition-all duration-300 text-left"
                    :class="[
                      mediaAssignments[task.id]?.model === model.modelId
                        ? 'border-indigo-500/40 bg-indigo-500/5'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    ]"
                  >
                    <!-- Selected dot -->
                    <div 
                      v-if="mediaAssignments[task.id]?.model === model.modelId" 
                      class="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"
                    >
                      <Check :size="12" class="text-white" />
                    </div>

                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-sm font-bold text-white">{{ model.name }}</span>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 mt-2">
                      <!-- Cost Tier -->
                      <span 
                        class="px-2 py-0.5 rounded-md text-xs font-bold border"
                        :class="[
                          (model.costTier || 1) <= 2 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          (model.costTier || 1) <= 3 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        ]"
                      >
                        ${{ '·'.repeat(model.costTier || 1) }} {{ getCostLabel(model.costTier || 1) }}
                      </span>
                      <!-- Capability tags -->
                      <span 
                        v-for="cap in (model.capabilities || [])" 
                        :key="cap"
                        class="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20"
                      >
                        {{ cap }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Test Result Banner -->
              <div 
                v-if="mediaTestResult && mediaAssignments[task.id]?.model && mediaTestResult.modelId === mediaAssignments[task.id]?.model"
                class="p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300"
                :class="mediaTestResult.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'"
              >
                <div class="flex items-start gap-3">
                  <div 
                    class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    :class="mediaTestResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'"
                  >
                    <Check v-if="mediaTestResult.success" :size="16" />
                    <AlertTriangle v-else :size="16" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold" :class="mediaTestResult.success ? 'text-emerald-400' : 'text-red-400'">{{ mediaTestResult.message }}</p>
                    <p v-if="mediaTestResult.elapsed" class="text-xs text-zinc-500 mt-1 font-mono">⏱ {{ mediaTestResult.elapsed }}</p>
                  </div>
                  <button @click="mediaTestResult = null" class="text-zinc-600 hover:text-white transition-colors shrink-0">
                    <X :size="14" />
                  </button>
                </div>
                <!-- Image Preview -->
                <div v-if="mediaTestResult.previewUrl && mediaTestResult.type === 'image'" class="mt-3">
                  <img :src="mediaTestResult.previewUrl" alt="Teste" class="rounded-lg max-h-48 border border-white/10" />
                </div>
                <!-- Video Preview (motion) -->
                <div v-if="mediaTestResult.previewUrl && mediaTestResult.type === 'motion'" class="mt-3">
                  <video controls autoplay muted loop :src="mediaTestResult.previewUrl" class="rounded-lg max-h-48 border border-white/10"></video>
                </div>
                <!-- Audio Preview (TTS / Music) -->
                <div v-if="mediaTestResult.previewUrl && (mediaTestResult.type === 'music' || mediaTestResult.type === 'tts')" class="mt-3">
                  <audio controls autoplay :src="mediaTestResult.previewUrl" class="w-full h-8 rounded"></audio>
                </div>
              </div>

              <!-- Test Image Upload (para motion/video models) -->
              <div 
                v-if="mediaAssignments[task.id]?.model && (mediaTestResult?.needsImage || isMotionTask(task.id))"
                class="p-4 rounded-xl border border-dashed transition-all duration-300"
                :class="testImageBase64 
                  ? 'border-indigo-500/30 bg-indigo-500/5' 
                  : 'border-white/10 bg-white/[0.02] hover:border-indigo-500/20'"
              >
                <div v-if="!testImageBase64" class="flex flex-col items-center gap-3 py-2">
                  <div class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Image :size="20" />
                  </div>
                  <div class="text-center">
                    <p class="text-sm font-bold text-zinc-300">Anexar imagem para teste</p>
                    <p class="text-xs text-zinc-600 mt-1">Modelos de motion animam imagens estáticas em vídeo</p>
                  </div>
                  <label class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-indigo-500/20 transition-all">
                    <Image :size="14" />
                    <span>Selecionar imagem</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      class="hidden" 
                      @change="onTestImageSelected"
                    />
                  </label>
                </div>

                <div v-else class="flex items-center gap-4">
                  <img :src="testImageBase64" :alt="testImageName || 'Imagem de teste'" class="w-16 h-16 rounded-lg object-cover border border-white/10" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-white truncate">{{ testImageName }}</p>
                    <p class="text-xs text-zinc-500 mt-0.5">Pronta para teste de motion</p>
                  </div>
                  <button @click="clearTestImage" class="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-red-400 transition-all">
                    <X :size="16" />
                  </button>
                </div>
              </div>

              <!-- Footer Actions -->
              <div class="flex items-center justify-between pt-4 border-t border-white/5">
                <button 
                  @click="resetMediaToDefault(task.id)"
                  :disabled="savingMediaTaskId === task.id"
                  class="flex items-center gap-2 text-xs text-zinc-600 hover:text-indigo-500 transition-colors"
                >
                  <RefreshCw :size="12" />
                  <span>Restaurar padrão</span>
                </button>

                <div class="flex items-center gap-3">
                  <div v-if="savingMediaTaskId === task.id" class="flex items-center gap-2 text-indigo-500">
                    <Loader2 :size="14" class="animate-spin" />
                    <span class="text-xs font-bold uppercase tracking-widest">Salvando...</span>
                  </div>

                  <!-- Test Button -->
                  <button
                    v-if="mediaAssignments[task.id]?.model"
                    @click.stop="testMediaModel(task.id)"
                    :disabled="testingMediaModelId !== null || (isMotionTask(task.id) && !testImageBase64)"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all"
                    :class="testingMediaModelId === mediaAssignments[task.id]?.model
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-indigo-500/10 hover:border-indigo-500/20 hover:text-indigo-400 disabled:opacity-30'"
                  >
                    <Loader2 v-if="testingMediaModelId === mediaAssignments[task.id]?.model" :size="14" class="animate-spin" />
                    <Zap v-else :size="14" />
                    <span>{{ testingMediaModelId === mediaAssignments[task.id]?.model ? 'Testando...' : 'Testar Modelo' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Scanline on hover -->
          <div class="absolute inset-0 pointer-events-none opacity-0 group-hover/task:opacity-[0.02] transition-opacity duration-700 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
          <div class="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500 scale-x-0 group-hover/task:scale-x-100 transition-transform duration-500 origin-left"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 10s linear infinite;
}

.animate-pulse-slow {
  animation: pulse-slow 4s ease-in-out infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse-slow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}
</style>
