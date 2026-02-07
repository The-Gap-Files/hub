<script setup lang="ts">
import {
  Palette, FileText, Captions, Eye, EyeOff,
  Sparkles, ChevronDown, ChevronUp, Hash, Layers,
  Film, Smartphone, Monitor, Instagram, Clock, Maximize,
  Shield
} from 'lucide-vue-next'

// ─── Interfaces ──────────────────────────────────────────────
interface VisualStyle {
  id: string; name: string; description: string
  baseStyle: string; lightingTags: string; atmosphereTags: string
  compositionTags: string; tags: string; order: number; isActive: boolean
}
interface ScriptStyle {
  id: string; name: string; description: string
  instructions: string; order: number; isActive: boolean
}
interface CaptionStyle {
  id: string; name: string; description: string
  platform: string; fontName: string; fontSize: number
  primaryColor: string; bold: boolean; maxCharsPerLine: number
  maxLines: number; recommendedFor: string[]
}
interface VideoFormat {
  id: string; name: string; description: string
  platform: string; aspectRatio: string; orientation: string
  defaultDuration: number; maxDuration: number
  recommendedCaptionStyle: string; isActive: boolean
}
interface IntelClassification {
  id: string; label: string; description: string
  iconKey: string; order: number; isActive: boolean
}

// ─── Data ────────────────────────────────────────────────────
const visualStyles = ref<VisualStyle[]>([])
const scriptStyles = ref<ScriptStyle[]>([])
const captionStyles = ref<CaptionStyle[]>([])
const videoFormats = ref<VideoFormat[]>([])
const classifications = ref<IntelClassification[]>([])
const loading = ref(true)

const expandedVisual = ref<string | null>(null)
const expandedScript = ref<string | null>(null)
const expandedCaption = ref<string | null>(null)
const expandedFormat = ref<string | null>(null)

// Section collapse state (all open by default)
const sectionOpen = ref({
  visual: true,
  script: true,
  caption: true,
  formats: true,
  classifications: true
})

function toggleSection(section: 'visual' | 'script' | 'caption' | 'formats' | 'classifications') {
  sectionOpen.value[section] = !sectionOpen.value[section]
}

// ─── Fetch ───────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [vs, ss, cs, vf, ic] = await Promise.all([
      $fetch<{ data: VisualStyle[] }>('/api/visual-styles'),
      $fetch<{ data: ScriptStyle[] }>('/api/script-styles'),
      $fetch<{ data: CaptionStyle[] }>('/api/caption-styles'),
      $fetch<{ data: VideoFormat[] }>('/api/video-formats'),
      $fetch<{ data: IntelClassification[] }>('/api/intelligence-classifications')
    ])
    visualStyles.value = vs.data || []
    scriptStyles.value = ss.data || []
    captionStyles.value = cs.data || []
    videoFormats.value = vf.data || []
    classifications.value = ic.data || []
  } catch (e) {
    console.error('Erro ao carregar constantes:', e)
  } finally {
    loading.value = false
  }
})

// ─── Helpers ─────────────────────────────────────────────────
function toggleVisual(id: string) {
  expandedVisual.value = expandedVisual.value === id ? null : id
}
function toggleScript(id: string) {
  expandedScript.value = expandedScript.value === id ? null : id
}
function toggleCaption(id: string) {
  expandedCaption.value = expandedCaption.value === id ? null : id
}
function toggleFormat(id: string) {
  expandedFormat.value = expandedFormat.value === id ? null : id
}

function truncateInstructions(text: string, max = 200): string {
  if (text.length <= max) return text
  return text.substring(0, max) + '…'
}

