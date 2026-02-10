<script setup lang="ts">
import { 
  FileText, 
  ScrollText, 
  Image as ImageIcon, 
  Zap, 
  CheckCircle2, 
  ChevronRight 
} from 'lucide-vue-next'

const props = defineProps<{
  currentStep: 'dossier' | 'script' | 'storyboard' | 'motion' | 'master'
  status?: Record<string, 'pending' | 'processing' | 'completed' | 'error'>
}>()

const steps = [
  { id: 'dossier', name: 'Dossier', icon: FileText, desc: 'Pesquisa Base' },
  { id: 'script', name: 'Script', icon: ScrollText, desc: 'Roteiro IA' },
  { id: 'storyboard', name: 'Storyboard', icon: ImageIcon, desc: 'Cenas & Visual' },
  { id: 'motion', name: 'Motion', icon: Zap, desc: 'Animação' },
  { id: 'master', name: 'Master', icon: CheckCircle2, desc: 'Finalização' },
]

const stepsOrder = ['dossier', 'script', 'storyboard', 'motion', 'master']
const currentIndex = computed(() => stepsOrder.indexOf(props.currentStep))

function getStepStatus(stepId: string, index: number) {
  if (index < currentIndex.value) return 'completed'
  if (index === currentIndex.value) return 'active'
  return 'upcoming'
}
</script>

<template>
  <div class="glass-card p-6 mb-8 overflow-hidden relative group">
    <!-- Background Scanline Effect -->
    <div class="absolute inset-0 pointer-events-none opacity-10 overflow-hidden">
      <div class="w-full h-1 bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-scanline"></div>
    </div>

    <div class="relative flex items-center justify-between gap-2 md:gap-4">
      <template v-for="(step, index) in steps" :key="step.id">
        <!-- Step Item -->
        <div class="flex flex-col items-center gap-2 group/step relative z-10 transition-all duration-500"
             :class="[getStepStatus(step.id, index) === 'upcoming' ? 'opacity-40 grayscale' : 'opacity-100']">
          
          <!-- Icon Circle -->
          <div :class="[
            'w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border-2',
            getStepStatus(step.id, index) === 'completed' ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' :
            getStepStatus(step.id, index) === 'active' ? 'bg-primary/20 border-primary text-primary shadow-glow animate-pulse' :
            'bg-white/5 border-white/10 text-white/30'
          ]">
            <component :is="step.icon" :size="24" :stroke-width="getStepStatus(step.id, index) === 'active' ? 2.5 : 1.5" />
          </div>

          <!-- Label -->
          <div class="text-center">
            <p class="text-xs md:text-xs font-black uppercase tracking-tighter"
               :class="getStepStatus(step.id, index) === 'active' ? 'text-primary' : 'text-white'">
              {{ step.name }}
            </p>
            <p class="hidden md:block text-xs font-mono text-muted-foreground mt-0.5 whitespace-nowrap">
              {{ step.desc }}
            </p>
          </div>

          <!-- Active Indicator Glow -->
          <div v-if="getStepStatus(step.id, index) === 'active'" 
               class="absolute -inset-2 bg-primary/10 blur-xl rounded-full -z-10 animate-pulse"></div>
        </div>

        <!-- Connector -->
        <div v-if="index < steps.length - 1" 
             class="flex-1 h-px max-w-[40px] md:max-w-none transition-all duration-1000"
             :class="index < currentIndex ? 'bg-blue-500/50' : 'bg-white/10'">
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.animate-scanline {
  animation: scanline 4s linear infinite;
}

@keyframes scanline {
  0% { top: -100%; }
  100% { top: 200%; }
}
</style>
