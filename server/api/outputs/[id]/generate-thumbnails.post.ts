/**
 * Gera 4 thumbnails candidatas para o output.
 * 
 * Fluxo:
 * 1. LLM (Claude Haiku) gera 4 prompts de imagem + hook texts
 * 2. Combina prompt + hook text → Photon Flash gera a thumbnail direta (com texto no prompt)
 * 3. Salva as 4 candidatas no banco
 * 4. Registra CostLog
 * 
 * NOTA: Modelos de difusão podem errar texto. O usuário aceita esse risco
 * em troca de tipografia mais orgânica e integrada à imagem.
 */

import { prisma } from '../../../utils/prisma'
import { getThumbnailDimensions } from '../../../utils/thumbnail-prompt-builder'
import { loadSkill } from '../../../utils/skill-loader'
import { validateMediaPricing, PricingNotConfiguredError, calculateLLMCost } from '../../../constants/pricing'
import { costLogService } from '../../../services/cost-log.service'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createLlmForTask, getAssignment } from '../../../services/llm/llm-factory'
import type { LlmTaskId } from '../../../constants/providers/llm-registry'
import { getMediaProviderForTask } from '../../../services/media/media-factory'
import { GeminiImageProvider } from '../../../services/providers/image/gemini-image.provider'
import { ReplicateImageProvider } from '../../../services/providers/image/replicate-image.provider'

interface ThumbnailPromptResult {
  imagePrompt: string
  hookText: string
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  // Hook text sugerido pelo usuário (opcional)
  const body = await readBody(event).catch(() => ({}))
  const userHookText = (body?.hookText || '').trim().toUpperCase().slice(0, 40)

  const output = await prisma.output.findUnique({
    where: { id },
    include: {
      script: true,
      scenes: {
        orderBy: { order: 'asc' },
        select: { order: true, narration: true, visualDescription: true }
      },
      dossier: { select: { theme: true } }
    }
  })

  if (!output) throw createError({ statusCode: 404, message: 'Output não encontrado' })
  if (output.status !== 'COMPLETED' && output.status !== 'RENDERED') {
    throw createError({
      statusCode: 422,
      message: 'O vídeo precisa estar completo para gerar thumbnails. Aprove o render primeiro.'
    })
  }

  // Resolver provider/modelo de imagem via Media Factory
  const thumbnailMedia = await getMediaProviderForTask('thumbnail')
  const imageProvider = thumbnailMedia.providerId   // 'replicate' | 'gemini'
  const imageModel = thumbnailMedia.model           // ex: 'luma/photon-flash' ou 'imagen-4.0-fast-generate-001'

  if (!thumbnailMedia.apiKey) {
    throw createError({ statusCode: 500, message: 'API Key do provider de thumbnails não configurada. Configure via Settings → Providers.' })
  }

  console.log(`[Thumbnails] 🎯 Provider: ${imageProvider}/${imageModel}`)

  // Validar pricing
  try {
    validateMediaPricing(imageModel, imageProvider)
  } catch (err: any) {
    if (err instanceof PricingNotConfiguredError) {
      throw createError({
        statusCode: 422,
        data: { code: 'PRICING_NOT_CONFIGURED', model: err.model },
        message: err.message
      })
    }
    throw err
  }

  // ═══════════════════════════════════════════════════
  // PASSO 1: LLM gera 4 prompts + hook texts
  // ═══════════════════════════════════════════════════
  const title = output.title || (output.dossier as { theme?: string })?.theme || 'Vídeo'
  const summary = output.script?.summary || ''
  const dims = getThumbnailDimensions(output.aspectRatio)

  const scenes = output.scenes
  const sceneContext = scenes
    .slice(0, 12)
    .map((s, i) => `Cena ${i + 1}: Visual: ${s.visualDescription} | Narração: "${s.narration?.slice(0, 100)}"`)
    .join('\n')

  const thumbnailSkill = loadSkill('thumbnail-creation')

