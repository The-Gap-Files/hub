import { ref, computed, type Ref } from 'vue'
import type { OutputData, PipelineStage } from '~/types/output'
import { useNotification } from '~/utils/useNotification'
import { confirmAction } from '~/utils/output/confirmAction'

type OpenRenderModalFn = (
  action: 'master' | 'again',
  options?: { beforeRender?: () => Promise<void> },
) => Promise<void>

const STAGE_ORDER: Array<{ stage: PipelineStage; label: string }> = [
  { stage: 'STORY_OUTLINE', label: 'Plano' },
  { stage: 'WRITER', label: 'Escritor' },
  { stage: 'SCRIPT', label: 'Roteiro' },
  { stage: 'RETENTION_QA', label: 'Retenção' },
  { stage: 'IMAGES', label: 'Visual' },
  { stage: 'AUDIO', label: 'Narração' },
  { stage: 'BGM', label: 'Música' },
  { stage: 'MOTION', label: 'Motion' },
]

/** Helper: check if a stage is approved in the output's stageGates array */
function isStageApproved(output: OutputData | null, stage: PipelineStage): boolean {
  if (!output?.stageGates) return false
  const gate = output.stageGates.find(g => g.stage === stage)
  return gate?.status === 'APPROVED'
}

/** Helper: optimistically set a gate status in the local stageGates array */
function setLocalGateStatus(output: OutputData, stage: PipelineStage, status: string) {
  if (!output.stageGates) output.stageGates = []
  const existing = output.stageGates.find(g => g.stage === stage)
  if (existing) {
    existing.status = status as any
  } else {
    output.stageGates.push({ stage, status: status as any })
  }
}

/**
 * Core pipeline orchestration: stages, generation, approval, revert, render.
 *
 * Shared refs (rendering, generatingStage, generationStartedAt, regeneratingSceneId)
 * are created externally and passed in because multiple composables need them.
 */
