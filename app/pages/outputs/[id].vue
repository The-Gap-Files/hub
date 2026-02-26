<template>
  <div class="min-h-screen bg-[#0A0A0A] font-sans selection:bg-primary/30 text-white relative overflow-hidden">
    <!-- Background FX -->
    <div class="fixed inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-20 animate-pulse-slow"></div>
      <div class="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] opacity-20"></div>
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 container mx-auto px-6 py-12 max-w-7xl">
      <!-- Breadcrumb / Back -->
      <NuxtLink 
        v-if="output?.dossierId"
        :to="`/dossiers/${output.dossierId}`" 
        class="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 mono-label"
      >
        <ArrowLeft :size="14" />
        VOLTAR AO DOSSIÊ
      </NuxtLink>

      <div v-if="loading" class="flex flex-col items-center justify-center min-h-[50vh]">
        <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p class="mt-4 mono-label animate-pulse">Carregando Produção...</p>
      </div>

      <template v-else-if="output">
        <!-- Header -->
        <OutputHeader
          :output="output"
          :total-cost="costs?.total || 0"
          :correction-mode="correctionMode"
          :entering-corrections="enteringCorrections"
          :rendering="rendering"
          :reverting="reverting"
          :approving="approving"
          :format-cost="formatCost"
          :get-status-class="getStatusClass"
          @download-master="downloadMaster"
          @enter-correction-mode="enterCorrectionMode"
          @render-again="renderAgain"
          @reset-output="revertToStage('STORY_OUTLINE')"
        />


        <!-- Context Bar -->
        <OutputContextBar
          :summary="(output.script?.summary as string) || (output.dossier?.theme as string) || null"
          :duration="(output.script?.estimatedDuration as number) || output.duration || 0"
          :word-count="(output.script?.wordCount as number) ?? null"
          :scene-count="output.scenes?.length ?? 0"
          :classification="output.classification?.label || null"
          :script-style-name="output.scriptStyle?.name || null"
          :visual-style-name="output.visualStyle?.name || null"
          @export-json="exportScenesJson"
          @edit-config="openOutputConfigModal"
        />

        <!-- Final Video Player -->
        <div v-if="output.status === 'COMPLETED' || !!output.renderProduct" class="mb-12">
            <div class="glass-card overflow-hidden rounded-3xl border-primary/20 shadow-2xl shadow-primary/5">
                <video 
                    controls 
                    class="w-full aspect-video bg-black"
                    :class="output.aspectRatio === '9:16' ? 'max-h-[70vh] object-contain' : ''"
                    :src="`/api/outputs/${outputId}/video`"
                ></video>
                <div class="p-4 bg-white/5 flex items-center justify-between text-xs mono-label text-zinc-500">
                    <span class="flex items-center gap-2">
                        <Film :size="12" /> MASTER RENDERIZADO (POSTGRESQL STORAGE)
                    </span>
                    <span>{{ output.renderProduct?.mimeType }} • {{ ((output.renderProduct?.fileSize ?? 0) / 1024 / 1024).toFixed(2) }} MB</span>
                </div>
            </div>
        </div>

        <!-- Opções extras (após vídeo completo) -->
        <OutputExtras
          :output="output"
          :output-id="outputId"
          :correction-mode="correctionMode"
          :thumbnail-hook-text="thumbnailHookText"
          :generating-thumbnails="generatingThumbnails"
          :removing-thumbnail="removingThumbnail"
          :thumbnail-version="thumbnailVersion"
          :generating-social-kit="generatingSocialKit"
          :active-social-tab="activeSocialTab"
          :social-kit-tabs="socialKitTabs"
          :active-social-content="activeSocialContent"
          :seo-tags-normalized="seoTagsNormalized"
          :seo-tags-for-youtube-copy="seoTagsForYoutubeCopy"
          :format-cost="formatCost"
          :get-extra-cost="getExtraCost"
          @update:thumbnail-hook-text="thumbnailHookText = $event"
          @update:active-social-tab="activeSocialTab = $event"
          @generate-thumbnails="generateThumbnails"
          @open-thumbnail-preview="openThumbnailPreview"
          @show-thumbnail-lightbox="showSelectedThumbnail = true"
          @remove-thumbnail="removeThumbnail"
          @generate-social-kit="generateSocialKit"
          @copy-social-field="copySocialField"
        />

        <!-- Thumbnail Preview Modal -->
        <OutputModalsThumbnailPreviewModal
          v-if="selectedThumbnailIdx !== null && output?.thumbnailProduct?.candidates?.[selectedThumbnailIdx]"
          :candidate="(output.thumbnailProduct.candidates[selectedThumbnailIdx] as { base64: string; hookText?: string } | null) ?? null"
          :selecting="selectingThumbnail"
          @close="selectedThumbnailIdx = null"
          @select="selectThumbnail(selectedThumbnailIdx!)"
        />

        <!-- Lightbox: Thumbnail selecionada -->
        <OutputModalsThumbnailLightboxModal
          v-if="showSelectedThumbnail && (output?.thumbnailProduct?.selectedAt || output?.thumbnailProduct?.selectedStoragePath)"
          :thumbnail-url="`/api/outputs/${outputId}/thumbnail?t=${thumbnailVersion}`"
          :removing="removingThumbnail"
          :generating="generatingThumbnails"
          @close="showSelectedThumbnail = false"
          @remove="removeThumbnail(); showSelectedThumbnail = false"
          @regenerate="generateThumbnails(); showSelectedThumbnail = false"
        />

        <!-- CORRECTION MODE -->
        <OutputCorrectionPanel
          :output="output"
          :correction-mode="correctionMode"
          :rendering="rendering"
          :corrected-scenes="correctedScenes"
          :motion-regenerated-scenes="motionRegeneratedScenes"
          :regenerating-scene-id="regeneratingSceneId"
          :regenerating-motion-scene-ids="regeneratingMotionSceneIds"
          :image-versions="imageVersions"
          :motion-versions="motionVersions"
          :pending-motion-scenes="pendingMotionScenes"
          :editing-prompt-scene-id="editingPromptSceneId"
          :editing-prompt-text="editingPromptText"
          :sanitizing-scene-id="sanitizingSceneId"
          :sanitizing-level="sanitizingLevel"
          :restricted-prompt-edits="restrictedPromptEdits"
          :last-sanitize-level="lastSanitizeLevel"
          :get-selected-video="getSelectedVideo"
          @exit-correction-mode="exitCorrectionMode"
          @finish-corrections-and-render="finishCorrectionsAndRender"
          @regenerate-scene-images="regenerateSceneImages"
          @regenerate-motion-correction="regenerateMotionCorrection"
          @open-image="openImage"
          @start-edit-prompt="startEditPrompt"
          @cancel-edit-prompt="cancelEditPrompt"
          @save-edit-prompt="saveEditPrompt"
          @update:editing-prompt-text="editingPromptText = $event"
          @sanitize-restricted-prompt="sanitizeRestrictedPrompt"
          @retry-restricted-image="retryRestrictedImage"
          @update-restricted-prompt="(sceneId: string, value: string) => restrictedPromptEdits[sceneId] = value"
        />

        <!-- Pipeline Progress (9 Stages) -->
        <OutputPipelineStepsBar
          :output="output"
          :can-render-master="canRenderMaster"
          :get-step-class="getStepClass"
          :get-step-cost="getStepCost"
          :is-estimated-cost="isEstimatedCost"
          :format-cost="formatCost"
          @revert-to-stage="revertToStage"
        />

        <!-- Script Feedback Modal -->
        <OutputModalsScriptFeedbackModal
          v-if="showScriptFeedbackModal"
          v-model="scriptFeedback"
          :regenerating="regeneratingScript"
          @close="showScriptFeedbackModal = false"
          @confirm="confirmRegenerateScript"
        />

        <!-- Plano gerado, aguardando aprovação: botão no início da etapa (acima do plano narrativo). Só na etapa Plano (sem roteiro). -->
        <div v-if="isPlanoStage && !output.script && output.status !== 'FAILED' && output.storyOutlineData?.outlineData && pipelineStage === 'PLANO'" class="mb-12 p-4 rounded-3xl border border-amber-500/30 bg-amber-500/5">
            <div class="flex justify-center mb-4">
              <button 
                @click="approveStoryOutline"
                :disabled="approving"
                class="px-8 py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                <span v-if="approving" class="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"></span>
                <CheckCircle2 v-else :size="20" />
                {{ approving ? 'Processando...' : 'APROVAR PLANO' }}
              </button>
            </div>
            <p class="text-amber-200 text-sm text-center">Plano narrativo gerado. Aprove-o para liberar a geração do roteiro.</p>
        </div>

        <!-- STORY OUTLINE: Plano Narrativo (Story Architect) -->
        <OutputStoryOutlineCard
          :output="output"
          :is-plano-stage="isPlanoStage"
          :expanded="outlineExpanded"
          :approving="approving"
          :regenerating-outline="regeneratingOutline"
          :selected-hook-level="selectedHookLevel"
          :custom-hook-text="customHookText"
          :custom-scenes="customScenes"
          :max-custom-scenes="maxCustomScenes"
          :uploading-scene-image="uploadingSceneImage"
          @toggle-expanded="outlineExpanded = !outlineExpanded"
          @approve-story-outline="approveStoryOutline"
          @open-outline-feedback="showOutlineFeedbackModal = true"
          @update:selected-hook-level="selectedHookLevel = $event"
          @update:custom-hook-text="customHookText = $event"
          @add-custom-scene="addCustomScene"
          @remove-custom-scene="removeCustomScene"
          @update-custom-scene-narration="(idx: number, val: string) => { if (customScenes[idx]) customScenes[idx].narration = val }"
          @update-custom-scene-image-prompt="(idx: number, val: string) => { if (customScenes[idx]) customScenes[idx].imagePrompt = val }"
          @upload-scene-reference-image="uploadSceneReferenceImage"
          @remove-scene-image="removeSceneImage"
        />

        <!-- Outline Feedback Modal -->
        <OutputModalsOutlineFeedbackModal
          v-if="showOutlineFeedbackModal"
          v-model="outlineFeedback"
          :regenerating="regeneratingOutline"
          :needs-speech-config="needsSpeechConfig"
          @close="showOutlineFeedbackModal = false"
          @confirm="confirmRegenerateOutline"
        />

        <!-- WRITER PROSE: Prosa narrativa do Escritor -->
        <OutputWriterProseCard :prose="output.script?.writerProse ?? null" :auto-expand="isWriterStage" />

        <!-- Pipeline Approval Stages -->
        <OutputApprovalStages
          :output="output"
          :is-plano-stage="isPlanoStage"
          :is-writer-stage="isWriterStage"
          :is-roteiro-stage="isRoteiroStage"
          :needs-speech-config="needsSpeechConfig"
          :generating-outline="generatingOutline"
          :generating-stage="generatingStage"
          :approving="approving"
          :can-render-master="canRenderMaster"
          :is-rendering-active="isRenderingActive"
          :rendering="rendering"
          :render-stale="renderStale"
          :all-scenes-have-images="allScenesHaveImages"
          :all-scenes-have-audio="allScenesHaveAudio"
          :all-scenes-have-videos="allScenesHaveVideos"
          :hasSFXScenes="hasSFXScenes"
          :allScenesHaveSFX="allScenesHaveSFX"
          :sfx-scene-count="sfxSceneCount"
          :generatingSFX="generatingSFX"
          :generating-music-events="generatingMusicEvents"
          :has-music-events="hasMusicEvents"
          :music-event-count="musicEventCount"
          :bgm-tracks="bgmTracks"
          :changing-voice="changingVoice"
          :regenerating-script="regeneratingScript"
          :monetization-plan="monetizationPlan"
          :loading-monetization="loadingMonetization"
          :is-monetization-selection-locked="isMonetizationSelectionLocked"
          :selected-monetization-item="selectedMonetizationItem"
          :outline-suggestions="outlineSuggestions"
          :format-cost="formatCost"
          :get-step-cost="getStepCost"
          :is-estimated-cost="isEstimatedCost"
          :get-bgm-track-meta="getBgmTrackMeta"
          :get-bgm-track-prompt="getBgmTrackPrompt"
          :get-music-event-type="getMusicEventType"
          :narrative-role-badge="narrativeRoleBadge"
          @open-change-voice-modal="openChangeVoiceModal"
          @select-monetization-full-video="selectMonetizationFullVideo"
          @select-monetization-teaser="selectMonetizationTeaser"
          @update:outline-suggestions="outlineSuggestions = $event"
          @generate-outline-then-reload="generateOutlineThenReload"
          @start-generate-writer="startGenerateWriter()"
          @regenerate-writer="(feedback: string) => startGenerateWriter(feedback)"
          @approve-writer="approveWriter"
          @start-generate-script="startGenerateScript"
          @approve-script="approveScript"
          @show-script-feedback-modal="showScriptFeedbackModal = true"
          @start-generate-retention-q-a="startGenerateRetentionQA"
          @approve-retention-q-a="approveRetentionQA"
          @fix-script-with-retention-q-a="fixScriptWithRetentionQA"
          @generate-images="generateImages"
          @approve-images="approveImages"
          @generate-audio="generateAudio"
          @approve-audio="approveAudio"
          @generate-sfx="generateSFX"
          @generate-bgm="generateBgm"
          @approve-bgm="approveBgm"
          @start-generate-music-events="startGenerateMusicEvents"
          @generate-motion="generateMotion"
          @approve-motion="approveMotion"
          @render-master="renderMaster"
          @cancel-stale-render="cancelStaleRender"
          @approve-render="approveRender"
          @render-again="renderAgain"
        />


        <!-- Script Viewer -->
        <OutputScriptSceneGrid
          :output="output"
          :pipeline-stage="pipelineStage"
          :editing-prompt-scene-id="editingPromptSceneId"
          :editing-prompt-text="editingPromptText"
          :regenerating-scene-id="regeneratingSceneId"
          :regenerating-motion-scene-ids="regeneratingMotionSceneIds"
          :expanded-prompt-scenes="expandedPromptScenes"
          :sanitizing-scene-id="sanitizingSceneId"
          :sanitizing-level="sanitizingLevel"
          :motion-versions="motionVersions"
          :tts-text-for-scene="ttsTextForScene"
          :get-selected-video="getSelectedVideo"
          @regenerate-image="regenerateImage"
          @start-edit-prompt="startEditPrompt"
          @cancel-edit-prompt="cancelEditPrompt"
          @save-edit-prompt="saveEditPrompt"
          @save-and-regenerate-image="saveAndRegenerateImage"
          @sanitize-and-fill-edit="sanitizeAndFillEdit"
          @update:editing-prompt-text="editingPromptText = $event"
          @open-image="openImage"
          @regenerate-motion-correction="regenerateMotionCorrection"
          @toggle-expanded-prompt="(id: string) => expandedPromptScenes.has(id) ? expandedPromptScenes.delete(id) : expandedPromptScenes.add(id)"
        />

      </template>

      <!-- Erro -->
      <div v-else class="text-center py-32">
        <h2 class="text-2xl font-bold text-red-500 mb-2">Erro</h2>
        <p class="text-zinc-500">Não foi possível carregar os dados do output.</p>
        <NuxtLink to="/" class="btn-secondary mt-8 inline-flex">Voltar Home</NuxtLink>
      </div>

      <div v-if="selectedImage" class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-8 animate-in fade-in duration-200" @click="selectedImage = null">
        <button class="absolute top-8 right-8 text-white/50 hover:text-white transition-colors z-[100]" @click.stop="selectedImage = null">
          <X :size="32" />
        </button>
        <img 
          :src="`/api/scene-images/${selectedImage}`" 
          class="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
          @click.stop
        />
      </div>

    </div>
  </div>

  <!-- Pricing Not Configured Modal -->
  <OutputModalsPricingErrorModal
    v-if="pricingError"
    :error="pricingError"
    @close="pricingError = null"
  />

  <!-- Output Config Modal -->
  <OutputModalsOutputConfigModal
    v-if="showOutputConfigModal"
    v-model:script-style-id="cfgScriptStyleId"
    v-model:visual-style-id="cfgVisualStyleId"
    v-model:editorial-objective-id="cfgEditorialObjectiveId"
    v-model:objective="cfgObjective"
    v-model:language="cfgLanguage"
    v-model:narration-language="cfgNarrationLanguage"
    v-model:seed-choice="cfgSeedChoice"
    v-model:must-include="cfgMustInclude"
    v-model:must-exclude="cfgMustExclude"
    :error="outputConfigError"
    :saving="savingOutputConfig"
    :seed-locked="isSeedLocked"
    :current-seed-value="output?.seedValue ?? null"
    :script-styles-options="scriptStylesOptions"
    :visual-styles-options="visualStylesOptions"
    :editorial-objectives-options="editorialObjectivesOptions"
    :seed-options="seedOptions"
    @close="showOutputConfigModal = false"
    @save="saveOutputConfig"
    @apply-preset="applyObjectivePreset"
  />

  <!-- Change Voice Modal -->
  <OutputModalsChangeVoiceModal
    v-if="showChangeVoiceModal"
    v-model="newVoiceId"
    :current-voice-id="output?.voiceId ?? null"
    @close="showChangeVoiceModal = false"
    @confirm="confirmChangeVoice"
  />

  <!-- Render Options Modal -->
  <OutputModalsRenderOptionsModal
    v-if="showRenderOptionsModal"
    v-model:include-logo="renderIncludeLogo"
    v-model:include-captions="renderIncludeCaptions"
    v-model:adjust-volume="renderAdjustVolume"
    v-model:include-stingers="renderIncludeStingers"
    v-model:caption-style-id="renderCaptionStyleId"
    v-model:bgm-volume-global="renderBgmVolumeGlobal"
    :rendering="rendering"
    :show-stingers="hasMusicEvents"
    :has-bgm-data="hasBgmData"
    :caption-styles="captionStyles"
    :original-volume="output?.script?.backgroundMusicVolume || -18"
    :single-track-mode="!!output?.script?.backgroundMusicPrompt && !output?.script?.backgroundMusicTracks?.length"
    :music-tracks="output?.script?.backgroundMusicTracks || null"
    :get-track-volume="getTrackVolumeOverride"
    @close="showRenderOptionsModal = false"
    @confirm="confirmRenderWithOptions"
    @set-track-volume="setTrackVolumeOverride"
  />
