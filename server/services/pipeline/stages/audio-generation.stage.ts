/**
 * Audio Generation Stage
 * Generates TTS narration for each scene.
 * Supports hook-only timing (16-22s budget-based) and standard WPM-based.
 */

import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../providers'
import { costLogService } from '../../cost-log.service'
import type { TTSRequest } from '../../../types/ai-providers'
import {
  appendPauseTagsForV3,
  clamp,
  computeHookOnlySceneBudgetsSeconds,
  computeSpeedForBudget,
  countWords,
  resolveHookOnlyTotalDurationSeconds,
  stripInlineAudioTags,
  stripSsmlBreakTags
} from '../../../utils/hook-only-audio-timing'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'

const LOG = '[AudioStage]'
const CONCURRENCY_LIMIT = 5

// ---- Interfaces ----

export interface AudioStageInput {
  outputId: string
  voiceId: string
  language?: string
  narrationLanguage?: string
  targetWPM?: number
  monetizationContext?: any
  duration?: number | null
  ttsProvider?: string | null
}

// ---- Stage ----

class AudioGenerationStage {
  async execute(input: AudioStageInput): Promise<void> {
    const {
      outputId,
      voiceId,
      narrationLanguage,
      targetWPM: inputWPM,
      monetizationContext,
      duration,
      ttsProvider: existingTtsProvider
    } = input

    console.log(`${LOG} Generating audio per scene for Output ${outputId}`)

    // 1. Load scenes ordered by position
    const scenes = await prisma.scene.findMany({
      where: { outputId },
      orderBy: { order: 'asc' }
    })

    // 2. Get TTS provider
    const ttsProvider = providerManager.getTTSProvider()

    // 3. Resolve narrative role and hook-only mode
    const narrativeRole = (monetizationContext as any)?.narrativeRole
    const isHookOnly = narrativeRole === 'hook-only'
    const hookOnlyTotalSeconds = isHookOnly
      ? resolveHookOnlyTotalDurationSeconds(duration)
      : undefined
    const hookOnlyBudgets = isHookOnly
      ? computeHookOnlySceneBudgetsSeconds(hookOnlyTotalSeconds!)
      : undefined

    // 4. Resolve model from DB (mediaAssignment for 'tts-narration')
    const ttsAssignment = await prisma.mediaAssignment.findUnique({
      where: { taskId: 'tts-narration' }
    })
    const dbModelId = ttsAssignment?.model
    if (dbModelId) {
      console.log(`${LOG} Using model from DB (tts-narration): ${dbModelId}`)
    } else {
      console.log(`${LOG} No 'tts-narration' config in DB. Using fallback.`)
    }

    // 5. Chunk scenes for concurrent processing
    const sceneChunks: (typeof scenes)[] = []
    for (let i = 0; i < scenes.length; i += CONCURRENCY_LIMIT) {
      sceneChunks.push(scenes.slice(i, i + CONCURRENCY_LIMIT))
    }

    // 6. Process chunks sequentially, scenes within chunk in parallel
    for (const chunk of sceneChunks) {
      await Promise.all(chunk.map(async (scene) => {
        if (!scene.narration) return

        // Delete existing narration audio tracks (always regenerate fresh)
        const existingAudios = await prisma.audioTrack.findMany({
          where: { sceneId: scene.id, type: 'scene_narration' }
        })

        if (existingAudios.length > 0) {
          await prisma.audioTrack.deleteMany({
            where: { sceneId: scene.id, type: 'scene_narration' }
          })
          console.log(`${LOG} Scene ${scene.order + 1}: ${existingAudios.length} previous audio(s) deleted.`)
        }

        // WPM-based speed calculation (legacy default, still useful as fallback)
        const targetWPM = inputWPM || 150
        const calculatedSpeedFromWPM = targetWPM / 150
        const safeSpeedFromWPM = Math.max(0.7, Math.min(1.2, calculatedSpeedFromWPM))

        // Validate: Voice ID is mandatory
        if (!voiceId) {
          throw new Error(`${LOG} Voice ID is required. Please select a voice before generating output.`)
        }

        // ---- Hook-Only timing (16-22s): internal control via budgets + speed + v3 tags ----
        // No deterministic FFmpeg silence: only ElevenLabs v3 inline tags.
        const sceneIndex = scene.order // 0-based
        const targetBudgetSeconds = (isHookOnly && hookOnlyBudgets)
          ? (hookOnlyBudgets[sceneIndex] ?? 5)
          : 5

        // Base text sent to TTS: allow inline v3 tags ([pause], [breathes], etc.)
        // but block SSML <break> tags (only inline tags are allowed).
        const narrationRawForTTS = stripSsmlBreakTags(scene.narration).trim()

        // Text for word counting: strip v3 inline tags (should not count as words)
        const narrationForCounting = stripInlineAudioTags(scene.narration)
        const wc = countWords(narrationForCounting)

        let speed = isHookOnly
          ? computeSpeedForBudget(wc, targetBudgetSeconds)
          : safeSpeedFromWPM

        // Hook-only: do not slow down just to "fill" the budget.
        // If the scene is short, accept ending earlier (option A).
        if (isHookOnly) {
          speed = Math.max(speed, safeSpeedFromWPM)
        }

        // Hook-Only: no artificial [pause] injection - natural audio duration is respected.
        const pauseCount = 0

        const maxAttempts = isHookOnly ? 3 : 1
        const toleranceSeconds = isHookOnly ? 0.35 : 999

        let audioResponse: any | null = null
        let realDuration = 0

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const ttsText = isHookOnly
            ? appendPauseTagsForV3(narrationRawForTTS, pauseCount)
            : narrationRawForTTS

          if (isHookOnly) {
            console.log(`${LOG} Scene ${scene.order + 1} hook-only attempt ${attempt}: budget=${targetBudgetSeconds.toFixed(2)}s speed=${speed.toFixed(2)} pauses=${pauseCount} words=${wc}`)
          } else {
            const estimatedAudioDuration = wc > 0 ? (wc / targetWPM) * 60 : 0
            console.log(`${LOG} Generating audio for scene ${scene.order + 1}. WPM: ${targetWPM}, Speed: ${speed.toFixed(2)}x, Est. Duration: ${estimatedAudioDuration.toFixed(2)}s`)
          }

          console.log(`${LOG} Scene ${scene.order + 1} TTS TEXT (full):\n${'─'.repeat(36)}\n${ttsText}\n${'─'.repeat(36)}`)

          const request: TTSRequest = {
            text: ttsText,
            voiceId,
            language: narrationLanguage || 'pt-BR',
            speed,
            modelId: dbModelId || (isHookOnly ? 'eleven_v3' : undefined)
          }

          audioResponse = await ttsProvider.synthesize(request)

          // Log cost per attempt (hook-only may have retries)
          costLogService.log({
            outputId,
            resource: 'narration',
            action: 'create',
            provider: audioResponse.costInfo.provider,
            model: audioResponse.costInfo.model,
            cost: audioResponse.costInfo.cost,
            metadata: {
              ...audioResponse.costInfo.metadata,
              attempt,
              speed,
              pauseCount,
              isHookOnly,
              targetBudgetSeconds
            },
            detail: `Scene ${scene.order + 1} narration attempt ${attempt} - ${ttsText.length} chars`
          }).catch(() => { })

          if (!isHookOnly) {
            realDuration = audioResponse.duration
            break
          }

          // Measure REAL MP3 duration (with pauses) for fitting
          realDuration = await this.probeAudioDuration(
            Buffer.from(audioResponse.audioBuffer)
          ).catch(() => audioResponse.duration)

          const diff = realDuration - targetBudgetSeconds

          if (Math.abs(diff) <= toleranceSeconds || attempt === maxAttempts) {
            break
          }

          // If too short, do not try to stretch by slowing down (option A)
          if (diff < 0) {
            break
          }

          // Speed adjustment based on real/target ratio (proportional control)
          const ratio = realDuration / Math.max(0.1, targetBudgetSeconds)
          speed = clamp(speed * ratio, 0.7, 1.2)
        }

        if (!audioResponse) return

        await prisma.audioTrack.create({
          data: {
            outputId,
            sceneId: scene.id,
            type: 'scene_narration',
            provider: ttsProvider.getName().toUpperCase() as any,
            voiceId,
            fileData: Buffer.from(audioResponse.audioBuffer) as any,
            mimeType: 'audio/mpeg',
            originalSize: audioResponse.audioBuffer.length,
            duration: realDuration || audioResponse.duration,
            // Word-level timestamps from ElevenLabs /with-timestamps
            alignment: audioResponse.wordTimings ? audioResponse.wordTimings as any : undefined
          }
        })
      }))
    }

