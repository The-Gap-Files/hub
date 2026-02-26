<template>
  <div
    class="mb-12 grid gap-2 p-1 bg-white/5 rounded-2xl border border-white/5"
    :style="{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }"
  >
    <div
      v-for="step in steps"
      :key="step.label"
      class="pipeline-step"
      :class="getStepClass(step.isCompleted, step.isEnabled)"
      @click="step.isCompleted && step.revertStage ? $emit('revertToStage', step.revertStage) : null"
      :title="step.isCompleted && step.revertStage ? 'Clique para voltar a esta etapa' : ''"
    >
      <component :is="step.icon" :size="16" class="step-icon" />
      <Undo2 v-if="step.isCompleted && step.revertStage" :size="16" class="step-undo-icon" />
      <span class="text-xs font-black tracking-widest">{{ step.label }}</span>
      <span v-if="step.costKey && getStepCost(step.costKey) > 0" class="text-xs font-mono text-amber-400/70">
        {{ formatCost(getStepCost(step.costKey)) }}
        <span v-if="step.estimatedCostKey && isEstimatedCost(step.estimatedCostKey)" class="text-amber-500/50" title="Custo estimado (tokens reais indisponíveis)">~</span>
      </span>
      <div v-if="step.isCompleted" class="absolute top-2 right-2 text-emerald-400">
        <CheckCircle2 :size="12" />
      </div>
      <div v-else-if="step.showPulse" class="absolute top-2 right-2 text-teal-400 animate-pulse">
        <div class="w-2 h-2 rounded-full bg-teal-400" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { Map, ScrollText, BarChart3, ImageIcon, Mic, Radio, Clapperboard, Film, CheckCircle2, Undo2, Pencil } from 'lucide-vue-next'

const props = defineProps<{
  output: any
  canRenderMaster: boolean
  getStepClass: (isCompleted: boolean, isEnabled: boolean) => string
  getStepCost: (step: string) => number
  isEstimatedCost: (step: string) => boolean
  formatCost: (v: number) => string
}>()

defineEmits<{
  revertToStage: [stage: string]
}>()

function isGateApproved(o: any, stage: string): boolean {
  if (!o?.stageGates) return false
  const gate = o.stageGates.find((g: any) => g.stage === stage)
  return gate?.status === 'APPROVED'
}

const steps = computed(() => {
  const o = props.output
  const hasScenes = (o?.scenes?.length ?? 0) > 0
  return [
    {
      icon: markRaw(Map),
      label: 'Plano',
      isCompleted: isGateApproved(o, 'STORY_OUTLINE'),
      isEnabled: true,
      revertStage: 'STORY_OUTLINE',
      costKey: 'outline',
      estimatedCostKey: 'outline',
    },
    {
      icon: markRaw(Pencil),
      label: 'Prosa',
      isCompleted: isGateApproved(o, 'WRITER'),
      isEnabled: isGateApproved(o, 'STORY_OUTLINE'),
      costKey: 'writer',
    },
    {
      icon: markRaw(ScrollText),
      label: 'Roteiro',
      isCompleted: isGateApproved(o, 'SCRIPT'),
      isEnabled: isGateApproved(o, 'WRITER') || hasScenes,
      revertStage: 'SCRIPT',
      costKey: 'script',
    },
    {
      icon: markRaw(BarChart3),
      label: 'Retenção',
      isCompleted: isGateApproved(o, 'RETENTION_QA'),
      isEnabled: isGateApproved(o, 'SCRIPT'),
      revertStage: 'RETENTION_QA',
      costKey: 'retention-qa',
      showPulse: isGateApproved(o, 'SCRIPT') && !isGateApproved(o, 'RETENTION_QA'),
    },
    {
      icon: markRaw(ImageIcon),
      label: 'Visual',
      isCompleted: isGateApproved(o, 'IMAGES'),
      isEnabled: isGateApproved(o, 'SCRIPT'),
      revertStage: 'IMAGES',
      costKey: 'image',
    },
    {
      icon: markRaw(Mic),
      label: 'Narração',
      isCompleted: isGateApproved(o, 'AUDIO'),
      isEnabled: isGateApproved(o, 'IMAGES'),
      revertStage: 'AUDIO',
      costKey: 'narration',
    },
    {
      icon: markRaw(Radio),
      label: 'Música',
      isCompleted: isGateApproved(o, 'BGM'),
      isEnabled: isGateApproved(o, 'AUDIO'),
      revertStage: 'BGM',
      costKey: 'bgm',
    },
    {
      icon: markRaw(Clapperboard),
      label: 'Motion',
      isCompleted: isGateApproved(o, 'MOTION'),
      isEnabled: isGateApproved(o, 'BGM'),
      revertStage: 'MOTION',
      costKey: 'motion',
    },
    {
      icon: markRaw(Film),
      label: 'Render',
      isCompleted: o?.hasVideo ?? false,
      isEnabled: props.canRenderMaster || (o?.hasVideo ?? false),
    },
    {
      icon: markRaw(CheckCircle2),
      label: 'Final',
      isCompleted: o?.status === 'COMPLETED',
      isEnabled: o?.hasVideo ?? false,
    },
  ]
})
</script>

<style scoped>
.pipeline-step {
  @apply h-full p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden bg-black/20 border border-white/5 text-zinc-600;
}

.pipeline-step.active {
  @apply bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)];
}

.pipeline-step.completed {
  @apply bg-emerald-500/5 border-emerald-500/20 text-emerald-400;
}

.pipeline-step.completed:hover {
  @apply bg-amber-500/10 border-amber-500/30 text-amber-400;
}

.pipeline-step.pending {
  @apply opacity-50;
}

/* Ícone swap: mostra step-icon normalmente, troca por undo no hover */
.step-icon {
  display: block;
  transition: opacity 0.2s;
}
.step-undo-icon {
  display: none;
  transition: opacity 0.2s;
}
.pipeline-step.completed:hover .step-icon {
  display: none;
}
.pipeline-step.completed:hover .step-undo-icon {
  display: block;
}
</style>