</template>

<script setup lang="ts">
import { ArrowLeft, Film, CheckCircle2, X } from 'lucide-vue-next'
import { useApiErrorHandler } from '~/utils/output/handleApiError'
import { ttsTextForScene } from '~/utils/output/ttsTextForScene'
import { useOutputData } from '~/composables/output/useOutputData'
import { useOutputPolling } from '~/composables/output/useOutputPolling'
import { useOutputCosts } from '~/composables/output/useOutputCosts'
import { useThumbnails } from '~/composables/output/useThumbnails'
import { useSocialKit } from '~/composables/output/useSocialKit'
import { useCorrectionMode } from '~/composables/output/useCorrectionMode'
import { useOutputPipeline } from '~/composables/output/useOutputPipeline'
import { useRenderOptions } from '~/composables/output/useRenderOptions'
import { useOutputConfig } from '~/composables/output/useOutputConfig'
import { useCustomScenes } from '~/composables/output/useCustomScenes'
import { useMonetizationPlan } from '~/composables/output/useMonetizationPlan'
import { useVoiceChange } from '~/composables/output/useVoiceChange'
import { useStoryOutline } from '~/composables/output/useStoryOutline'

const route = useRoute()
const outputId = route.params.id as string

const { output, loading, loadOutput, onAfterLoad } = useOutputData(outputId)