    // Save ttsProvider on the output if not already set
    if (!existingTtsProvider) {
      await prisma.output.update({
        where: { id: outputId },
        data: { ttsProvider: ttsProvider.getName().toUpperCase() }
      })
    }
  }

  /**
   * Extracts real duration from an MP3 buffer using ffprobe.
   * Used for hook-only fitting (inline v3 pauses affect real duration).
   */
  private async probeAudioDuration(audioBuffer: Buffer): Promise<number> {
    const tempPath = path.join(
      os.tmpdir(),
      `tts-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`
    )

    try {
      await fs.writeFile(tempPath, audioBuffer)

      const duration = await new Promise<number>((resolve, reject) => {
        const proc = spawn(ffprobeInstaller.path, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          tempPath
        ])

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

        proc.on('close', (code: number | null) => {
          if (code !== 0) return reject(new Error(`ffprobe exit code ${code}: ${stderr}`))
          try {
            const parsed = JSON.parse(stdout)
            const dur = parseFloat(parsed?.format?.duration)
            if (isNaN(dur) || dur <= 0) return reject(new Error('ffprobe returned invalid duration'))
            resolve(dur)
          } catch (e) {
            reject(new Error(`Failed to parse ffprobe output: ${e}`))
          }
        })

        proc.on('error', (err: Error) => reject(new Error(`ffprobe spawn error: ${err.message}`)))
      })

      return duration
    } finally {
      await fs.unlink(tempPath).catch(() => { })
    }
  }
}

export const audioGenerationStage = new AudioGenerationStage()
