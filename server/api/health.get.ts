/**
 * Health Check Endpoint
 * Usado pelo Docker HEALTHCHECK e pelo Render.com
 */
export default defineEventHandler(() => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'The Gap Files Hub',
    version: '1.0.0',
    features: {
      whisper: true,
      ffmpeg: true,
      database: true
    }
  }
})