// Shared reactive state — used by multiple composables (pipeline, correction mode, polling)
const rendering = ref(false)
const generatingStage = ref<string | null>(null)
const generationStartedAt = ref<number>(0)
const regeneratingSceneId = ref<string | null>(null)

// Output Config composable (styles, objectives, seeds, language)
const {
  showOutputConfigModal, savingOutputConfig, outputConfigError,
  scriptStylesOptions, visualStylesOptions, editorialObjectivesOptions, seedOptions,
  cfgScriptStyleId, cfgVisualStyleId, cfgEditorialObjectiveId, cfgObjective,
  cfgLanguage, cfgNarrationLanguage, cfgSeedChoice, cfgMustInclude, cfgMustExclude,
  isSeedLocked,
  applyObjectivePreset, openOutputConfigModal, saveOutputConfig,
} = useOutputConfig(outputId, output, loadOutput)

// Pricing Error + centralized API error handler
const { pricingError, handleApiError } = useApiErrorHandler()

// Cost Tracking — must be declared before composables that depend on loadCosts
const { costs, loadCosts, formatCost, getStepCost, isEstimatedCost, getExtraCost } = useOutputCosts(outputId)

// Thumbnails composable (depends on handleApiError, loadCosts)
const {
  generatingThumbnails, selectingThumbnail, removingThumbnail,
  selectedThumbnailIdx, showSelectedThumbnail, thumbnailHookText, thumbnailVersion,
  generateThumbnails, selectThumbnail, removeThumbnail, openThumbnailPreview,
} = useThumbnails(outputId, loadOutput, loadCosts, handleApiError)

