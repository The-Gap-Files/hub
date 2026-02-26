<template>
  <div v-if="prose" class="mb-6">
    <div class="glass-card rounded-3xl border-amber-500/20 overflow-hidden">
      <!-- Header -->
      <div
        class="px-8 py-5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-amber-500/10 flex items-center justify-between cursor-pointer"
        @click="expanded = !expanded"
      >
        <div class="flex items-center gap-3">
          <div class="p-2 bg-amber-500/20 rounded-xl">
            <BookOpen :size="20" class="text-amber-400" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-amber-200">Prosa do Escritor</h3>
            <p class="text-amber-300/40 text-xs">
              Writer Stage &bull; {{ wordCount.toLocaleString() }} palavras &bull; {{ blockCount }} blocos narrativos
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-amber-300/50 bg-amber-500/10 px-2.5 py-1 rounded-lg font-medium">
            {{ wordCount.toLocaleString() }} palavras
          </span>
          <component :is="expanded ? ChevronUp : ChevronDown" :size="20" class="text-amber-400/50" />
        </div>
      </div>

      <!-- Body (Collapsible) -->
      <div v-if="expanded" class="border-t border-amber-500/5">
        <div class="px-8 py-6 max-h-[700px] overflow-y-auto">
          <div class="prose-content text-sm text-zinc-300 leading-relaxed" v-html="renderedProse" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BookOpen, ChevronUp, ChevronDown } from 'lucide-vue-next'

const props = defineProps<{
  prose: string | null
  autoExpand?: boolean
}>()

const expanded = ref(props.autoExpand ?? false)

watch(() => props.autoExpand, (val) => {
  if (val) expanded.value = true
})

const wordCount = computed(() => {
  if (!props.prose) return 0
  return props.prose.split(/\s+/).filter(Boolean).length
})

const blockCount = computed(() => {
  if (!props.prose) return 0
  return (props.prose.match(/^##\s/gm) || []).length
})

const renderedProse = computed(() => {
  if (!props.prose) return ''
  return props.prose
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-zinc-200 mt-4 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-bold text-amber-400/90 mt-5 mb-2 border-b border-zinc-800 pb-1">$1</h3>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/^(?!<[hp])(.+)$/gm, '<p class="mb-2">$1</p>')
})
</script>

<style scoped>
.prose-content :deep(h3) {
  font-size: 0.875rem;
  font-weight: 700;
  color: rgb(251 191 36 / 0.9);
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid rgb(39 39 42 / 0.5);
  padding-bottom: 0.25rem;
}

.prose-content :deep(h4) {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(228 228 231);
  margin-top: 1rem;
  margin-bottom: 0.25rem;
}

.prose-content :deep(p) {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}
</style>
