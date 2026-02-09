/**
 * Gera o "Social Media Kit" para o output:
 * - Títulos otimizados por plataforma
 * - Descrições otimizadas (YouTube, TikTok, Shorts, Instagram)
 * - Hashtags relevantes
 * - SEO tags
 * 
 * Usa Claude Haiku (barato e rápido).
 */

import { prisma } from '../../../utils/prisma'
import { costLogService } from '../../../services/cost-log.service'
import { ChatAnthropic } from '@langchain/anthropic'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'

const SOCIAL_KIT_MODEL = process.env.ANTHROPIC_MODEL_THUMBNAIL || 'claude-3-5-haiku-20241022'

interface PlatformContent {
  title: string
  description: string
  hashtags: string[]
}

interface SocialKit {
  youtube: PlatformContent
  youtubeShorts: PlatformContent
  tiktok: PlatformContent
  instagram: PlatformContent
  seoTags: string[]
  generatedAt: string
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const output = await prisma.output.findUnique({
    where: { id },
    include: {
      script: true,
      scenes: {
        orderBy: { order: 'asc' },
        select: { order: true, narration: true }
      },
      dossier: { select: { theme: true, title: true } }
    }
  })

  if (!output) throw createError({ statusCode: 404, message: 'Output não encontrado' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, message: 'ANTHROPIC_API_KEY não configurada' })

  // Contexto do vídeo
  const title = output.title || (output.dossier as any)?.theme || 'Vídeo'
  const summary = output.script?.summary || ''
  const dossierTheme = (output.dossier as any)?.theme || ''
  const narrations = output.scenes
    .slice(0, 10)
    .map((s, i) => `${i + 1}. ${s.narration?.slice(0, 150)}`)
    .join('\n')

  const systemPrompt = `Você é um especialista em social media para canais de mistério, true crime e conspirações.
Seu trabalho é criar conteúdo otimizado para cada plataforma que maximize engajamento, alcance e CTR.

REGRAS GERAIS:
- Escreva TUDO em PORTUGUÊS BRASILEIRO
- Títulos devem gerar CURIOSIDADE e URGÊNCIA
- Descrições devem ser otimizadas para o algoritmo de cada plataforma
- Hashtags devem misturar tags populares + tags de nicho
- Use emojis estrategicamente (mas sem exagero)
- Tom: misterioso, intrigante, provocativo

REGRAS POR PLATAFORMA:

YOUTUBE (vídeo longo):
- Título: 50-70 caracteres, clickbait inteligente, sem revelar o final
- Descrição: Estruturada com parágrafos, timestamps fictícios, call-to-action
- Máximo 15 hashtags (mistura de broad + nicho)
- Inclua frases como "Inscreva-se e ative o sininho 🔔"

YOUTUBE SHORTS:
- Título: 40-60 caracteres, mais direto e impactante
- Descrição: Curta (2-3 linhas), com CTA para vídeo completo
- 5-8 hashtags focadas em Shorts (#Shorts obrigatório)

TIKTOK:
- Título: Não existe título separado, mas inclua um "caption" (título + descrição misturados)
- Descrição: Tom casual, conversa direta com o viewer, use "👀", "🤯", "😱"
- 5-10 hashtags trending + nicho (#fyp #foryou obrigatório)
- Inclua CTA: "Segue pra mais!" ou "Comenta o que achou"

INSTAGRAM (Reels):
- Título: Caption com gancho forte na primeira linha (antes do "ver mais")
- Descrição: Storytelling compacto, quebra de linhas, emojis estratégicos
- 20-30 hashtags (mistura de 1M+ posts com tags menores)
- Inclua CTA: "Salva pra assistir depois 🔖" ou "Marca alguém que precisa ver"

SEO TAGS:
- 10-15 keywords relevantes para o conteúdo (em português, lowercase, sem #)`

  const userPrompt = `Gere o Social Media Kit completo para este vídeo:

TÍTULO ORIGINAL: ${title}
RESUMO: ${summary}
DESCRIÇÃO DO DOSSIÊ: ${dossierTheme}
PLATAFORMA PRINCIPAL: ${output.platform || 'YouTube'}

NARRATIVA (primeiros trechos):
${narrations || '(sem narração disponível)'}

Retorne APENAS um JSON válido com esta estrutura (sem markdown, sem \`\`\`):
{
  "youtube": {
    "title": "...",
    "description": "...",
    "hashtags": ["#tag1", "#tag2"]
  },
  "youtubeShorts": {
    "title": "...",
    "description": "...",
    "hashtags": ["#Shorts", "#tag1"]
  },
  "tiktok": {
    "title": "...",
    "description": "...",
    "hashtags": ["#fyp", "#foryou", "#tag1"]
  },
  "instagram": {
    "title": "...",
    "description": "...",
    "hashtags": ["#tag1", "#tag2"]
  },
  "seoTags": ["keyword1", "keyword2"]
}`

  const model = new ChatAnthropic({
    anthropicApiKey: apiKey,
    modelName: SOCIAL_KIT_MODEL,
    temperature: 0.8,
    maxTokens: 3000
  })

  console.log(`[SocialKit] 📱 Gerando kit de publicação via ${SOCIAL_KIT_MODEL}...`)

  const llmResponse = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ])

  const responseText = typeof llmResponse.content === 'string'
    ? llmResponse.content
    : (llmResponse.content as Array<{ type: string; text?: string }>)?.find(c => c.type === 'text')?.text || ''

  let socialKit: SocialKit
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')
    if (!parsed.youtube) throw new Error('Estrutura inválida')
    socialKit = {
      ...parsed,
      generatedAt: new Date().toISOString()
    }
  } catch {
    console.error('[SocialKit] ❌ Falha no parse. Response:', responseText.slice(0, 500))
    throw createError({
      statusCode: 500,
      message: 'Erro ao processar resposta da LLM. Tente novamente.'
    })
  }

  // Salvar no banco
  await prisma.output.update({
    where: { id },
    data: { socialKit: socialKit as any }
  })

  // Registrar custo (fire-and-forget)
  const llmUsage = llmResponse.usage_metadata
  if (llmUsage) {
    const { calculateLLMCost } = await import('../../../constants/pricing')
    const cost = calculateLLMCost(SOCIAL_KIT_MODEL, llmUsage.input_tokens, llmUsage.output_tokens)
    costLogService.log({
      outputId: id,
      resource: 'script',
      action: 'create',
      provider: 'ANTHROPIC',
      model: SOCIAL_KIT_MODEL,
      cost,
      metadata: {
        input_tokens: llmUsage.input_tokens,
        output_tokens: llmUsage.output_tokens,
        step: 'social_kit'
      },
      detail: 'Social Media Kit generation'
    }).catch(() => { })
  }

  console.log(`[SocialKit] ✅ Kit gerado com sucesso para ${Object.keys(socialKit).filter(k => k !== 'generatedAt' && k !== 'seoTags').length} plataformas`)

  return {
    success: true,
    socialKit
  }
})