  const systemPrompt = `${thumbnailSkill}

---
Você é um especialista em criar thumbnails virais para canais de mistério/true crime/conspirações no YouTube.
Plataforma: ${output.platform || 'YouTube'}
Aspecto: ${dims.aspectRatio} (${dims.width}x${dims.height})

REGRAS PARA PROMPTS DE IMAGEM:
- Gere prompts em INGLÊS (os modelos de imagem são treinados em inglês)
- Cada prompt deve ter entre 40 e 100 palavras
- Os prompts são para o modelo Luma Photon Flash (geração fotorrealística de alta qualidade)
- O texto/hook DEVE ser incluído no prompt como parte da composição visual
- Descreva o texto como elemento visual: tamanho, cor, posição, estilo (bold, glowing, etc)
- Foque em composição visual dramática: close-ups extremos, iluminação cinematográfica, contraste alto
- Tons ESCUROS e sombrios funcionam melhor (texto claro sobre fundo escuro)

COMO INCLUIR O HOOK TEXT NO PROMPT:
- Integre o texto como elemento visual da cena
- Exemplo: "...with bold red text reading 'ELE SABIA DEMAIS' overlaid at the bottom, glowing letters..."
- Use descrições visuais do texto: "large white impact font text", "neon red glowing letters", etc
- O texto deve ser CURTO (máximo 4 palavras) para o modelo renderizar melhor

REGRAS PARA HOOK TEXT:
- Escreva em PORTUGUÊS BRASILEIRO e MAIÚSCULAS
- MÁXIMO 4 palavras
- Deve gerar CURIOSIDADE EXTREMA, URGÊNCIA ou CHOQUE
- Exemplos: "NÃO ASSISTA SOZINHO", "ELE SABIA DEMAIS", "PROVAS DESTRUÍDAS", "O QUE ESCONDERAM?", "A MENTIRA FINAL"
- Cada hook deve ter um ângulo DIFERENTE da história`

  const hookInstruction = userHookText
    ? `\n\n⚠️ OBRIGATÓRIO: A PRIMEIRA thumbnail (índice 0) DEVE usar exatamente este hook text: "${userHookText}"
As outras 3 thumbnails podem ter hooks criados por você.`
    : ''

  const userPrompt = `Crie 4 thumbnails para este vídeo:

TÍTULO: ${title}
RESUMO: ${summary}

CENAS DO VÍDEO:
${sceneContext || '(sem cenas disponíveis)'}

Cada thumbnail deve capturar um ângulo diferente:
1. O momento mais impactante / revelação dramática
2. A emoção central / conexão humana  
3. O conflito / tensão principal
4. A curiosidade / mistério que atrai o clique

IMPORTANTE: O "imagePrompt" deve INCLUIR o hookText como elemento visual da cena.
Exemplo: "Dark extreme close-up of a terrified face illuminated by candlelight, with bold red glowing text reading 'ELE SABIA DEMAIS' overlaid at the bottom, cinematic horror atmosphere"${hookInstruction}

Retorne APENAS um JSON array com 4 objetos:
[
  { "imagePrompt": "Extreme close-up of a shadowy figure... with bold red text reading 'HOOK AQUI' at the bottom...", "hookText": "HOOK AQUI" },
  ...
]`

  const TASK_ID: LlmTaskId = 'thumbnail-prompt'
  const model = await createLlmForTask(TASK_ID, { temperature: 0.9, maxTokens: 2000 })
  const thumbnailAssignment = await getAssignment(TASK_ID)
  const thumbnailPromptModel = thumbnailAssignment.model

  console.log(`[Thumbnails] 🎨 Gerando prompts + hooks via ${thumbnailAssignment.provider}/${thumbnailPromptModel}...`)