// Social Kit composable (depends on handleApiError, loadCosts)
const {
  generatingSocialKit, activeSocialTab, socialKitTabs,
  activeSocialContent, seoTagsNormalized, seoTagsForYoutubeCopy,
  generateSocialKit, copySocialField, exportScenesJson,
} = useSocialKit(outputId, output, loadOutput, loadCosts, handleApiError)

// Polling (depends on shared refs: rendering, generatingStage)
const { renderStale, startPolling, stopPolling, startStaleDetection, stopStaleDetection, cancelStaleRender } =
  useOutputPolling(outputId, output, loadOutput, loadCosts, rendering, generatingStage)

// Correction Mode composable (depends on rendering, openRenderOptionsModal, regeneratingSceneId)
// Uses late-binding arrow for openRenderOptionsModal since it's defined later via function declaration
const {
  correctionMode, enteringCorrections, correctedScenes, motionRegeneratedScenes,
  imageVersions, motionVersions, pendingMotionScenes,
  editingPromptSceneId, editingPromptText,
  regeneratingSceneId: _regeneratingSceneId, expandedPromptScenes,
  sanitizingSceneId, sanitizingLevel, restrictedPromptEdits, lastSanitizeLevel,
  regeneratingMotionSceneIds,
  enterCorrectionMode, exitCorrectionMode, finishCorrectionsAndRender,
  regenerateSceneImages, regenerateMotionCorrection,
  startEditPrompt, cancelEditPrompt, saveEditPrompt,
  sanitizeAndFillEdit, saveAndRegenerateImage,
  sanitizeRestrictedPrompt, retryRestrictedImage,
} = useCorrectionMode(
  outputId, output, loadOutput, loadCosts, handleApiError, rendering,
  (action, opts) => openRenderOptionsModal(action, opts),
  regeneratingSceneId,
)

