/**
 * POST /api/media/test-model
 * 
 * Faz um teste rápido de um modelo de mídia para validar se funciona.
 * Recebe { providerId, modelId, testImageBase64? } e retorna { success, type, preview?, duration?, error? }
 * 
 * Tipos de teste por capability:
 * - image: Gera uma imagem simples (512x512)
 * - tts: Sintetiza uma frase curta
 * - music: Gera 5 segundos de música
 * - motion: Anima uma imagem fornecida (requer testImageBase64)
 */
import Replicate from 'replicate'
import { getMediaProviderApiKey, getMediaProviders } from '../../services/media/media-factory'
import { buildImageInput, buildMotionInput } from '../../utils/input-schema-builder'
import { GeminiImageProvider } from '../../services/providers/image/gemini-image.provider'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { providerId, modelId, testImageBase64 } = body

  if (!providerId || !modelId) {
    throw createError({ statusCode: 400, message: 'providerId e modelId são obrigatórios' })
  }

  // Buscar provider e modelo do cache
  const providers = await getMediaProviders()
  const provider = providers.find(p => p.id === providerId)
  if (!provider) {
    throw createError({ statusCode: 404, message: `Provider "${providerId}" não encontrado` })
  }

  const model = provider.models.find((m: any) => m.modelId === modelId || m.id === modelId)
  if (!model) {
    throw createError({ statusCode: 404, message: `Modelo "${modelId}" não encontrado em "${providerId}"` })
  }

  // Resolver API key
  let apiKey: string
  try {
    apiKey = await getMediaProviderApiKey(providerId as any)
  } catch {
    throw createError({ statusCode: 400, message: `API Key não configurada para "${providerId}"` })
  }

  // Determinar tipo de teste baseado no inputSchema e modelId
  const schema = (model as any).inputSchema as any
  const actualModelId = (model as any).modelId || modelId

  // Detectar tipo de modelo pelas capabilities no registry ou pelo schema
  const isImage = schema?.dimensionMode && schema.dimensionMode !== 'none' && !schema.imageField
  const isTTS = schema?.promptField === 'text' || providerId === 'elevenlabs'
  const isMusic = schema?.durationMode === 'seconds' && !schema.imageField
  const isMotion = !!schema?.imageField

  const startTime = Date.now()

  try {
    // ─── TTS (ElevenLabs) ─────────────────────────────────
    if (isTTS && providerId === 'elevenlabs') {
      const ttsModelId = schema?.defaults?.model_id || actualModelId
      // Buscar primeira voz disponível
      const voicesRes = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey }
      })
      if (!voicesRes.ok) throw new Error(`ElevenLabs API error: ${voicesRes.status}`)
      const voicesData = await voicesRes.json() as any
      const firstVoice = voicesData.voices?.[0]
      if (!firstVoice) throw new Error('Nenhuma voz encontrada na conta ElevenLabs')

      // eleven_v3 suporta Audio Tags inline para emoções: [excited], [whispers], [sighs], [happily], etc.
      const testText = ttsModelId === 'eleven_v3'
        ? '[happily] Teste do modelo v3. [whispers] Você pode colocar emoções na fala. [sighs] Como assim? [excited] Incrível!'
        : 'Teste de modelo de narração. Verificando funcionamento.'

      const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${firstVoice.voice_id}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: testText,
          model_id: ttsModelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      })
      if (!ttsRes.ok) {
        const errText = await ttsRes.text()
        throw new Error(`ElevenLabs TTS error: ${ttsRes.status} - ${errText}`)
      }

      const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

      // Converter para data URL para reprodução no frontend
      const audioBase64 = audioBuffer.toString('base64')
      const previewUrl = `data:audio/mpeg;base64,${audioBase64}`

      return {
        success: true,
        type: 'tts',
        modelName: (model as any).name,
        voiceUsed: firstVoice.name,
        previewUrl,
        audioSize: audioBuffer.length,
        elapsed: `${elapsed}s`,
        message: `✅ TTS "${(model as any).name}" funcionando com voz "${firstVoice.name}" (${(audioBuffer.length / 1024).toFixed(1)}KB em ${elapsed}s)`
      }
    }

    // ─── Replicate (imagem, music, motion) ─────────────────
    if (providerId === 'replicate') {
      const client = new Replicate({ auth: apiKey })

      // ─── Imagem ─────────────────────────────────
      if (isImage) {
        let input: any
        if (schema) {
          input = buildImageInput(schema, {
            prompt: 'A beautiful sunset over the ocean, photorealistic, 4k, serene landscape',
            width: 512,
            height: 512,
            aspectRatio: '1:1'
          })
        } else {
          input = { prompt: 'A beautiful sunset over the ocean, photorealistic', width: 512, height: 512 }
        }

        const output: any = await client.run(actualModelId as any, { input })
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

        // Extrair URL preview
        let previewUrl: string | null = null
        if (Array.isArray(output) && output.length > 0) {
          previewUrl = typeof output[0] === 'string' ? output[0] : output[0]?.url?.() || null
        } else if (output && typeof output === 'object' && typeof output.url === 'function') {
          previewUrl = output.url()
        } else if (typeof output === 'string') {
          previewUrl = output
        }

        return {
          success: true,
          type: 'image',
          modelName: (model as any).name,
          previewUrl,
          elapsed: `${elapsed}s`,
          message: `✅ Imagem "${(model as any).name}" gerada com sucesso em ${elapsed}s`
        }
      }

      // ─── Music ─────────────────────────────────
      if (isMusic) {
        const input: Record<string, any> = {
          [schema.promptField || 'prompt']: 'Ambient cinematic soundtrack, mysterious, dark piano, 90bpm',
          ...(schema.defaults || {})
        }
        if (schema.durationField) input[schema.durationField] = 5

        const output: any = await client.run(actualModelId as any, { input })
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

        let previewUrl: string | null = null
        if (output && typeof output === 'object' && typeof output.url === 'function') {
          previewUrl = output.url()
        } else if (typeof output === 'string') {
          previewUrl = output
        }

        return {
          success: true,
          type: 'music',
          modelName: (model as any).name,
          previewUrl,
          elapsed: `${elapsed}s`,
          message: `✅ Música "${(model as any).name}" gerada em ${elapsed}s (5s de áudio)`
        }
      }

      // ─── Motion (image-to-video) ─────────────────
      if (isMotion) {
        if (!testImageBase64) {
          return {
            success: false,
            type: 'motion',
            modelName: (model as any).name,
            needsImage: true,
            elapsed: '0s',
            message: `📎 Anexe uma imagem para testar "${(model as any).name}". Modelos de motion animam imagens estáticas em vídeo.`
          }
        }

        // Converter base64 para Buffer
        const imageBuffer = Buffer.from(testImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')

        const { input } = buildMotionInput(schema, {
          imageBuffer,
          prompt: 'Gentle natural movement, subtle camera pan, cinematic lighting, atmospheric',
          duration: 3
        })

        const output: any = await client.run(actualModelId as any, { input })
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

        let previewUrl: string | null = null
        if (output && typeof output === 'object' && typeof output.url === 'function') {
          previewUrl = output.url()
        } else if (typeof output === 'string') {
          previewUrl = output
        } else if (Array.isArray(output) && output.length > 0) {
          previewUrl = typeof output[0] === 'string' ? output[0] : output[0]?.url?.() || null
        }

        return {
          success: true,
          type: 'motion',
          modelName: (model as any).name,
          previewUrl,
          elapsed: `${elapsed}s`,
          message: `✅ Motion "${(model as any).name}" executado com sucesso em ${elapsed}s`
        }
      }

      // ─── Fallback: tentativa genérica ─────────
      const input: Record<string, any> = {
        [schema?.promptField || 'prompt']: 'test prompt for model validation',
        ...(schema?.defaults || {})
      }
      const output: any = await client.run(actualModelId as any, { input })
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

      return {
        success: true,
        type: 'unknown',
        modelName: (model as any).name,
        elapsed: `${elapsed}s`,
        message: `✅ Modelo "${(model as any).name}" executado com sucesso em ${elapsed}s`
      }
    }

    // ─── RunPod ─────────────────────────────────────────────
    if (providerId === 'runpod') {
      if (!testImageBase64) {
        return {
          success: false,
          type: 'motion',
          modelName: (model as any).name,
          needsImage: true,
          elapsed: '0s',
          message: `📎 Anexe uma imagem para testar "${(model as any).name}". RunPod usa endpoint dedicado para motion.`
        }
      }

      // RunPod: montar payload manualmente (endpoint dedicado)
      const imageBuffer = Buffer.from(testImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      const { input } = buildMotionInput(schema, {
        imageBuffer,
        prompt: 'Gentle natural movement, subtle camera pan, cinematic lighting',
        duration: 3
      })

      // RunPod usa fetch direto para o endpoint serverless
      const runpodEndpoint = process.env.RUNPOD_ENDPOINT_URL || ''
      if (!runpodEndpoint) {
        return {
          success: false,
          type: 'motion',
          modelName: (model as any).name,
          elapsed: '0s',
          message: `⚠️ RUNPOD_ENDPOINT_URL não configurada. Configure a variável de ambiente.`
        }
      }

      const runRes = await fetch(`${runpodEndpoint}/runsync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input })
      })

      if (!runRes.ok) {
        const errText = await runRes.text()
        throw new Error(`RunPod error: ${runRes.status} - ${errText}`)
      }

      const runData = await runRes.json() as any
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

      return {
        success: true,
        type: 'motion',
        modelName: (model as any).name,
        elapsed: `${elapsed}s`,
        message: `✅ RunPod "${(model as any).name}" executado com sucesso em ${elapsed}s (status: ${runData.status || 'ok'})`
      }
    }

    // ─── Gemini (Imagen 4) ──────────────────────────────────
    if (providerId === 'gemini') {
      const gemini = new GeminiImageProvider({ apiKey, model: actualModelId })

      // Usando estilo "Dark Souls / Elden Ring" (Dark Fantasy)
      const prompt = `A fallen angel with tattered black wings clashing swords with a fiery demon in a ruined gothic cathedral.
      Style: Dark fantasy, Souls-like aesthetic, eldritch horror, grimdark, oil painting texture.
      Lighting: dramatic divine light from above contrasted with hellfire below, deep shadows, volumetric fog, ethereal glow.
      Atmosphere: epic, desperate battle, apocalyptic, majestic terror, ancient and decaying.
      Composition: wide dynamic angle capturing the scale of the fight, particles of ash and embers floating, high contrast.
      Tags: ultra detailed armor, intricate wing feathers, glowing demon eyes, gothic architecture, masterpiece, 8k, best quality.`

      const res = await gemini.generate({
        prompt,
        width: 1792,
        height: 1024,
        aspectRatio: '16:9',
        numVariants: 1
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      const firstImage = res.images[0]
      if (!firstImage) throw new Error('Gemini retornou array de imagens vazio')
      const previewUrl = `data:image/png;base64,${firstImage.buffer.toString('base64')}`

      return {
        success: true,
        type: 'image',
        modelName: (model as any).name,
        previewUrl,
        elapsed: `${elapsed}s`,
        message: `✅ Imagem "${(model as any).name}" gerada com sucesso em ${elapsed}s`
      }
    }

    throw createError({ statusCode: 400, message: `Provider "${providerId}" não suportado para teste` })

  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`[Media Test] Error testing ${providerId}/${actualModelId}:`, error.message)

    return {
      success: false,
      type: isImage ? 'image' : isTTS ? 'tts' : isMusic ? 'music' : isMotion ? 'motion' : 'unknown',
      modelName: (model as any).name,
      elapsed: `${elapsed}s`,
      error: error.message || 'Erro desconhecido',
      message: `❌ Falha ao testar "${(model as any).name}": ${error.message}`
    }
  }
})
