// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-31',

  future: {
    compatibilityVersion: 4,
  },

  srcDir: 'app',

  ssr: false,

  app: {
    buildAssetsDir: '_nuxt/'
  },

  modules: [
    '@pinia/nuxt'
  ],

  // Configurações do runtime
  runtimeConfig: {
    // Chaves privadas (server-side only)
    database: {
      url: process.env.DATABASE_URL
    },

    // Provedores de IA
    providers: {
      script: {
        name: process.env.SCRIPT_PROVIDER ?? 'openai',
        apiKey: process.env.OPENAI_API_KEY ?? '',
        model: process.env.OPENAI_MODEL ?? 'gpt-4-turbo-preview'
      },
      tts: {
        name: process.env.TTS_PROVIDER ?? 'elevenlabs',
        apiKey: process.env.ELEVENLABS_API_KEY ?? '',
        voiceId: process.env.ELEVENLABS_VOICE_ID ?? ''
      },
      image: {
        name: process.env.IMAGE_PROVIDER ?? 'replicate',
        apiKey: process.env.REPLICATE_API_KEY ?? '',
        model: process.env.REPLICATE_IMAGE_MODEL ?? 'stability-ai/sdxl'
      },
      motion: {
        name: process.env.MOTION_PROVIDER ?? 'replicate',
        apiKey: process.env.RUNPOD_API_KEY ?? process.env.REPLICATE_API_KEY ?? '',
        endpointId: process.env.RUNPOD_ENDPOINT_ID ?? ''
      }
    },

    storage: {
      path: process.env.STORAGE_PATH ?? './storage'
    },

    // Chaves públicas (expostas ao cliente)
    public: {
      appName: 'The Gap Files',
      appVersion: '0.1.0'
    }
  },

  // Nitro server engine
  nitro: {
    experimental: {
      asyncContext: true
    }
  },

  // TypeScript
  typescript: {
    strict: true,
    typeCheck: true
  },

  // Dev tools
  devtools: { enabled: false }
})