// Pipeline orchestration (depends on startPolling, shared state)
const {
  pipelineStage, isPlanoStage, isWriterStage, isRoteiroStage, needsSpeechConfig,
  canRenderMaster, isRenderingActive,
  allScenesHaveImages, allScenesHaveAudio, allScenesHaveVideos,
  generatingOutline, approving,
  startGenerateWriter, approveWriter,
  startGenerateScript, generateImages, generateAudio, generateBgm, generateMotion,
  approveScript, approveImages, approveAudio, approveBgm, approveMotion, approveRender,
  startGenerateRetentionQA, approveRetentionQA, fixScriptWithRetentionQA,
  renderMaster, renderAgain, doStartRender, downloadMaster,
  bgmTracks, getBgmTrackMeta, getBgmTrackPrompt,
  generatingSFX, hasSFXScenes, sfxSceneCount, allScenesHaveSFX, generateSFX,
  generatingMusicEvents, hasMusicEvents, musicEventCount, getMusicEventType, startGenerateMusicEvents,
  reverting, revertToStage,
  showScriptFeedbackModal, scriptFeedback, regeneratingScript, confirmRegenerateScript,
  regenerateImage,
  getStepClass, getStatusClass,
} = useOutputPipeline(
  outputId, output, loadOutput, loadCosts, handleApiError,
  startPolling,
  (action, opts) => openRenderOptionsModal(action, opts),
  regeneratingSceneId, rendering, generatingStage, generationStartedAt,
)