  const llmResponse = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ])

  // Parsear o JSON da resposta
  const responseText = typeof llmResponse.content === 'string'
    ? llmResponse.content
    : (llmResponse.content as Array<{ type: string; text?: string }>)?.find(c => c.type === 'text')?.text || ''

  let thumbnailData: ThumbnailPromptResult[]
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    thumbnailData = JSON.parse(jsonMatch?.[0] || '[]')
    if (!Array.isArray(thumbnailData) || thumbnailData.length === 0) throw new Error('Array vazio')
    thumbnailData = thumbnailData.filter(t => t.imagePrompt && t.hookText)
  } catch {
    console.warn('[Thumbnails] ⚠️ Falha no parse JSON, tentando fallback')
    const lines = responseText.split('\n').filter((l: string) => l.trim().length > 20).slice(0, 4)
    thumbnailData = lines.map(line => ({
      imagePrompt: line,
      hookText: ''
    }))
  }

  thumbnailData = thumbnailData.slice(0, 4)
  console.log(`[Thumbnails] ✅ ${thumbnailData.length} prompts gerados pela LLM`)
  thumbnailData.forEach((t, i) => {
    console.log(`[Thumbnails]   ${i + 1}. 🖼️  "${t.imagePrompt.slice(0, 80)}..."`)
    console.log(`[Thumbnails]      🔤 Hook: "${t.hookText}"`)
  })

  // ═══════════════════════════════════════════════════
  // PASSO 2: Gerar thumbnails via provider configurado
  // ═══════════════════════════════════════════════════
  const aspectRatio = mapAspectRatio(dims.aspectRatio)

  const candidates: { base64: string; prompt: string; hookText: string }[] = []
  let totalImageCost = 0

  for (const [index, thumb] of thumbnailData.entries()) {
    try {
      console.log(`[Thumbnails] 📸 [${index + 1}/4] ${imageProvider}/${imageModel}: "${thumb.imagePrompt.slice(0, 70)}..."`)

      let imageBuffer: Buffer

      if (imageProvider === 'gemini') {
        // Gemini Imagen — retorna buffer base64 diretamente
        const gemini = new GeminiImageProvider({ apiKey: thumbnailMedia.apiKey!, model: imageModel })
        const result = await gemini.generate({
          prompt: thumb.imagePrompt,
          width: dims.width,
          height: dims.height,
          aspectRatio
        })
        if (!result.images.length) {
          console.warn(`[Thumbnails] ⚠️ [${index + 1}/4] Gemini retornou 0 imagens. Pulando.`)
          continue
        }
        imageBuffer = result.images[0]!.buffer
        if (result.costInfo) totalImageCost += result.costInfo.cost
      } else {
        // Replicate (Photon Flash, FLUX, etc.) — retorna URL que precisa ser baixada
        const replicateProvider = new ReplicateImageProvider({
          apiKey: thumbnailMedia.apiKey!,
          model: imageModel,
          inputSchema: thumbnailMedia.inputSchema ?? undefined
        })
        const result = await replicateProvider.generate({
          prompt: thumb.imagePrompt,
          width: dims.width,
          height: dims.height,
          aspectRatio
        })
        if (!result.images.length) {
          console.warn(`[Thumbnails] ⚠️ [${index + 1}/4] Replicate retornou 0 imagens. Pulando.`)
          continue
        }
        imageBuffer = result.images[0]!.buffer
        if (result.costInfo) totalImageCost += result.costInfo.cost
      }

      candidates.push({
        base64: imageBuffer.toString('base64'),
        prompt: thumb.imagePrompt,
        hookText: thumb.hookText
      })
      console.log(`[Thumbnails] ✅ [${index + 1}/4] Thumbnail gerada (${(imageBuffer.length / 1024).toFixed(0)}KB)`)

    } catch (error: any) {
      console.error(`[Thumbnails] ❌ [${index + 1}/4] Erro: ${error.message}`)
    }
  }

  if (candidates.length === 0) {
    throw createError({
      statusCode: 500,
      message: 'Nenhuma thumbnail foi gerada com sucesso. Tente novamente.'
    })
  }

  // ═══════════════════════════════════════════════════
  // PASSO 3: Salvar candidatas
  // ═══════════════════════════════════════════════════
  await prisma.thumbnailProduct.upsert({
    where: { outputId: id },
    create: {
      outputId: id,
      candidates: candidates as any,
      selectedData: null,
    },
    update: {
      candidates: candidates as any,
      selectedData: null,
    },
  })

  // ═══════════════════════════════════════════════════
  // PASSO 4: Registrar custos (fire-and-forget)
  // ═══════════════════════════════════════════════════

  // 4a. Custo das imagens geradas (já acumulado durante a geração)
  if (totalImageCost > 0) {
    costLogService.log({
      outputId: id,
      resource: 'thumbnail',
      action: 'create',
      provider: imageProvider.toUpperCase(),
      model: imageModel,
      cost: totalImageCost,
      metadata: { num_images: candidates.length, cost_per_image: totalImageCost / candidates.length, step: 'image_generation' },
      detail: `${candidates.length} thumbnails via ${imageProvider}/${imageModel}`
    }).catch(() => { })
  }

  // 4b. Custo da LLM que gerou os prompts
  const llmUsage = llmResponse.usage_metadata
  if (llmUsage) {
    const llmInputTokens = llmUsage.input_tokens
    const llmOutputTokens = llmUsage.output_tokens
    const llmCost = calculateLLMCost(thumbnailPromptModel, llmInputTokens, llmOutputTokens)

    costLogService.log({
      outputId: id,
      resource: 'thumbnail',
      action: 'create',
      provider: thumbnailAssignment.provider.toUpperCase(),
      model: thumbnailPromptModel,
      cost: llmCost,
      metadata: { input_tokens: llmInputTokens, output_tokens: llmOutputTokens, total_tokens: llmInputTokens + llmOutputTokens, step: 'prompt_generation' },
      detail: `Prompt generation via ${thumbnailAssignment.provider}/${thumbnailPromptModel}`
    }).catch(() => { })
  }

  return {
    success: true,
    count: candidates.length,
    provider: imageProvider,
    model: imageModel,
    hooks: candidates.map(c => c.hookText),
    message: `${candidates.length} thumbnails geradas via ${imageProvider}/${imageModel} com hook text integrado.`
  }
})

// =============================================================================
// UTILS
// =============================================================================

/** Mapeia aspect ratio para formato aceito pelos modelos de imagem */
function mapAspectRatio(aspectRatio: string): string {
  const mapping: Record<string, string> = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:3': '4:3',
    '3:4': '3:4',
    '21:9': '21:9',
    '9:21': '9:21'
  }
  return mapping[aspectRatio] || '16:9'
}
