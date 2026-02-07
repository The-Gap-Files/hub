<template>
  <div class="glass-card overflow-hidden">
    <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
          <ImageIcon :size="20" />
        </div>
        <h3 class="text-sm font-black uppercase tracking-[0.2em] text-white">Visual Intelligence</h3>
      </div>
      <div class="flex gap-2">
        <input 
          type="file" 
          ref="fileInput" 
          class="hidden" 
          accept="image/*" 
          @change="handleFileSelect"
        />
        <button 
          @click="fileInput?.click()" 
          class="btn-secondary !py-1.5 !px-4 text-[10px] uppercase tracking-widest border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10"
          :disabled="uploading"
        >
          <span v-if="!uploading" class="flex items-center gap-2">
            <Upload :size="14" />
            Injetar Frame
          </span>
          <span v-else class="flex items-center gap-2">
            <div class="w-3 h-3 border-2 border-indigo-400/20 border-t-indigo-400 rounded-full animate-spin"></div>
            Processando
          </span>
        </button>
      </div>
    </div>

    <!-- Grid de Imagens (Cinematic Layout) -->
    <div class="p-8 max-h-[600px] overflow-y-auto custom-scrollbar">
      <div v-if="images.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
        <div 
          v-for="image in images" 
          :key="image.id"
          class="group relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] transition-all duration-700 hover:border-indigo-500/40"
        >
          <!-- Image Layer -->
          <img 
            :src="`/api/dossiers/images/${image.id}`" 
            :alt="image.description"
            class="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000"
          />
          
          <!-- Metadata Overlay -->
          <div class="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <div class="flex justify-between items-end gap-4">
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-mono text-indigo-400 uppercase tracking-widest mb-1">Asset ID: {{ image.id.slice(0, 8) }}</p>
                <h4 class="text-white font-bold text-sm truncate uppercase tracking-tighter">{{ image.description }}</h4>
                <div v-if="image.tags" class="flex gap-2 mt-2">
                   <span v-for="tag in image.tags.split(',')" :key="tag" class="text-[8px] font-black uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                     {{ tag.trim() }}
                   </span>
                </div>
              </div>
              <div class="flex gap-2">
                <button @click="viewFull(image)" class="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-primary hover:border-primary transition-all">
                  <Maximize2 :size="18" />
                </button>
                <button @click="deleteImage(image.id)" class="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-red-600 hover:border-red-600 transition-all">
                  <Trash2 :size="18" />
                </button>
              </div>
            </div>
          </div>

          <!-- Scanline overlay (subtle) -->
          <div class="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
        </div>
      </div>
      
      <div v-else class="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
        <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-white/5">
          <Film :size="32" />
        </div>
        <p class="mono-label opacity-30 italic">Nenhum asset visual injetado no setor.</p>
      </div>
    </div>

    <!-- Modal: Data Injection Detail -->
    <div v-if="showUploadModal" 
      class="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[100] p-4 overflow-y-auto"
      @click.self="cancelUpload"
    >
       <div class="glass-card max-w-lg w-full relative animate-in zoom-in-95 duration-500 border-indigo-500/20 shadow-glow flex flex-col my-auto">
         
         <div class="p-8">
           <div class="flex items-center justify-between mb-6">
              <h4 class="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <Zap :size="20" class="text-indigo-500" />
                Configurar Frame
              </h4>
           </div>
           
           <div class="aspect-video rounded-xl overflow-hidden border border-white/10 mb-6 bg-black group shrink-0 relative">
              <img :src="uploadPreview" class="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
           </div>

           <div class="space-y-5">
             <div class="space-y-1.5">
               <label class="mono-label !text-[9px] text-indigo-200/70">Identificador do Asset</label>
               <input 
                v-model="uploadForm.description" 
                type="text" 
                placeholder="Ex: Snapshot_SXV54-2024" 
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none transition-all placeholder:text-white/20"
               />
             </div>
             <div class="space-y-1.5">
               <label class="mono-label !text-[9px] text-indigo-200/70">Classificação (Tags)</label>
               <input 
                v-model="uploadForm.tags" 
                type="text" 
                placeholder="separados por vírgula..." 
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none transition-all placeholder:text-white/20"
               />
             </div>
           </div>
         </div>

         <div class="flex gap-3 p-6 pt-4 border-t border-white/5 bg-white/[0.02]">
           <button @click="confirmUpload" :disabled="uploading" class="btn-primary flex-1 py-3 !bg-indigo-600 hover:!bg-indigo-500 shadow-none border-none">
             <span v-if="!uploading" class="flex items-center justify-center gap-2 tracking-widest text-[10px] font-black">REGISTRAR ASSET</span>
             <span v-else class="flex items-center justify-center gap-2">
                <div class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                GRAVANDO...
             </span>
           </button>
           <button @click="cancelUpload" class="btn-secondary !px-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
             Abortar
           </button>
         </div>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  Image as ImageIcon, Upload, Maximize2, 
  Trash2, Film, Zap, X 
} from 'lucide-vue-next'

const props = defineProps<{
  dossierId: string
  initialImages: any[]
}>()

const emit = defineEmits(['updated'])

const fileInput = ref<HTMLInputElement | null>(null)
const images = ref([...props.initialImages])
const uploading = ref(false)
const showUploadModal = ref(false)
const uploadPreview = ref('')
const selectedFile = ref<File | null>(null)

const uploadForm = ref({
  description: '',
  tags: ''
})

async function handleFileSelect(event: any) {
  const file = event.target.files[0]
  if (!file) return

  selectedFile.value = file
  uploadPreview.value = URL.createObjectURL(file)
  uploadForm.value.description = file.name.split('.')[0]
  showUploadModal.value = true
  
  // Reset input
  event.target.value = ''
}

function cancelUpload() {
  showUploadModal.value = false
  selectedFile.value = null
  uploadPreview.value = ''
}

async function confirmUpload() {
  if (!selectedFile.value) return

  uploading.value = true
  try {
    // Converter para Base64
    const reader = new FileReader()
    const base64Promise = new Promise((resolve) => {
      reader.onload = () => resolve(reader.result?.toString().split(',')[1])
      reader.readAsDataURL(selectedFile.value!)
    })

    const base64Data = await base64Promise

    const response = await $fetch(`/api/dossiers/${props.dossierId}/images`, {
      method: 'POST',
      body: {
        description: uploadForm.value.description,
        tags: uploadForm.value.tags,
        imageData: base64Data,
        mimeType: selectedFile.value.type
      }
    })

    images.value.unshift(response as any)
    emit('updated')
    showUploadModal.value = false
    selectedFile.value = null
  } catch (error: any) {
    console.error('Erro no upload:', error)
    alert(error.data?.message || 'Erro ao fazer upload da imagem')
  } finally {
    uploading.value = false
  }
}

async function deleteImage(id: string) {
  if (!confirm('Eliminar este asset visual permanentemente?')) return
  try {
    // await $fetch(`/api/dossiers/${props.dossierId}/images/${id}`, { method: 'DELETE' })
    images.value = images.value.filter(img => img.id !== id)
    emit('updated')
  } catch (error) {
    console.error('Erro ao deletar imagem:', error)
  }
}

function viewFull(image: any) {
  window.open(`/api/dossiers/images/${image.id}`, '_blank')
}

// Watch props sync
watch(() => props.initialImages, (newVal) => {
  images.value = [...newVal]
})
</script>
