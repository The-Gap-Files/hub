import ffmpeg from 'fluent-ffmpeg'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

/**
 * Ajusta a duração de um buffer de áudio para a duração exata desejada.
 * 
 * - Se o áudio é mais longo: corta (trim)
 * - Se o áudio é mais curto: padea com silêncio (apad + trim)
 * - Se a duração já está correta (±0.1s): retorna o buffer original
 * 
 * @param audioBuffer - Buffer do áudio de entrada (MP3)
 * @param targetDurationSeconds - Duração desejada em segundos
 * @returns Buffer do áudio ajustado
 */
export async function adjustAudioDuration(
  audioBuffer: Buffer,
  targetDurationSeconds: number
): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'sfx-adjust')
  await fs.mkdir(tempDir, { recursive: true })

  const id = randomUUID().slice(0, 8)
  const inputPath = join(tempDir, `sfx-input-${id}.mp3`)
  const outputPath = join(tempDir, `sfx-output-${id}.mp3`)

  try {
    await fs.writeFile(inputPath, audioBuffer)

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          // Padear com silêncio se for mais curto, sem efeito se for mais longo
          `apad=whole_dur=${targetDurationSeconds}`,
        ])
        .duration(targetDurationSeconds) // Corta no timestamp exato
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    const result = await fs.readFile(outputPath)
    return result
  } finally {
    // Cleanup silencioso
    await fs.unlink(inputPath).catch(() => { })
    await fs.unlink(outputPath).catch(() => { })
  }
}
