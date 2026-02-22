import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import ffmpeg from 'fluent-ffmpeg'

/**
 * Ajusta a duração de um buffer de áudio SFX para coincidir exatamente
 * com a duração da narração da cena. Pad com silêncio se curto, trim se longo.
 *
 * Extraído de output-pipeline.service.ts (função standalone, sem dependência de classe).
 */
export async function adjustSfxDuration(audioBuffer: Buffer, targetDurationSeconds: number): Promise<Buffer> {
  const tempDir = path.join(os.tmpdir(), 'sfx-adjust')
  await fs.mkdir(tempDir, { recursive: true })

  const id = crypto.randomUUID().slice(0, 8)
  const inputPath = path.join(tempDir, `sfx-in-${id}.mp3`)
  const outputPath = path.join(tempDir, `sfx-out-${id}.mp3`)

  try {
    await fs.writeFile(inputPath, audioBuffer)

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          `apad=whole_dur=${targetDurationSeconds}`,
        ])
        .duration(targetDurationSeconds)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    return await fs.readFile(outputPath)
  } finally {
    await fs.unlink(inputPath).catch(() => { })
    await fs.unlink(outputPath).catch(() => { })
  }
}