function splitTags(tags: string): string[] {
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`
}

function getFormatIcon(fmt: VideoFormat) {
  if (fmt.platform === 'Instagram') return Instagram
  if (fmt.orientation === 'VERTICAL') return Smartphone
  return Monitor
}
</script>

<template>
  <div class="terminal-central">
    <!-- Header -->
    <header class="tc-header">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <div class="tc-logo-icon">
            <Layers :size="22" />
          </div>
          <h1 class="tc-title">Terminal Central</h1>
        </div>
        <p class="tc-subtitle">Registro de constantes do sistema — estilos, formatos e configurações</p>
      </div>
      <div class="tc-stats">
        <div class="tc-stat">
          <span class="tc-stat-value">{{ visualStyles.length }}</span>
          <span class="tc-stat-label">Visual</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-value">{{ scriptStyles.length }}</span>
          <span class="tc-stat-label">Roteiro</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-value">{{ captionStyles.length }}</span>
          <span class="tc-stat-label">Legenda</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-value">{{ videoFormats.length }}</span>
          <span class="tc-stat-label">Formatos</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-value">{{ classifications.length }}</span>
          <span class="tc-stat-label">Classif.</span>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="tc-loading">
      <div class="tc-spinner" />
      <span class="mono-label">Carregando registros...</span>
    </div>

    <template v-else>
      <!-- ═══════════ VISUAL STYLES ═══════════ -->
      <section class="tc-section">
        <div class="tc-section-header cursor-pointer" @click="toggleSection('visual')">
          <div class="tc-section-icon visual-icon">
            <Palette :size="16" />
          </div>
          <div class="flex-1">
            <h2 class="tc-section-title">Estilos Visuais</h2>
            <p class="tc-section-desc">Paletas estéticas para geração de imagens e vídeos</p>
          </div>
          <span class="tc-badge">{{ visualStyles.length }} registros</span>
          <component :is="sectionOpen.visual ? ChevronUp : ChevronDown" :size="16" class="text-zinc-500 ml-2 transition-transform duration-200" />
        </div>

        <div v-show="sectionOpen.visual" class="tc-cards-grid tc-section-body">
          <div
            v-for="style in visualStyles"
            :key="style.id"
            class="tc-card visual-card cursor-pointer"
            :class="{ 'tc-card--expanded': expandedVisual === style.id }"
            @click="toggleVisual(style.id)"
          >
            <div class="tc-card-header">
              <div class="tc-card-identity">
                <span class="tc-card-id font-mono text-xs">{{ style.id }}</span>
                <h3 class="tc-card-name">{{ style.name }}</h3>
              </div>
              <div class="tc-card-toggle">
                <div class="tc-active-dot" :class="style.isActive ? 'active' : 'inactive'" />
                <component :is="expandedVisual === style.id ? ChevronUp : ChevronDown" :size="14" class="text-zinc-500" />
              </div>
            </div>

            <p class="tc-card-desc">{{ style.description }}</p>

            <!-- Expanded -->
            <Transition name="expand">
              <div v-if="expandedVisual === style.id" class="tc-card-details" @click.stop>
                <div class="tc-detail-group">
                  <span class="tc-detail-label">Base Style</span>
                  <p class="tc-detail-value font-mono text-xs">{{ style.baseStyle }}</p>
                </div>
                <div class="tc-detail-group">
                  <span class="tc-detail-label">Iluminação</span>
                  <p class="tc-detail-value text-xs">{{ style.lightingTags }}</p>
                </div>
                <div class="tc-detail-group">
                  <span class="tc-detail-label">Atmosfera</span>
                  <p class="tc-detail-value text-xs">{{ style.atmosphereTags }}</p>
                </div>
                <div class="tc-detail-group">
                  <span class="tc-detail-label">Composição</span>
                  <p class="tc-detail-value text-xs">{{ style.compositionTags }}</p>
                </div>
                <div class="tc-detail-group">
                  <span class="tc-detail-label">Tags</span>
                  <div class="tc-tags">
                    <span v-for="tag in splitTags(style.tags)" :key="tag" class="tc-tag">{{ tag }}</span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- ═══════════ SCRIPT STYLES ═══════════ -->
      <section class="tc-section">
        <div class="tc-section-header cursor-pointer" @click="toggleSection('script')">
          <div class="tc-section-icon script-icon">
            <FileText :size="16" />
          </div>
          <div class="flex-1">
            <h2 class="tc-section-title">Estilos de Roteiro</h2>
            <p class="tc-section-desc">Frameworks narrativos completos (Bíblias de Estilo)</p>
          </div>
          <span class="tc-badge">{{ scriptStyles.length }} registros</span>
          <component :is="sectionOpen.script ? ChevronUp : ChevronDown" :size="16" class="text-zinc-500 ml-2 transition-transform duration-200" />
        </div>

        <div v-show="sectionOpen.script" class="tc-cards-grid tc-section-body">
          <div
            v-for="style in scriptStyles"
            :key="style.id"
            class="tc-card script-card cursor-pointer"
            :class="{ 'tc-card--expanded': expandedScript === style.id }"
            @click="toggleScript(style.id)"
          >
            <div class="tc-card-header">
              <div class="tc-card-identity">
                <span class="tc-card-id font-mono text-xs">{{ style.id }}</span>
                <h3 class="tc-card-name">{{ style.name }}</h3>
              </div>
              <div class="tc-card-toggle">
                <div class="tc-active-dot" :class="style.isActive ? 'active' : 'inactive'" />
                <component :is="expandedScript === style.id ? ChevronUp : ChevronDown" :size="14" class="text-zinc-500" />
              </div>
            </div>

            <p class="tc-card-desc">{{ style.description }}</p>

            <!-- Expanded -->
            <Transition name="expand">
              <div v-if="expandedScript === style.id" class="tc-card-details" @click.stop>
                <div class="tc-detail-group">
                  <span class="tc-detail-label">Instruções (preview)</span>
                  <pre class="tc-instructions-preview">{{ truncateInstructions(style.instructions, 600) }}</pre>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- ═══════════ CAPTION STYLES ═══════════ -->
      <section class="tc-section">
        <div class="tc-section-header cursor-pointer" @click="toggleSection('caption')">
          <div class="tc-section-icon caption-icon">
            <Captions :size="16" />
          </div>
          <div class="flex-1">
            <h2 class="tc-section-title">Estilos de Legenda</h2>
            <p class="tc-section-desc">Configurações de subtitle por plataforma</p>
          </div>
          <span class="tc-badge">{{ captionStyles.length }} registros</span>
          <component :is="sectionOpen.caption ? ChevronUp : ChevronDown" :size="16" class="text-zinc-500 ml-2 transition-transform duration-200" />
        </div>

        <div v-show="sectionOpen.caption" class="tc-cards-grid tc-cards-grid--captions tc-section-body">
          <div
            v-for="style in captionStyles"
            :key="style.id"
            class="tc-card caption-card cursor-pointer"
            :class="{ 'tc-card--expanded': expandedCaption === style.id }"
            @click="toggleCaption(style.id)"
          >
            <div class="tc-card-header">
              <div class="tc-card-identity">
                <span class="tc-card-id font-mono text-xs">{{ style.id }}</span>
                <h3 class="tc-card-name">{{ style.name }}</h3>
              </div>
              <div class="tc-card-toggle">
                <span class="tc-platform-badge">{{ style.platform }}</span>
                <component :is="expandedCaption === style.id ? ChevronUp : ChevronDown" :size="14" class="text-zinc-500" />
              </div>
            </div>

            <p class="tc-card-desc">{{ style.description }}</p>

            <!-- Expanded -->
            <Transition name="expand">
              <div v-if="expandedCaption === style.id" class="tc-card-details" @click.stop>
                <div class="tc-caption-specs">
                  <div class="tc-spec">
                    <span class="tc-spec-label">Fonte</span>
                    <span class="tc-spec-value">{{ style.fontName }} {{ style.bold ? '(Bold)' : '' }}</span>
                  </div>
                  <div class="tc-spec">
                    <span class="tc-spec-label">Tamanho</span>
                    <span class="tc-spec-value">{{ style.fontSize }}px</span>
                  </div>
                  <div class="tc-spec">
                    <span class="tc-spec-label">Cor Primária</span>
                    <div class="flex items-center gap-2">
                      <div class="tc-color-swatch" :style="{ background: style.primaryColor }" />
                      <span class="tc-spec-value font-mono">{{ style.primaryColor }}</span>
                    </div>
                  </div>
                  <div class="tc-spec">
                    <span class="tc-spec-label">Max Chars/Linha</span>
                    <span class="tc-spec-value">{{ style.maxCharsPerLine }}</span>
                  </div>
                  <div class="tc-spec">
                    <span class="tc-spec-label">Max Linhas</span>
                    <span class="tc-spec-value">{{ style.maxLines }}</span>
                  </div>
                </div>
                <div v-if="style.recommendedFor?.length" class="tc-detail-group mt-3">
                  <span class="tc-detail-label">Recomendado para</span>
                  <div class="tc-tags">
                    <span v-for="rec in style.recommendedFor" :key="rec" class="tc-tag caption-tag">{{ rec }}</span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- ═══════════ VIDEO FORMATS ═══════════ -->
      <section class="tc-section">
        <div class="tc-section-header cursor-pointer" @click="toggleSection('formats')">
          <div class="tc-section-icon format-icon">
            <Film :size="16" />
          </div>
          <div class="flex-1">
            <h2 class="tc-section-title">Formatos de Vídeo</h2>
            <p class="tc-section-desc">Configurações de plataforma, aspect ratio e duração</p>
          </div>
          <span class="tc-badge">{{ videoFormats.length }} registros</span>
          <component :is="sectionOpen.formats ? ChevronUp : ChevronDown" :size="16" class="text-zinc-500 ml-2 transition-transform duration-200" />
        </div>

        <div v-show="sectionOpen.formats" class="tc-cards-grid tc-cards-grid--captions tc-section-body">
          <div
            v-for="fmt in videoFormats"
            :key="fmt.id"
            class="tc-card format-card cursor-pointer"
            :class="{ 'tc-card--expanded': expandedFormat === fmt.id }"
            @click="toggleFormat(fmt.id)"
          >
            <div class="tc-card-header">
              <div class="tc-card-identity">
                <span class="tc-card-id font-mono text-xs">{{ fmt.id }}</span>
                <h3 class="tc-card-name">{{ fmt.name }}</h3>
              </div>
              <div class="tc-card-toggle">
                <span class="tc-platform-badge format-platform">{{ fmt.platform }}</span>
                <component :is="expandedFormat === fmt.id ? ChevronUp : ChevronDown" :size="14" class="text-zinc-500" />
              </div>
            </div>

            <!-- Quick info row -->
            <div class="tc-format-quick">
              <div class="tc-format-chip">
                <Maximize :size="10" />
                <span>{{ fmt.aspectRatio }}</span>
              </div>
              <div class="tc-format-chip">
                <component :is="getFormatIcon(fmt)" :size="10" />
                <span>{{ fmt.orientation }}</span>
              </div>
              <div class="tc-format-chip">
                <Clock :size="10" />
                <span>{{ formatDuration(fmt.defaultDuration) }}</span>
              </div>
            </div>

            <p class="tc-card-desc">{{ fmt.description }}</p>

            <!-- Expanded -->
            <Transition name="expand">
              <div v-if="expandedFormat === fmt.id" class="tc-card-details" @click.stop>
                <div class="tc-caption-specs">
                  <div class="tc-spec">
                    <span class="tc-spec-label">Aspect Ratio</span>
                    <span class="tc-spec-value">{{ fmt.aspectRatio }}</span>
                  </div>
                  <div class="tc-spec">
                    <span class="tc-spec-label">Orientação</span>
                    <span class="tc-spec-value">{{ fmt.orientation }}</span>
                  </div>
                  <div class="tc-spec">
                    <span class="tc-spec-label">Duração Padrão</span>
                    <span class="tc-spec-value">{{ formatDuration(fmt.defaultDuration) }}</span>
                  </div>
                  <div class="tc-spec">
                    <span class="tc-spec-label">Duração Máx.</span>
                    <span class="tc-spec-value">{{ formatDuration(fmt.maxDuration) }}</span>
                  </div>
                  <div class="tc-spec">
                    <span class="tc-spec-label">Legenda Recomendada</span>
                    <span class="tc-spec-value font-mono">{{ fmt.recommendedCaptionStyle }}</span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- ═══════════ INTELLIGENCE CLASSIFICATIONS ═══════════ -->
      <section class="tc-section">
        <div class="tc-section-header cursor-pointer" @click="toggleSection('classifications')">
          <div class="tc-section-icon classification-icon">
            <Shield :size="16" />
          </div>
          <div class="flex-1">
            <h2 class="tc-section-title">Classificações de Inteligência</h2>
            <p class="tc-section-desc">Categorias temáticas para classificação de dossiês</p>
          </div>
          <span class="tc-badge">{{ classifications.length }} registros</span>
          <component :is="sectionOpen.classifications ? ChevronUp : ChevronDown" :size="16" class="text-zinc-500 ml-2 transition-transform duration-200" />
        </div>

        <div v-show="sectionOpen.classifications" class="tc-cards-grid tc-cards-grid--captions tc-section-body">
          <div
            v-for="cls in classifications"
            :key="cls.id"
            class="tc-card classification-card"
          >
            <div class="tc-card-header">
              <div class="tc-card-identity">
                <span class="tc-card-id font-mono text-xs">{{ cls.id }}</span>
                <h3 class="tc-card-name">{{ cls.label }}</h3>
              </div>
              <div class="tc-card-toggle">
                <span class="tc-classification-order">{{ String(cls.order).padStart(2, '0') }}</span>
              </div>
            </div>
            <p class="tc-card-desc">{{ cls.description }}</p>
            <div class="tc-format-quick">
              <div class="tc-classification-chip">
                <span>{{ cls.iconKey }}</span>
              </div>
              <div class="tc-classification-chip" :class="cls.isActive ? 'classification-active' : 'classification-inactive'">
                <span>{{ cls.isActive ? 'ATIVA' : 'INATIVA' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   TERMINAL CENTRAL — Style Registry Dashboard
   ═══════════════════════════════════════════════════════════════ */

.terminal-central {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

/* ─── Header ──────────────────────────────────────────────── */
.tc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
}

.tc-logo-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, hsl(217 91% 60% / 0.2), hsl(263 70% 50% / 0.2));
  color: hsl(217 91% 60%);
}

.tc-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 60%));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tc-subtitle {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  margin-top: 2px;
}

.tc-stats {
  display: flex;
  gap: 1.5rem;
}

.tc-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.tc-stat-value {
  font-family: 'Fira Code', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.tc-stat-label {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: hsl(var(--muted-foreground));
}

/* ─── Loading ─────────────────────────────────────────────── */
.tc-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
}

.tc-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid hsl(var(--border));
  border-top-color: hsl(217 91% 60%);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Section ─────────────────────────────────────────────── */
.tc-section {
  margin-bottom: 2.5rem;
}

.tc-section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  border-radius: 8px;
  transition: background 200ms ease;
}

.tc-section-header:hover {
  background: hsl(var(--muted) / 0.4);
}

.tc-section-body {
  animation: sectionSlideIn 250ms ease;
}

@keyframes sectionSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tc-section-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.visual-icon {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.script-icon {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.caption-icon {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.format-icon {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.format-card:hover {
  border-color: hsl(38 92% 50% / 0.3);
}

.format-card.tc-card--expanded {
  border-color: hsl(38 92% 50% / 0.4);
  box-shadow: 0 0 20px hsl(38 92% 50% / 0.06);
}

.tc-format-quick {
  display: flex;
  gap: 6px;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.tc-format-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 6px;
  background: hsl(38 92% 50% / 0.08);
  color: hsl(38 80% 65%);
  border: 1px solid hsl(38 92% 50% / 0.12);
}

.format-platform {
  background: hsl(38 92% 50% / 0.12);
  color: hsl(38 80% 65%);
}

.classification-icon {
  background: rgba(244, 63, 94, 0.15);
  color: #f43f5e;
}

.classification-card:hover {
  border-color: hsl(350 89% 60% / 0.3);
}

.tc-classification-order {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: hsl(350 70% 65%);
  background: hsl(350 89% 60% / 0.1);
  padding: 2px 8px;
  border-radius: 6px;
}

.tc-classification-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 6px;
  background: hsl(350 89% 60% / 0.08);
  color: hsl(350 70% 65%);
  border: 1px solid hsl(350 89% 60% / 0.12);
}

.classification-active {
  background: hsl(142 76% 36% / 0.1);
  color: hsl(142 60% 55%);
  border-color: hsl(142 76% 36% / 0.15);
}

.classification-inactive {
  background: hsl(0 0% 50% / 0.1);
  color: hsl(0 0% 50%);
  border-color: hsl(0 0% 50% / 0.15);
}

.tc-section-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.tc-section-desc {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.tc-badge {
  margin-left: auto;
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 6px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

/* ─── Cards Grid ──────────────────────────────────────────── */
.tc-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.75rem;
}

.tc-cards-grid--captions {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

/* ─── Card ────────────────────────────────────────────────── */
.tc-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  padding: 1rem 1.25rem;
  transition: all 200ms ease;
  position: relative;
  overflow: hidden;
}

.tc-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  opacity: 0;
  transition: opacity 200ms ease;
}

.visual-card::before { background: linear-gradient(90deg, #a855f7, #7c3aed); }
.script-card::before { background: linear-gradient(90deg, #3b82f6, #1d4ed8); }
.caption-card::before { background: linear-gradient(90deg, #10b981, #059669); }

.tc-card:hover {
  border-color: hsl(var(--border) / 0.8);
  background: hsl(240 10% 5.5%);
}

.tc-card:hover::before {
  opacity: 1;
}

.tc-card--expanded {
  border-color: hsl(var(--border) / 0.8);
  background: hsl(240 10% 5.5%);
}

.tc-card--expanded::before {
  opacity: 1;
}

/* ─── Card Header ─────────────────────────────────────────── */
.tc-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.tc-card-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tc-card-id {
  color: hsl(var(--muted-foreground));
  opacity: 0.6;
}

.tc-card-name {
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.tc-card-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tc-active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tc-active-dot.active {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.tc-active-dot.inactive {
  background: #6b7280;
}

.tc-card-desc {
  font-size: 0.85rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

/* ─── Card Details (Expanded) ─────────────────────────────── */
.tc-card-details {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border) / 0.5);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.tc-detail-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tc-detail-label {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
  opacity: 0.7;
}

.tc-detail-value {
  color: hsl(var(--foreground) / 0.85);
  line-height: 1.5;
}

/* ─── Tags ────────────────────────────────────────────────── */
.tc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tc-tag {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: hsl(263 70% 50% / 0.12);
  color: hsl(263 70% 70%);
  border: 1px solid hsl(263 70% 50% / 0.15);
}

.caption-tag {
  background: hsl(160 60% 45% / 0.12);
  color: hsl(160 60% 65%);
  border-color: hsl(160 60% 45% / 0.15);
}

/* ─── Script Instructions Preview ─────────────────────────── */
.tc-instructions-preview {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  color: hsl(var(--foreground) / 0.7);
  background: hsl(240 10% 3%);
  border: 1px solid hsl(var(--border) / 0.5);
  border-radius: 8px;
  padding: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

/* ─── Caption Specs ───────────────────────────────────────── */
.tc-caption-specs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.tc-spec {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tc-spec-label {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: hsl(var(--muted-foreground));
  opacity: 0.6;
}

.tc-spec-value {
  font-size: 0.8rem;
  color: hsl(var(--foreground) / 0.9);
}

.tc-color-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid hsl(var(--border));
}

.tc-platform-badge {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: hsl(217 91% 60% / 0.12);
  color: hsl(217 91% 70%);
  text-transform: uppercase;
}

/* ─── Expand Transition ───────────────────────────────────── */
.expand-enter-active,
.expand-leave-active {
  transition: all 250ms ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* ─── Responsive ──────────────────────────────────────────── */
@media (max-width: 768px) {
  .tc-header {
    flex-direction: column;
    gap: 1rem;
  }

  .tc-cards-grid {
    grid-template-columns: 1fr;
  }

  .tc-caption-specs {
    grid-template-columns: 1fr;
  }
}
</style>