// Render Options modal (depends on doStartRender from pipeline, hasMusicEvents from pipeline)
const {
  showRenderOptionsModal,
  renderIncludeLogo, renderIncludeCaptions, renderIncludeStingers,
  captionStyles, renderCaptionStyleId,
  renderAdjustVolume, renderBgmVolumeGlobal,
  hasBgmData, getTrackVolumeOverride, setTrackVolumeOverride,
  openRenderOptionsModal, confirmRenderWithOptions,
} = useRenderOptions(outputId, output, rendering, hasMusicEvents, doStartRender)

// Custom Scenes composable
const {
  customScenes, uploadingSceneImage, maxCustomScenes,
  addCustomScene, removeCustomScene, uploadSceneReferenceImage, removeSceneImage,
} = useCustomScenes(outputId, output)

// Monetization Plan composable
const {
  monetizationPlan, loadingMonetization, isMonetizationSelectionLocked,
  selectedMonetizationItem, hydrateSelectedMonetizationFromOutput, loadMonetizationPlan,
  selectMonetizationTeaser, selectMonetizationFullVideo, narrativeRoleBadge,
} = useMonetizationPlan(output)

// Voice Change composable (depends on shared refs + startPolling)
const {
  showChangeVoiceModal, newVoiceId, changingVoice,
  openChangeVoiceModal, confirmChangeVoice,
} = useVoiceChange(outputId, output, generatingStage, generationStartedAt, startPolling)

