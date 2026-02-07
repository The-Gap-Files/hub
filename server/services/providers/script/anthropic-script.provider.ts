import { z } from 'zod'
import { ChatAnthropic } from '@langchain/anthropic'
import {
  SystemMessage,
  HumanMessage,
  BaseMessage
} from '@langchain/core/messages'
import type {
  IScriptGenerator,
  ScriptGenerationRequest,
  ScriptGenerationResponse,
  ScriptScene
} from '../../../types/ai-providers'
import { buildVisualInstructionsForScript } from '../../../utils/wan-prompt-builder'

// Schema para validação estruturada do output (Garante JSON válido e tipos corretos)
const ScriptSceneSchema = z.object({
  order: z.number().describe('A ordem sequencial da cena'),
  narration: z.string().describe('O texto que será narrado pelo locutor'),
  visualDescription: z.string().describe('Descrição técnica e sensorial para o modelo de geração de vídeo (SEMPRE EM INGLÊS)'),
  audioDescription: z.string().nullable().describe('Atmosfera sonora e SFX em inglês técnico'),
  estimatedDuration: z.number().describe('Duração estimada em segundos (entre 5 e 6 segundos)')
})

const BackgroundMusicTrackSchema = z.object({
  prompt: z.string().describe('Prompt para geração de música no formato Stable Audio. Inclua gênero, instrumentos, BPM, mood e estilo. Exemplo: "Ambient, Drone, Dark Strings, Pulsing Heartbeat Rhythm, Tension Build-Up, Mysterious, Cinematic, Atmospheric, 80 BPM"'),
  volume: z.number().describe('Volume em dB para mixagem com narração. Use valores entre -24 e -6. Exemplo: -18 para volume baixo, -12 para médio, -6 para alto'),
  startTime: z.number().describe('Tempo de início em segundos (0 = início do vídeo)'),
  endTime: z.number().nullable().describe('Tempo de fim em segundos (null = até o final do vídeo)')
})

const BackgroundMusicSchema = z.object({
  prompt: z.string().describe('Prompt para geração de música no formato Stable Audio. Inclua gênero, instrumentos, BPM, mood e estilo. Exemplo: "Ambient, Drone, Dark Strings, Subtle Pads, Mysterious, Cinematic, Atmospheric, well-arranged composition, 80 BPM"'),
  volume: z.number().describe('Volume em dB para mixagem com narração. Use valores entre -24 e -6. Exemplo: -18 para volume baixo, -12 para médio, -6 para alto')
})

const ScriptResponseSchema = z.object({
  title: z.string().describe('Título impactante para o vídeo'),
  summary: z.string().describe('Sinopse intrigante de 2-3 parágrafos'),
  scenes: z.array(ScriptSceneSchema).describe('Lista de cenas que compõem o vídeo'),
  backgroundMusic: BackgroundMusicSchema.nullable().describe('Música de fundo única para TODO o vídeo (use apenas para vídeos curtos TikTok/Instagram). Use null para vídeos longos. Regra: "video todo"'),
  backgroundMusicTracks: z.array(BackgroundMusicTrackSchema).nullable().describe('Lista de tracks de música de fundo com timestamps (use apenas para vídeos longos YouTube Cinematic). Use null para vídeos curtos. Cada track define uma música com prompt, volume e timestamps.')
})

type ScriptResponse = z.infer<typeof ScriptResponseSchema>

export class AnthropicScriptProvider implements IScriptGenerator {
  private model: ChatAnthropic
  private modelName: string

  constructor(config: { apiKey: string; model?: string }) {
    this.modelName = config.model ?? 'claude-opus-4-6'
    this.model = new ChatAnthropic({
      anthropicApiKey: config.apiKey,
      modelName: this.modelName,
      temperature: 0.7,
      maxTokens: 16384, // Anthropic exige maxTokens explícito
      clientOptions: {
        timeout: 180000, // 3 minutos -- Opus é mais lento que GPT-4o
        maxRetries: 2
      }
    })
  }

  getName(): string {
    return 'ANTHROPIC'
  }

  async generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    console.log('[Anthropic Script] 🎬 Iniciando geração de roteiro via LangChain + Claude...')

    // Configurar o modelo para output estruturado (Zod) com includeRaw para capturar token usage
    const structuredLlm = this.model.withStructuredOutput(ScriptResponseSchema, { includeRaw: true })

    const systemPrompt = this.buildSystemPrompt(request)
    const userPrompt = this.buildUserPrompt(request)