export function useOutputPipeline(
  outputId: string,
  output: Ref<OutputData | null>,
  loadOutput: () => Promise<void>,
  loadCosts: () => Promise<void>,
  handleApiError: (error: unknown, fallback: string) => void,
  startPolling: () => void,
  openRenderOptionsModal: OpenRenderModalFn,
  regeneratingSceneId: Ref<string | null>,
  rendering: Ref<boolean>,
  generatingStage: Ref<string | null>,
  generationStartedAt: Ref<number>,
) {
  const { error: notifyError } = useNotification()

  // ---------------------------------------------------------------------------
  // Pipeline stage computation
  // ---------------------------------------------------------------------------
  const pipelineStage = computed(() => {
    if (!output.value || output.value.status === 'FAILED') return null

    const o = output.value
    const hasWriterProse = !!o.script?.writerProse
    const hasScenes = (o.scenes?.length || 0) > 0
    const hasOutline = !!o.storyOutlineData?.outlineData

    // Stage 1: Story Outline (Plano)
    if (!hasOutline || !isStageApproved(o, 'STORY_OUTLINE')) return 'PLANO'

    // Stage 2: Writer gate — só aplica enquanto não existem cenas.
    if (!hasScenes) {
      if (!hasWriterProse) return 'PLANO'
      if (!isStageApproved(o, 'WRITER')) return 'WRITER'
      return 'ROTEIRO'
    }

    // Stage 3+: Cenas já existem
    if (!isStageApproved(o, 'SCRIPT')) return 'ROTEIRO'
    if (!isStageApproved(o, 'RETENTION_QA')) return 'RETENTION_QA'
    if (!isStageApproved(o, 'IMAGES')) return 'VISUAL'
    if (!isStageApproved(o, 'AUDIO')) return 'NARRACAO'
    if (!isStageApproved(o, 'BGM')) return 'MUSICA'
    if (!isStageApproved(o, 'MOTION')) return 'MOTION'
    if (o.status !== 'COMPLETED' && o.status !== 'RENDERED') return 'RENDER'
    return 'FINAL'
  })

  const isPlanoStage = computed(() => pipelineStage.value === 'PLANO')
  const isWriterStage = computed(() => pipelineStage.value === 'WRITER')
  const isRoteiroStage = computed(() => pipelineStage.value === 'ROTEIRO')
  const speechReady = computed(() => !!output.value?.voiceId && !!output.value?.speechConfiguredAt)
  const needsSpeechConfig = computed(() => !speechReady.value)

  // ---------------------------------------------------------------------------
  // Generation state (rendering, generatingStage, generationStartedAt are external)
  // ---------------------------------------------------------------------------
  const generatingOutline = ref(false)
  const approving = ref(false)

  // ---------------------------------------------------------------------------
  // Scene readiness helpers
  // ---------------------------------------------------------------------------
  const allScenesHaveImages = computed(() => {
    if (!output.value?.scenes?.length) return false
    return output.value.scenes.every((s: any) => s.images?.length > 0)
  })

  const allScenesHaveAudio = computed(() => {
    if (!output.value?.scenes?.length) return false
    return output.value.scenes.every((s: any) =>
      s.audioTracks?.some((a: any) => a.type === 'scene_narration'),
    )
  })

  const allScenesHaveVideos = computed(() => {
    if (!output.value?.scenes?.length) return false
    return output.value.scenes.every((s: any) => s.videos?.length > 0)
  })

  const canRenderMaster = computed(() => {
    if (!output.value) return false
    const o = output.value
    return (
      isStageApproved(o, 'SCRIPT') &&
      isStageApproved(o, 'RETENTION_QA') &&
      isStageApproved(o, 'IMAGES') &&
      isStageApproved(o, 'BGM') &&
      isStageApproved(o, 'AUDIO') &&
      isStageApproved(o, 'MOTION')
    )
  })

  const isRenderingActive = computed(() => rendering.value)

  // ---------------------------------------------------------------------------
  // BGM helpers
  // ---------------------------------------------------------------------------
  const bgmTracks = computed(() => {
    if (!output.value?.audioTracks) return []
    return output.value.audioTracks
      .filter((a: any) => a.type === 'background_music')
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  })

  function getBgmTrackMeta(idx: number): any {
    const scriptTracks = output.value?.script?.backgroundMusicTracks
    if (!scriptTracks?.length) return null
    return scriptTracks[idx] || null
  }

  function getBgmTrackPrompt(idx: number): string | null {
    const meta = getBgmTrackMeta(idx)
    if (meta?.prompt) return meta.prompt
    if (bgmTracks.value.length === 1 && output.value?.script?.backgroundMusicPrompt) {
      return output.value.script.backgroundMusicPrompt
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // SFX (Sound Effects)
  // ---------------------------------------------------------------------------
  const generatingSFX = ref(false)

  const hasSFXScenes = computed((): boolean => {
    return output.value?.scenes?.some((s: any) => s.audioDescription?.trim()) ?? false
  })

  const sfxSceneCount = computed(() => {
    return output.value?.scenes?.filter((s: any) => s.audioDescription?.trim()).length || 0
  })

  const allScenesHaveSFX = computed(() => {
    if (!output.value?.scenes) return false
    const sfxScenes = output.value.scenes.filter((s: any) => s.audioDescription?.trim())
    if (sfxScenes.length === 0) return false
    return sfxScenes.every((s: any) => s.audioTracks?.some((a: any) => a.type === 'scene_sfx'))
  })

  async function generateSFX() {
    if (generatingSFX.value) return
    generatingSFX.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/generate-sfx`, { method: 'POST' })
      startPolling()
    } catch (e: unknown) {
      handleApiError(e, 'Erro ao iniciar geração de SFX')
    } finally {
      setTimeout(() => {
        generatingSFX.value = false
      }, 3000)
    }
  }

  // ---------------------------------------------------------------------------
  // Music Events (Stingers)
  // ---------------------------------------------------------------------------
  const generatingMusicEvents = ref(false)

  const hasMusicEvents = computed(() => {
    return output.value?.audioTracks?.some((a: any) => a.type === 'music_event') || false
  })

  const musicEventCount = computed(() => {
    return output.value?.audioTracks?.filter((a: any) => a.type === 'music_event').length || 0
  })

  function getMusicEventType(offsetMs: number | null | undefined): string {
    const qaData = output.value?.retentionQAData?.analysisData as any
    if (!qaData?.editBlueprint?.musicEvents) return 'stinger'
    if (offsetMs == null) return 'stinger'
    const offsetSec = offsetMs / 1000
    const event = qaData.editBlueprint.musicEvents.find(
      (e: any) => Math.abs(e.atSecond - offsetSec) < 2,
    )
    return event?.type || 'stinger'
  }

  async function startGenerateMusicEvents() {
    if (generatingMusicEvents.value) return
    generatingMusicEvents.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/generate-music-events`, { method: 'POST' })
      startPolling()
    } catch (e: unknown) {
      handleApiError(e, 'Erro ao gerar stingers')
    } finally {
      setTimeout(() => {
        generatingMusicEvents.value = false
      }, 3000)
    }
  }

  // ---------------------------------------------------------------------------
  // Retention QA
  // ---------------------------------------------------------------------------
  async function startGenerateRetentionQA() {
    if (generatingStage.value === 'RETENTION_QA') return
    generatingStage.value = 'RETENTION_QA'
    generationStartedAt.value = Date.now()
    try {
      await $fetch(`/api/outputs/${outputId}/generate-retention-qa`, { method: 'POST' })
      startPolling()
    } catch (e: unknown) {
      generatingStage.value = null
      generationStartedAt.value = 0
      handleApiError(e, 'Erro ao iniciar análise de retenção')
    }
  }

  async function approveRetentionQA() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'RETENTION_QA', approved: true },
      })
      setLocalGateStatus(output.value!, 'RETENTION_QA', 'APPROVED')
      await loadOutput()
    } catch {
      notifyError('Erro ao aprovar análise de retenção.')
    } finally {
      approving.value = false
    }
  }

  async function fixScriptWithRetentionQA() {
    if (generatingStage.value === 'SCRIPT_FIX') return
    generatingStage.value = 'SCRIPT_FIX'
    try {
      await $fetch(`/api/outputs/${outputId}/regenerate-script`, {
        method: 'POST',
        body: { useRetentionQA: true, refineOutline: true },
      })
    } catch {
      notifyError('Erro ao corrigir roteiro com feedback de retenção.')
      generatingStage.value = null
    }
  }

  // ---------------------------------------------------------------------------
  // Script regeneration
  // ---------------------------------------------------------------------------
  const showScriptFeedbackModal = ref(false)
  const scriptFeedback = ref('')
  const regeneratingScript = ref(false)

  async function confirmRegenerateScript() {
    if (!scriptFeedback.value.trim()) return
    regeneratingScript.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/regenerate-script`, {
        method: 'POST',
        body: { feedback: scriptFeedback.value },
      })
      showScriptFeedbackModal.value = false
      scriptFeedback.value = ''
      await loadOutput()
    } catch {
      notifyError('Erro ao regenerar roteiro. Tente novamente.')
    } finally {
      regeneratingScript.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // Generate actions
  // ---------------------------------------------------------------------------
  async function startGenerateWriter(feedback?: string) {
    if (generatingStage.value === 'WRITER') return
    generatingStage.value = 'WRITER'
    generationStartedAt.value = Date.now()
    try {
      // generate-writer é síncrono: a prosa já está no banco quando o $fetch resolve
      await $fetch(`/api/outputs/${outputId}/generate-writer`, {
        method: 'POST',
        body: feedback ? { feedback } : {},
      })
      await loadOutput()
      await loadCosts()
    } catch (e: any) {
      notifyError(e?.data?.message || 'Erro ao gerar prosa do escritor.')
    } finally {
      generatingStage.value = null
      generationStartedAt.value = 0
    }
  }

  async function startGenerateScript() {
    if (generatingStage.value === 'SCRIPT') return
    generatingStage.value = 'SCRIPT'
    generationStartedAt.value = Date.now()
    try {
      await $fetch(`/api/outputs/${outputId}/generate-script`, { method: 'POST' })
      startPolling()
    } catch (e: any) {
      generatingStage.value = null
      generationStartedAt.value = 0
      notifyError(e?.data?.message || 'Erro ao iniciar geração do roteiro.')
    }
  }

  async function generateImages() {
    generatingStage.value = 'IMAGES'
    generationStartedAt.value = Date.now()
    try {
      await $fetch(`/api/outputs/${outputId}/generate-images`, { method: 'POST' })
      startPolling()
    } catch (e: unknown) {
      generatingStage.value = null
      generationStartedAt.value = 0
      handleApiError(e, 'Erro ao iniciar geração de imagens')
    }
  }

  async function generateAudio() {
    generatingStage.value = 'AUDIO'
    generationStartedAt.value = Date.now()
    try {
      await $fetch(`/api/outputs/${outputId}/generate-audio`, { method: 'POST' })
      startPolling()
    } catch (e: unknown) {
      generatingStage.value = null
      generationStartedAt.value = 0
      handleApiError(e, 'Erro ao iniciar geração de áudio')
    }
  }

  async function generateBgm() {
    generatingStage.value = 'BGM'
    generationStartedAt.value = Date.now()
    try {
      const hasExisting = bgmTracks.value.length > 0
      await $fetch(`/api/outputs/${outputId}/generate-background-music`, {
        method: 'POST',
        body: hasExisting ? { force: true } : undefined,
      })
      startPolling()
    } catch (e: unknown) {
      generatingStage.value = null
      generationStartedAt.value = 0
      handleApiError(e, 'Erro ao iniciar geração de música')
    }
  }

  async function generateMotion() {
    generatingStage.value = 'MOTION'
    generationStartedAt.value = Date.now()
    try {
      await $fetch(`/api/outputs/${outputId}/generate-motion`, { method: 'POST' })
      startPolling()
    } catch (e: unknown) {
      generatingStage.value = null
      generationStartedAt.value = 0
      handleApiError(e, 'Erro ao iniciar geração de motion')
    }
  }

  // ---------------------------------------------------------------------------
  // Approve actions
  // ---------------------------------------------------------------------------
  async function approveWriter() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'WRITER', approved: true },
      })
      setLocalGateStatus(output.value!, 'WRITER', 'APPROVED')
      await loadOutput()
    } catch {
      notifyError('Erro ao aprovar prosa do escritor.')
    } finally {
      approving.value = false
    }
  }

  async function approveScript() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'SCRIPT', approved: true },
      })
      setLocalGateStatus(output.value!, 'SCRIPT', 'APPROVED')
      await loadOutput()
    } catch {
      notifyError('Erro ao aprovar roteiro.')
    } finally {
      approving.value = false
    }
  }

  async function approveImages() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'IMAGES', approved: true },
      })
      setLocalGateStatus(output.value!, 'IMAGES', 'APPROVED')
      await loadOutput()
    } catch {
      notifyError('Erro ao aprovar imagens.')
    } finally {
      approving.value = false
    }
  }

  async function approveAudio() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'AUDIO', approved: true },
      })
      setLocalGateStatus(output.value!, 'AUDIO', 'APPROVED')
      await loadOutput()
    } catch {
      notifyError('Erro ao aprovar áudio.')
    } finally {
      approving.value = false
    }
  }

  async function approveBgm() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'BGM', approved: true },
      })
      setLocalGateStatus(output.value!, 'BGM', 'APPROVED')
      await loadOutput()
    } catch {
      notifyError('Erro ao aprovar música.')
    } finally {
      approving.value = false
    }
  }

  async function approveMotion() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'MOTION', approved: true },
      })
      setLocalGateStatus(output.value!, 'MOTION', 'APPROVED')
      await loadOutput()
    } catch {
      notifyError('Erro ao aprovar motion.')
    } finally {
      approving.value = false
    }
  }

  async function approveRender() {
    if (approving.value) return
    approving.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/approve-stage`, {
        method: 'PATCH',
        body: { stage: 'RENDER', approved: true },
      })
      setLocalGateStatus(output.value!, 'RENDER', 'APPROVED')
      output.value!.status = 'COMPLETED'
      await loadOutput()
    } catch {
      notifyError('Erro ao aprovar renderização.')
    } finally {
      approving.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // Revert to stage
  // ---------------------------------------------------------------------------
  const reverting = ref(false)

  async function revertToStage(targetStage: string) {
    if (reverting.value || approving.value) return
    const targetIdx = STAGE_ORDER.findIndex((s) => s.stage === targetStage)
    if (targetIdx < 0) return
    const stageInfo = STAGE_ORDER[targetIdx]
    if (!stageInfo) return
    const targetLabel = stageInfo.label

    // Special: reset entire pipeline
    if (targetStage === 'STORY_OUTLINE') {
      if (
        !confirmAction(
          'Resetar este output para o início do pipeline?\n\n' +
            'Isso vai limpar todo o pipeline como no início do output (plano, roteiro, visual, narração, música, motion e render).\n' +
            'Configurações base como narrador, velocidade, idioma, estilos e o vínculo com o plano de monetização serão mantidos.',
        )
      )
        return
      reverting.value = true
      try {
        await $fetch(`/api/outputs/${outputId}/reset-to-plan`, { method: 'POST' })
        await loadOutput()
      } catch (error: any) {
        notifyError(error?.data?.message || 'Erro ao voltar para a etapa Plano.')
        await loadOutput()
      } finally {
        reverting.value = false
      }
      return
    }

    const stagesToRevert = STAGE_ORDER.slice(targetIdx).filter((s) => {
      return isStageApproved(output.value, s.stage)
    })
    if (stagesToRevert.length === 0) return

    const stageNames = stagesToRevert.map((s) => s.label).join(', ')
    if (
      !confirmAction(
        `Voltar para a etapa "${targetLabel}"?\n\nAs seguintes aprovações serão removidas: ${stageNames}.\nOs assets já gerados serão mantidos.`,
      )
    )
      return

    reverting.value = true
    try {
      for (const si of [...stagesToRevert].reverse()) {
        await $fetch(`/api/outputs/${outputId}/approve-stage`, {
          method: 'PATCH',
          body: { stage: si.stage, approved: false },
        })
        setLocalGateStatus(output.value!, si.stage, 'NOT_STARTED')
      }
      await loadOutput()
    } catch (error: any) {
      notifyError(error?.data?.message || 'Erro ao voltar para a etapa selecionada.')
      await loadOutput()
    } finally {
      reverting.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  async function renderMaster() {
    if (rendering.value) return
    await openRenderOptionsModal('master')
  }

  async function renderAgain() {
    if (rendering.value) return
    await openRenderOptionsModal('again')
  }

  async function doStartRender(opts?: {
    includeLogo: boolean
    includeCaptions: boolean
    includeStingers: boolean
    captionStyleId: string | null
    volumeOverride?: { global?: number; perTrack?: Record<number, number> }
  }) {
    rendering.value = true
    try {
      await $fetch(`/api/outputs/${outputId}/render`, {
        method: 'POST',
        body: opts
          ? {
              includeLogo: opts.includeLogo,
              includeCaptions: opts.includeCaptions,
              includeStingers: opts.includeStingers,
              captionStyleId: opts.captionStyleId ?? undefined,
              volumeOverride: opts.volumeOverride ?? undefined,
            }
          : undefined,
      })
      output.value!.status = 'IN_PROGRESS'
      startPolling()
    } catch {
      notifyError('Erro ao iniciar renderização.')
    } finally {
      rendering.value = false
    }
  }

  function downloadMaster() {
    const downloadUrl = `/api/outputs/${outputId}/download`
    const fileName = `${output.value?.title || 'video'}.mp4`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ---------------------------------------------------------------------------
  // Image regeneration (normal mode — uses shared regeneratingSceneId)
  // ---------------------------------------------------------------------------
  async function regenerateImage(scene: any) {
    if (regeneratingSceneId.value) return
    regeneratingSceneId.value = scene.id
    try {
      const newImage = await $fetch(`/api/scenes/${scene.id}/regenerate-image`, {
        method: 'POST',
        body: { prompt: scene.visualDescription },
      })
      if (!scene.images) scene.images = []
      scene.images.unshift(newImage)
    } catch {
      notifyError('Erro ao regenerar imagem.')
    } finally {
      regeneratingSceneId.value = null
    }
  }

  // ---------------------------------------------------------------------------
  // Visual helpers
  // ---------------------------------------------------------------------------
  function getStepClass(isCompleted: boolean, isPreviousCompleted: boolean) {
    if (isCompleted) return 'completed cursor-pointer hover:bg-white/5'
    if (isPreviousCompleted) return 'active'
    return 'pending'
  }

  function getStatusClass(status: string) {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'RENDERED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'FAILED':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      case 'IN_PROGRESS':
        return 'bg-primary/10 text-blue-400 border-blue-500/30 animate-pulse'
      case 'DRAFT':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
    }
  }

  return {
    // Stage computation
    pipelineStage,
    isPlanoStage,
    isWriterStage,
    isRoteiroStage,
    speechReady,
    needsSpeechConfig,
    canRenderMaster,
    isRenderingActive,
    allScenesHaveImages,
    allScenesHaveAudio,
    allScenesHaveVideos,

    // Generation state (rendering, generatingStage, generationStartedAt are external)
    generatingOutline,
    approving,

    // Generate actions
    startGenerateWriter,
    startGenerateScript,
    generateImages,
    generateAudio,
    generateBgm,
    generateMotion,

    // Approve actions
    approveWriter,
    approveScript,
    approveImages,
    approveAudio,
    approveBgm,
    approveMotion,
    approveRender,

    // Retention QA
    startGenerateRetentionQA,
    approveRetentionQA,
    fixScriptWithRetentionQA,

    // Render
    renderMaster,
    renderAgain,
    doStartRender,
    downloadMaster,

    // BGM helpers
    bgmTracks,
    getBgmTrackMeta,
    getBgmTrackPrompt,

    // SFX
    generatingSFX,
    hasSFXScenes,
    sfxSceneCount,
    allScenesHaveSFX,
    generateSFX,

    // Music Events
    generatingMusicEvents,
    hasMusicEvents,
    musicEventCount,
    getMusicEventType,
    startGenerateMusicEvents,

    // Revert
    reverting,
    revertToStage,

    // Script regeneration
    showScriptFeedbackModal,
    scriptFeedback,
    regeneratingScript,
    confirmRegenerateScript,

    // Image regeneration (normal mode)
    regenerateImage,

    // Visual helpers
    getStepClass,
    getStatusClass,
  }
}
