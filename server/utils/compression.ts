import { gzip, gunzip } from 'node:zlib'
import { promisify } from 'node:util'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * Comprime um Buffer usando gzip
 */
export async function compressBuffer(buffer: Buffer): Promise<Buffer> {
  return await gzipAsync(buffer)
}

/**
 * Descomprime um Buffer usando gunzip
 */
export async function decompressBuffer(buffer: Buffer): Promise<Buffer> {
  return await gunzipAsync(buffer)
}

/**
 * Converte Buffer para Bytes (Prisma BYTEA)
 * Comprime automaticamente com gzip
 */
export async function bufferToBytes(buffer: Buffer): Promise<Buffer> {
  return await compressBuffer(buffer)
}

/**
 * Converte Bytes (Prisma BYTEA) para Buffer
 * Descomprime automaticamente com gunzip
 */
export async function bytesToBuffer(bytes: Buffer): Promise<Buffer> {
  return await decompressBuffer(bytes)
}

/**
 * Detecta o MIME type de um buffer baseado nos magic bytes
 */
export function getMimeType(buffer: Buffer): string {
  // PNG
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png'
  }

  // JPEG
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg'
  }

  // WebP
  if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp'
  }

  // MP4
  if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return 'video/mp4'
  }

  // MP3
  if (buffer.length >= 3) {
    const b0 = buffer[0]
    const b1 = buffer[1]
    const b2 = buffer[2]
    if ((b0 === 0x49 && b1 === 0x44 && b2 === 0x53) || // ID3
      (b0 === 0xFF && b1 !== undefined && (b1 & 0xE0) === 0xE0)) { // MPEG frame
      return 'audio/mpeg'
    }
  }

  // WAV
  if (buffer.length >= 4 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'audio/wav'
  }

  // Fallback genérico
  return 'application/octet-stream'
}

/**
 * Cria uma Data URL a partir de bytes comprimidos
 */
export async function createDataUrl(bytes: Buffer, mimeType: string): Promise<string> {
  const buffer = await bytesToBuffer(bytes)
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/**
 * Calcula estatísticas de compressão
 */
export function getCompressionStats(originalSize: number, compressedSize: number) {
  const ratio = ((originalSize - compressedSize) / originalSize) * 100
  return {
    originalSize,
    compressedSize,
    savedBytes: originalSize - compressedSize,
    compressionRatio: ratio.toFixed(2) + '%'
  }
}