// Story Outline composable (depends on pipeline refs, custom scenes, monetization, voice)
const {
  outlineExpanded, showOutlineFeedbackModal, outlineFeedback,
  outlineSuggestions, regeneratingOutline, selectedHookLevel, customHookText,
  confirmRegenerateOutline, generateOutlineThenReload, approveStoryOutline,
} = useStoryOutline(
  outputId, output, loadOutput,
  needsSpeechConfig, generatingOutline, approving,
  customScenes, selectedMonetizationItem, openChangeVoiceModal,
)

// Side-effects on data refresh:
onAfterLoad((data) => {
  hydrateSelectedMonetizationFromOutput()

  // Auto-clear generatingStage when generation finishes
  if (generatingStage.value) {
    const d = data as any
    const outputUpdated = new Date(d.updatedAt).getTime() > generationStartedAt.value
    const shouldClear =
      d.status === 'FAILED' ||
      (generatingStage.value === 'WRITER' && d.script?.writerProse && outputUpdated) ||
      (generatingStage.value === 'SCRIPT' && d.script && outputUpdated) ||
      (generatingStage.value === 'RETENTION_QA' && d.retentionQAData && outputUpdated) ||
      (generatingStage.value === 'SCRIPT_FIX' && !d.retentionQAData && d.script && outputUpdated) ||
      (generatingStage.value === 'IMAGES' && d.scenes?.every((s: any) => s.images?.length > 0) && outputUpdated) ||
      (generatingStage.value === 'AUDIO' && d.scenes?.every((s: any) => s.audioTracks?.some((a: any) => a.type === 'scene_narration')) && outputUpdated) ||
      (generatingStage.value === 'BGM' && d.audioTracks?.some((a: any) => a.type === 'background_music') && outputUpdated) ||
      (generatingStage.value === 'MOTION' && d.scenes?.every((s: any) => s.videos?.length > 0) && outputUpdated)
    if (shouldClear) {
      generatingStage.value = null
      generationStartedAt.value = 0
    }
  }

  // Restore selected hook level from outline
  const outlineData = data.storyOutlineData?.outlineData as any
  if (outlineData?._selectedHookLevel) {
    selectedHookLevel.value = outlineData._selectedHookLevel
  }
  if (outlineData?._customHook) {
    customHookText.value = outlineData._customHook
  }
  // Restore custom scenes
  if (outlineData?._customScenes) {
    customScenes.value = (outlineData._customScenes as any[]).map((s: any) => ({
      narration: s.narration || '',
      referenceImageId: s.referenceImageId || null,
      referenceImagePreview: s.referenceImageId ? `/api/dossiers/images/${s.referenceImageId}` : null,
      imagePrompt: s.imagePrompt || '',
    }))
  }
})

onMounted(async () => {
  await loadOutput()
  loadCosts()
  loadMonetizationPlan()
  startPolling()
  startStaleDetection()
})
onUnmounted(() => {
  stopPolling()
  stopStaleDetection()
})

// Image/video viewer helpers
const selectedImage = ref<string | null>(null)
function openImage(id: string) {
  selectedImage.value = id
}
function getSelectedVideo(scene: any) {
  if (!scene.videos?.length) return null
  return scene.videos.find((v: any) => v.isSelected) || scene.videos[0]
}

</script>

<style scoped>
.glass-card {
  @apply bg-black/40 backdrop-blur-xl border border-white/5;
}
</style>