    // Log para depuração
    console.log('--- [DEBUG] LANGCHAIN ANTHROPIC CONFIGURATION ---')
    console.log('Model:', this.modelName)
    console.log('Target Duration:', request.targetDuration, 'seconds')
    console.log('Target WPM:', request.targetWPM)
    console.log('Ideal Scene Count:', Math.ceil(request.targetDuration / 5))
    console.log('--- [DEBUG] LANGCHAIN SYSTEM PROMPT ---')
    console.log(systemPrompt)

    // Preparar mensagens (Suporte Multimodal)
    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt)
    ]

    // Construir conteúdo da mensagem do usuário (Texto + Imagens)
    const humanContent: any[] = [
      { type: 'text', text: userPrompt }
    ]

    // Injetar imagens se disponíveis (Claude Vision)
    if (request.images && request.images.length > 0) {
      console.log(`[Anthropic Script] 👁️ Injetando ${request.images.length} imagens no contexto multimodal...`)

      request.images.forEach((img, idx) => {
        let base64Data = ''

        try {
          if (Buffer.isBuffer(img.data)) {
            base64Data = img.data.toString('base64')
          } else if (typeof img.data === 'string') {
            base64Data = img.data
          } else if (typeof img.data === 'object') {
            if ((img.data as any).type === 'Buffer' && Array.isArray((img.data as any).data)) {
              base64Data = Buffer.from((img.data as any).data).toString('base64')
            } else {
              base64Data = Buffer.from(img.data as any).toString('base64')
            }
          }
        } catch (e) {
          console.warn(`[Anthropic Script] ⚠️ Falha ao converter imagem ${idx}. Erro: ${e}`)
        }

        if (!base64Data) {
          console.warn(`[Anthropic Script] ⚠️ Imagem ${idx} ignorada: falha na extração de dados. Tipo: ${typeof img.data}`)
          return
        }

        // Remover prefixo data:image/...;base64, se já existir
        if (base64Data.includes('base64,')) {
          base64Data = base64Data.split('base64,')[1] || ''
        }

        const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        let mimeType = (img.mimeType || 'image/jpeg').toLowerCase()
        if (mimeType === 'image/jpg') mimeType = 'image/jpeg'

        if (!validMimeTypes.includes(mimeType)) {
          console.warn(`[Anthropic Script] ⚠️ Imagem ${idx} ignorada: formato não suportado (${mimeType}).`)
          return
        }

        // Formato de imagem para Claude via LangChain (image_url com data URI)
        humanContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`
          }
        })
      })
    }

    messages.push(new HumanMessage({ content: humanContent }))

    try {
      const startTime = Date.now()
      console.log('[Anthropic Script] 📤 Enviando request multimodal para LangChain + Claude...')
      console.log('[Anthropic Script] 🔍 Schema esperado: title, summary, scenes, backgroundMusic, backgroundMusicTracks')

      const result = await structuredLlm.invoke(messages)
      const content = result.parsed as ScriptResponse
      const rawMessage = result.raw as any

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[Anthropic Script] 📥 Resposta recebida e validada em ${elapsed}s`)

      // Extrair token usage real da resposta
      const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
      const inputTokens = usage?.input_tokens ?? 0
      const outputTokens = usage?.output_tokens ?? 0
      const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

      console.log(`[Anthropic Script] 📊 Token Usage REAL: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)

      // Validação rápida de integridade
      console.log('[Anthropic Script] ✅ Roteiro gerado com sucesso!')
      console.log('[Anthropic Script] Título:', content.title)
      console.log('[Anthropic Script] Número de cenas:', content.scenes.length)
      console.log('[Anthropic Script] Background Music:', content.backgroundMusic ? 'Sim (video todo)' : 'Não')
      console.log('[Anthropic Script] Background Music Tracks:', content.backgroundMusicTracks?.length || 0, 'tracks')

      return this.parseResponse(content, request, { inputTokens, outputTokens, totalTokens })
    } catch (error) {
      console.error('[Anthropic Script] ❌ Erro na geração estruturada:', error)
      console.error('[Anthropic Script] 🔍 Error details:', JSON.stringify(error, null, 2))
      throw error
    }
  }

  private buildSystemPrompt(request: ScriptGenerationRequest): string {
    let styleInstructions = request.scriptStyleInstructions || 'Adote um tom documental sério e investigativo.'

    let visualInstructions = ''
    if (request.visualBaseStyle) {
      visualInstructions = buildVisualInstructionsForScript({
        baseStyle: request.visualBaseStyle,
        lightingTags: request.visualLightingTags || '',
        atmosphereTags: request.visualAtmosphereTags || '',
        compositionTags: request.visualCompositionTags || '',
        generalTags: request.visualGeneralTags
      })
    } else if (request.visualStyleDescription) {
      visualInstructions = `DIRETRIZ VISUAL OBRIGATÓRIA: ${request.visualStyleDescription}`
    } else {
      visualInstructions = buildVisualInstructionsForScript({
        baseStyle: 'Cinematic Mystery Documentary',
        lightingTags: 'Chiaroscuro, dramatic volumetric lighting, shadows dancing',
        atmosphereTags: 'Mysterious, moody, foggy, dense atmosphere',
        compositionTags: 'Cinematic wide shots, extreme close-ups on textures',
        generalTags: '4k, highly detailed, realistic textures, grainy film look'
      })
    }

    const targetWPM = request.targetWPM || 150
    const wordsPerScene = Math.round((targetWPM / 60) * 5)
    const maxWordsHard = wordsPerScene + 2
    const wordRange = `${wordsPerScene - 1}-${wordsPerScene + 1}`

    // Determinar formato do vídeo para instruções de música
    const videoFormat = request.format || request.outputType || 'full-youtube'
    const isShortFormat = videoFormat.includes('tiktok') || videoFormat.includes('reels') || videoFormat.includes('teaser')
    const isYouTubeCinematic = videoFormat.includes('youtube') || videoFormat.includes('full')

    let musicInstructions = ''
    if (isShortFormat) {
      musicInstructions = `
---
🎵 ESTRATÉGIA DE MÚSICA DE FUNDO (TikTok/Instagram):
- 🚨 REGRA: "video todo" - Use UMA música de fundo para TODO o vídeo do início ao fim
- Use o campo "backgroundMusic" com "prompt" e "volume"
- O "prompt" será usado diretamente no modelo Stable Audio 2.5 para gerar a música
- FORMATO DO PROMPT: Inclua gênero, sub-gênero, instrumentos específicos, BPM, mood e estilo
- O "volume" é em dB para mixagem com narração (-24 a -6). Use -18 para baixo, -12 para médio
- Exemplo de prompt: "Ambient, Dark Drone, Subtle Synthesizer Pads, Low Strings, Mysterious, Cinematic, Atmospheric, well-arranged composition, 80 BPM"
- NÃO inclua volume no prompt - o volume é um campo separado
- Exemplo completo: { prompt: "Ambient, Dark Drone, Subtle Pads, Mysterious, Cinematic, 80 BPM", volume: -18 }`
    } else if (isYouTubeCinematic) {
      musicInstructions = `
---
🎵 ESTRATÉGIA DE MÚSICA DE FUNDO (YouTube Cinematic):
- Use a lista "backgroundMusicTracks" para definir tracks com timestamps
- Cada track tem: "prompt" (para Stable Audio 2.5), "volume" (dB), "startTime" e "endTime"
- O "prompt" será usado diretamente no modelo Stable Audio 2.5 para gerar cada track
- FORMATO DO PROMPT: Inclua gênero, sub-gênero, instrumentos específicos, BPM, mood e estilo
- O "volume" é em dB para mixagem com narração (-24 a -6). Use -18 para baixo, -12 para médio
- NÃO mude música a cada 5 segundos (cada cena)
- Agrupe cenas por SEGMENTOS NARRATIVOS maiores (15-60s):
  • HOOK (0-15s): Música de abertura impactante
  • CONTEXT (15-45s): Transição suave, estabelecimento
  • RISING ACTION: Intensidade crescente progressiva
  • CLIMAX: Pico emocional máximo
  • RESOLUTION: Resolução e síntese
  • CTA: Fechamento apropriado
- Cada track deve ter duração máxima de 190 segundos (limite do modelo)
- Use variações sutis da mesma música base por segmento
- Exemplos de tracks:
  • { prompt: "Cinematic, Impact Drums, Brass Stabs, Tension, Attention-Grabbing, Epic, 120 BPM", volume: -14, startTime: 0, endTime: 15 }
  • { prompt: "Cinematic, Building Strings, Crescendo, Tension Build-Up, Suspenseful, 100 BPM", volume: -16, startTime: 15, endTime: 45 }
  • { prompt: "Cinematic, Full Orchestra, Emotional Peak, Dramatic, Powerful, Climactic, 130 BPM", volume: -12, startTime: 45, endTime: null }`
    }

    return `Você é um roteirista mestre em storytelling cinematográfico e retenção viral.

---
ESTILO NARRATIVO E PERSONA:
${styleInstructions}

---
DIRETRIZES TÉCNICAS (CRÍTICO):
- SINCRONIA: Cada cena DEVE durar EXATAMENTE 5 segundos de narração.
- DENSIDADE OBRIGATÓRIA: Com base na velocidade de fala (${targetWPM} WPM), cada cena DEVE conter entre ${wordsPerScene - 1} e ${maxWordsHard} palavras. A conta é: ${targetWPM} WPM ÷ 60 × 5s = ${wordsPerScene} palavras ideais.
- 🚨 HARD LIMIT: NUNCA exceda ${maxWordsHard} palavras por cena. Cenas com mais de ${maxWordsHard} palavras ultrapassam 5 segundos e quebram a sincronia do vídeo.
- PROIBIDO FRASES CURTAS: Cenas com menos de ${wordsPerScene - 1} palavras geram "buracos" no áudio. Expanda com adjetivos, detalhes sensoriais ou contexto.
- FLUIDEZ: O texto deve preencher exatamente 5 segundos de fala contínua. Nem mais, nem menos.
- SOUND DESIGN: Descreva a atmosfera sonora (SFX/Ambience) em inglês técnico para cada cena.
- MÚSICA DE FUNDO: Use "backgroundMusic" para vídeos curtos (TikTok/Instagram) ou "backgroundMusicTracks" para vídeos longos (YouTube). O campo "prompt" deve ser compatível com Stable Audio 2.5 (gênero, instrumentos, BPM, mood). O campo "volume" (dB) será aplicado via FFmpeg na mixagem.
- CAMADA SENSORIAL: Nas descrições visuais, inclua sentimentos, texturas e atmosfera.
- DIRETRIZ VISUAL: As descrições visuais ('visualDescription') DEVEM SER SEMPRE EM INGLÊS, independentemente do idioma da narração.
- MULTIMODALIDADE: Se imagens forem fornecidas, analise-as para garantir consistência visual.
${musicInstructions}

---
${visualInstructions}`
  }

  private buildUserPrompt(request: ScriptGenerationRequest): string {
    const targetWPM = request.targetWPM || 150
    const wordsPerScene = Math.round((targetWPM / 60) * 5)
    const minWords = wordsPerScene - 1
    const maxWords = wordsPerScene + 2
    const idealSceneCount = Math.ceil(request.targetDuration / 5)

    // Determinar formato do vídeo
    const videoFormat = request.format || request.outputType || 'full-youtube'
    const isShortFormat = videoFormat.includes('tiktok') || videoFormat.includes('reels') || videoFormat.includes('teaser')
    const isYouTubeCinematic = videoFormat.includes('youtube') || videoFormat.includes('full')

    let formatContext = ''
    if (isShortFormat) {
      formatContext = `\n\n📱 FORMATO DO VÍDEO: TikTok/Instagram (vídeo curto, 30-180s)
🚨 REGRA CRÍTICA DE MÚSICA DE FUNDO:
- Use o campo "backgroundMusic" com { prompt, volume } para definir UMA música para TODO o vídeo
- O "prompt" deve ser compatível com Stable Audio 2.5 (gênero, instrumentos, BPM, mood)
- O "volume" deve ser em dB (-24 a -6) para mixagem com narração`
    } else if (isYouTubeCinematic) {
      formatContext = `\n\n🎬 FORMATO DO VÍDEO: YouTube Cinematic (vídeo longo, 600-3600s)
- Use a lista "backgroundMusicTracks" com tracks { prompt, volume, startTime, endTime }
- Cada track tem duração máxima de 190 segundos (limite do modelo Stable Audio)
- Identifique segmentos narrativos (HOOK, CONTEXT, RISING ACTION, CLIMAX, RESOLUTION, CTA)
- Música pode variar por segmento narrativo, mas NÃO a cada 5 segundos`
    }

    let baseInstruction = `Crie um roteiro em ${request.language} sobre o tema: "${request.theme}"${formatContext}`

    if (request.sourceDocument) {
      baseInstruction += `\n\n📄 DOCUMENTO PRINCIPAL (BASE NEURAL):\n${request.sourceDocument}`
    }

    if (request.additionalSources && request.additionalSources.length > 0) {
      baseInstruction += `\n\n📚 FONTES SECUNDÁRIAS (VETORES DE INTELIGÊNCIA):`
      request.additionalSources.forEach((source, index) => {
        baseInstruction += `\n[FONTE ${index + 1}] (${source.type}): ${source.title}\n${source.content}\n---`
      })
    }

    if (request.userNotes && request.userNotes.length > 0) {
      baseInstruction += `\n\n🧠 INSIGHTS E NOTAS DO AGENTE:\n${request.userNotes.join('\n- ')}`
    }

    if (request.visualReferences && request.visualReferences.length > 0) {
      baseInstruction += `\n\n🖼️ REFERÊNCIAS VISUAIS EXISTENTES (DESCRITORES):\n${request.visualReferences.join('\n- ')}`
    }

    if (request.researchData) {
      baseInstruction += `\n\n📊 DADOS ESTATÍSTICOS/ESTRUTURADOS:\n${JSON.stringify(request.researchData, null, 2)}`
    }

    if (request.additionalContext) {
      baseInstruction += `\n\n➕ CONTEXTO ADICIONAL:\n${request.additionalContext}`
    }

    let guidelines = ''
    if (request.mustInclude) guidelines += `\n- DEVE INCLUIR: ${request.mustInclude}`
    if (request.mustExclude) guidelines += `\n- NÃO PODE CONTER: ${request.mustExclude}`

    let musicWarning = ''
    if (isShortFormat) {
      musicWarning = `\n\n🚨 REGRA CRÍTICA DE MÚSICA DE FUNDO (TikTok/Instagram):
Use "backgroundMusic": { "prompt": "...", "volume": -18 } para definir UMA música para TODO o vídeo.
O prompt deve seguir o formato Stable Audio 2.5: gênero, instrumentos, BPM, mood.
Defina "backgroundMusicTracks" como null.`
    } else if (isYouTubeCinematic) {
      musicWarning = `\n\n🚨 REGRA CRÍTICA DE MÚSICA DE FUNDO (YouTube Cinematic):
Use "backgroundMusicTracks" com lista de tracks { prompt, volume, startTime, endTime }.
O prompt de cada track deve seguir o formato Stable Audio 2.5: gênero, instrumentos, BPM, mood.
Cada track tem duração máxima de 190s. Defina "backgroundMusic" como null.`
    }

    return `${baseInstruction}

---
⚠️ REQUISITOS OBRIGATÓRIOS PARA APROVAÇÃO:
1. DURAÇÃO TOTAL DO VÍDEO: O vídeo DEVE ter EXATAMENTE ${request.targetDuration} segundos de duração total.
2. QUANTIDADE DE CENAS: Gere EXATAMENTE ${idealSceneCount} cenas (${request.targetDuration}s ÷ 5s por cena = ${idealSceneCount} cenas).
3. DURAÇÃO DA CENA: Cada cena tem slots fixos de 5 segundos.
4. CONTAGEM DE PALAVRAS: Cada narração DEVE ter entre ${minWords} e ${maxWords} palavras (${targetWPM} WPM ÷ 60 × 5s = ${wordsPerScene} palavras ideais). 🚨 NUNCA exceda ${maxWords} palavras - isso faz o áudio ultrapassar 5 segundos e quebra a sincronia. NUNCA faça cenas com menos de ${minWords} palavras - isso gera silêncio.
5. MÚSICA DE FUNDO: ${isShortFormat ? 'Use "backgroundMusic" { prompt, volume } para UMA música para TODO o vídeo. O prompt deve ser compatível com Stable Audio 2.5.' : 'Use "backgroundMusicTracks" com tracks { prompt, volume, startTime, endTime }. O prompt de cada track deve ser compatível com Stable Audio 2.5.'}
6. Se houver imagens anexas, use-as como referência visual primária.
${guidelines}${musicWarning}

🚨 CRÍTICO: O vídeo final PRECISA ter ${request.targetDuration} segundos. Não gere menos cenas do que ${idealSceneCount}. Se necessário, divida o conteúdo em mais cenas para atingir a duração exata.`
  }

  private parseResponse(
    content: ScriptResponse,
    request: ScriptGenerationRequest,
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  ): ScriptGenerationResponse {
    const scenes: ScriptScene[] = content.scenes.map((scene, index) => ({
      order: scene.order ?? index + 1,
      narration: scene.narration,
      visualDescription: scene.visualDescription,
      audioDescription: scene.audioDescription ?? undefined,
      estimatedDuration: scene.estimatedDuration ?? 5
    }))

    const fullText = scenes.map(s => s.narration).join('\n\n')
    const wordCount = fullText.split(/\s+/).length
    const estimatedDuration = scenes.reduce((acc, s) => acc + s.estimatedDuration, 0)

    return {
      title: content.title,
      summary: content.summary,
      fullText,
      scenes,
      backgroundMusic: content.backgroundMusic ?? undefined,
      backgroundMusicTracks: content.backgroundMusicTracks ?? undefined,
      wordCount,
      estimatedDuration,
      provider: this.getName(),
      model: this.modelName,
      usage: tokenUsage
    }
  }
}
