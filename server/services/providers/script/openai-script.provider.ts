import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import {
  SystemMessage,
  HumanMessage,
  BaseMessage
} from '@langchain/core/messages'
import type {
  IScriptGenerator,
  ProviderCostInfo,
  ScriptGenerationRequest,
  ScriptGenerationResponse,
  ScriptScene
} from '../../../types/ai-providers'
import { calculateLLMCost } from '../../../constants/pricing'
import { buildVisualInstructionsForScript } from '../../../utils/wan-prompt-builder'
import { formatPersonsForPrompt, formatNeuralInsightsForPrompt } from '../../../utils/format-intelligence-context'

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
  volume: z.number().describe('Volume em dB para mixagem com narração (-24 a -6). Prefira -12 a -10 para fundo claramente audível; -18 fica baixo demais. Ex.: -12 médio, -10 mais presente, -6 alto.'),
  startScene: z.number().describe('Número da cena onde esta track começa (0 = primeira cena)'),
  endScene: z.number().nullable().describe('Número da última cena desta track (null = até a última cena do vídeo)')
})

const BackgroundMusicSchema = z.object({
  prompt: z.string().describe('Prompt para geração de música no formato Stable Audio. Inclua gênero, instrumentos, BPM, mood e estilo. Exemplo: "Ambient, Drone, Dark Strings, Subtle Pads, Mysterious, Cinematic, Atmospheric, well-arranged composition, 80 BPM"'),
  volume: z.number().describe('Volume em dB para mixagem com narração (-24 a -6). Prefira -12 a -10 para fundo claramente audível; -18 fica baixo demais. Ex.: -12 médio, -10 mais presente, -6 alto.')
})

const ScriptResponseSchema = z.object({
  title: z.string().describe('Título impactante para o vídeo'),
  summary: z.string().describe('Sinopse intrigante de 2-3 parágrafos'),
  scenes: z.array(ScriptSceneSchema).describe('Lista de cenas que compõem o vídeo'),
  backgroundMusic: BackgroundMusicSchema.nullable().describe('Música de fundo única para TODO o vídeo (use apenas para vídeos curtos TikTok/Instagram). Use null para vídeos longos. Regra: "video todo"'),
  backgroundMusicTracks: z.array(BackgroundMusicTrackSchema).nullable().describe('Lista de tracks de música de fundo por segmento de cenas (use apenas para vídeos longos YouTube Cinematic). Use null para vídeos curtos. Cada track define uma música com prompt, volume, startScene e endScene.')
})

type ScriptResponse = z.infer<typeof ScriptResponseSchema>

export class OpenAIScriptProvider implements IScriptGenerator {
  private model: ChatOpenAI
  private modelName: string

  constructor(config: { apiKey: string; model?: string; baseUrl?: string }) {
    this.modelName = config.model ?? 'gpt-4o'
    this.model = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: this.modelName,
      configuration: {
        baseURL: config.baseUrl ?? 'https://api.openai.com/v1'
      },
      temperature: 0.7,
      timeout: 120000, // 2 minutos de timeout para chamadas multimodais complexas
      maxRetries: 2
    })
  }

  getName(): string {
    return 'OPENAI'
  }

  async generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    console.log(`[OpenAI Script] 🎬 Iniciando geração de roteiro via LangChain (${this.modelName})...`)

    // Configurar o modelo para output estruturado (Zod) com includeRaw para capturar token usage
    const structuredLlm = this.model.withStructuredOutput(ScriptResponseSchema, { includeRaw: true })

    const systemPrompt = this.buildSystemPrompt(request)
    const userPrompt = this.buildUserPrompt(request)

    // Log para depuração
    console.log('--- [DEBUG] LANGCHAIN CONFIGURATION ---')
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

    // Injetar imagens se disponíveis (Vision Capability)
    if (request.images && request.images.length > 0) {
      console.log(`[OpenAI Script] 👁️ Injetando ${request.images.length} imagens no contexto multimodal...`)

      request.images.forEach((img, idx) => {
        let base64Data = ''

        try {
          if (Buffer.isBuffer(img.data)) {
            base64Data = img.data.toString('base64')
          } else if (typeof img.data === 'string') {
            base64Data = img.data
          } else if (typeof img.data === 'object') {
            // Tenta tratar como Buffer-like ou Uint8Array
            // Prisma pode retornar Uint8Array que não é intelisense Buffer
            // JSON serializado { type: 'Buffer', data: [...] } também cai aqui se passado no Buffer.from
            // JSON serializado { type: 'Buffer', data: [...] } também cai aqui se passado no Buffer.from
            if ((img.data as any).type === 'Buffer' && Array.isArray((img.data as any).data)) {
              base64Data = Buffer.from((img.data as any).data).toString('base64')
            } else {
              // Fallback genérico para Uint8Array ou Array-like object
              base64Data = Buffer.from(img.data as any).toString('base64')
            }
          }
        } catch (e) {
          console.warn(`[OpenAI Script] ⚠️ Falha ao converter imagem ${idx}. Erro: ${e}`)
        }

        if (!base64Data) {
          console.warn(`[OpenAI Script] ⚠️ Imagem ${idx} ignorada: falha na extração de dados. Tipo: ${typeof img.data}`)
          if (typeof img.data === 'object') {
            try {
              const preview = JSON.stringify(img.data).slice(0, 100)
              console.warn(`[OpenAI Script] 🔍 Preview do objeto de dados: ${preview}...`)
            } catch { }
          }
          return
        }

        // Remover prefixo data:image/...;base64, se já existir na string para evitar duplicação
        if (base64Data.includes('base64,')) {
          base64Data = base64Data.split('base64,')[1] || ''
        }

        const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        let mimeType = (img.mimeType || 'image/jpeg').toLowerCase()

        // Normalizar tipos comuns malformados
        if (mimeType === 'image/jpg') mimeType = 'image/jpeg'

        if (!validMimeTypes.includes(mimeType)) {
          console.warn(`[OpenAI Script] ⚠️ Imagem ${idx} ignorada: formato não suportado (${mimeType}). Permitidos: ${validMimeTypes.join(', ')}`)
          return
        }

        // console.log(`[OpenAI Script] Processando imagem ${idx}: ${mimeType}, Base64 Length: ${base64Data.length}`)

        humanContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`,
            detail: 'high'
          }
        })
      })
    }

    messages.push(new HumanMessage({ content: humanContent }))

    try {
      const startTime = Date.now()
      console.log('[OpenAI Script] 📤 Enviando request multimodal para LangChain...')
      console.log('[OpenAI Script] 🔍 Schema esperado: title, summary, scenes, backgroundMusic, backgroundMusicTracks')

      const result = await structuredLlm.invoke(messages)
      const content = result.parsed as ScriptResponse
      const rawMessage = result.raw as any

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[OpenAI Script] 📥 Resposta recebida e validada em ${elapsed}s`)

      // Extrair token usage real da resposta
      const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
      const inputTokens = usage?.input_tokens ?? 0
      const outputTokens = usage?.output_tokens ?? 0
      const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

      console.log(`[OpenAI Script] 📊 Token Usage REAL: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`)

      // Validação rápida de integridade
      console.log('[OpenAI Script] ✅ Roteiro gerado com sucesso!')
      console.log('[OpenAI Script] Título:', content.title)
      console.log('[OpenAI Script] Número de cenas:', content.scenes.length)
      console.log('[OpenAI Script] Background Music:', content.backgroundMusic ? 'Sim (video todo)' : 'Não')
      console.log('[OpenAI Script] Background Music Tracks:', content.backgroundMusicTracks?.length || 0, 'tracks')

      return this.parseResponse(content, request, { inputTokens, outputTokens, totalTokens })
    } catch (error) {
      console.error('[OpenAI Script] ❌ Erro na geração estruturada:', error)
      console.error('[OpenAI Script] 🔍 Error details:', JSON.stringify(error, null, 2))
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
    const wordsPerScene = Math.round((targetWPM / 60) * 5) // 150 WPM = 12-13 palavras por 5s
    const maxWordsHard = wordsPerScene + 2 // Hard limit: nunca exceder (15 palavras a 150 WPM)
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
- O "volume" é em dB para mixagem com narração (-24 a -6). Prefira -12 a -10 para a música ser claramente audível; -18 costuma ficar baixo demais.
- Exemplo de prompt: "Ambient, Dark Drone, Subtle Synthesizer Pads, Low Strings, Mysterious, Cinematic, Atmospheric, well-arranged composition, 80 BPM"
- NÃO inclua volume no prompt - o volume é um campo separado
- Exemplo completo: { prompt: "Ambient, Dark Drone, Subtle Pads, Mysterious, Cinematic, 80 BPM", volume: -12 }`
    } else if (isYouTubeCinematic) {
      musicInstructions = `
---
🎵 ESTRATÉGIA DE MÚSICA DE FUNDO (YouTube Cinematic):
- Use a lista "backgroundMusicTracks" para definir tracks por SEGMENTO DE CENAS
- Cada track tem: "prompt" (para Stable Audio 2.5), "volume" (dB), "startScene" e "endScene"
- "startScene" = número da cena onde a track começa (0 = primeira cena)
- "endScene" = número da última cena desta track (null = até a última cena do vídeo)
- O "prompt" será usado diretamente no modelo Stable Audio 2.5 para gerar cada track
- FORMATO DO PROMPT: Inclua gênero, sub-gênero, instrumentos específicos, BPM, mood e estilo
- O "volume" é em dB para mixagem com narração (-24 a -6). Prefira -12 a -10 para a música ser claramente audível; -18 costuma ficar baixo demais.
- NÃO faça uma track por cena. Agrupe cenas por SEGMENTOS NARRATIVOS:
  • HOOK: Cenas iniciais — música de abertura impactante
  • CONTEXT: Cenas de contextualização — transição suave
  • RISING ACTION: Corpo principal — intensidade crescente
  • CLIMAX: Pico narrativo — máxima intensidade emocional
  • RESOLUTION + CTA: Cenas finais — resolução e fechamento
- Cada segmento pode cobrir múltiplas cenas (a duração real será calculada automaticamente)
- Máximo de 38 cenas por track (190s / 5s por cena = limite do modelo Stable Audio)
- Use variações sutis da mesma base musical por segmento
- Exemplos de tracks (para um vídeo de 60 cenas):
  • { prompt: "Cinematic, Impact Drums, Brass Stabs, Tension, Attention-Grabbing, Epic, 120 BPM", volume: -12, startScene: 0, endScene: 2 }
  • { prompt: "Cinematic, Building Strings, Crescendo, Tension Build-Up, Suspenseful, 100 BPM", volume: -12, startScene: 3, endScene: 8 }
  • { prompt: "Cinematic, Full Orchestra, Emotional Peak, Dramatic, Powerful, Climactic, 130 BPM", volume: -10, startScene: 9, endScene: null }`
    }

    return `Você é um roteirista mestre em storytelling cinematográfico e retenção viral.

---
ESTILO NARRATIVO E PERSONA:
${styleInstructions}

---
📐 ARQUITETURA NARRATIVA PROPORCIONAL (OBRIGATÓRIO):
O roteiro DEVE seguir proporções rígidas entre seus atos. Isso é CRÍTICO para manter a retenção do início ao fim.

| FASE | PROPORÇÃO DO TOTAL | FUNÇÃO |
|------|-------|--------|
| 🎯 HOOK (Gancho) | ≤5% das cenas | Captura atenção. Mistério + Promessa. In media res. |
| 📜 CORPO FACTUAL (Investigação) | 55-65% das cenas | Fatos, cronologia, revelações, evidências. O CORAÇÃO do vídeo. |
| 🔗 PONTE TEMPORAL (se aplicável) | 10-15% das cenas | Conexão passado-presente, relevância contemporânea. |
| 💡 REFLEXÃO/LIÇÃO | ≤15% das cenas | Significado, implicação, questionamento. CONCISO e IMPACTANTE. |
| 📢 CTA (Encerramento) | ≤5% das cenas (máx 2-3 cenas) | Seguir canal + assinatura "The Gap Files". |

🚨 REGRA DE PROPORÇÃO MÁXIMA: A seção de REFLEXÃO/LIÇÃO (tudo depois do corpo factual e ponte temporal) NUNCA deve ultrapassar 20% do total de cenas. Se o vídeo tem 150 cenas, a reflexão deve ter NO MÁXIMO 30 cenas. Prefira 15-20%. Roteiros com reflexão longa demais causam QUEDA DE RETENÇÃO.

🚨 REGRA ANTI-REPETIÇÃO (CRÍTICO):
- PROIBIDO repetir a mesma ideia com variações. Se já disse "uma mentira de 500 anos", NÃO repita como "uma fake news medieval", "a mesma narrativa secular", etc.
- Cada cena deve avançar o argumento ou adicionar informação NOVA. Se não tem conteúdo novo, a cena não deveria existir.
- TÉCNICA: Use a regra "1 ideia = 1 cena". Se a ideia já foi expressa, avance para a próxima.
- A reflexão final deve ser CIRÚRGICA: poucos golpes precisos > muitas repetições diluídas.
- PREFERÍVEL: Uma reflexão de 5 cenas devastadoras a uma reflexão de 25 cenas repetitivas.

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
- DIRETRIZ VISUAL: As descrições visuais ('visualDescription') DEVEM SER SEMPRE EM INGLÊS e COMPLETAS: cada uma é o prompt final que será enviado diretamente ao modelo de imagem, sem etapa de merge. Incorpore estilo (base, iluminação, atmosfera, composição) em linguagem natural em cada cena. Seja VISUAL e CINEMATOGRÁFICO — descreva cenas com impacto máximo, texturas, atmosferas sombrias e composições dramáticas. Use linguagem artística intensa sem filtrar o tom.
- PERSONAGENS: Quando houver personagens recorrentes na narrativa, use SEMPRE os nomes (ou um descritor consistente, ex.: "the detective", "Maria") no visualDescription em todas as cenas em que aparecem. Isso reduz variação entre cenas e ajuda a manter coerência visual (ex.: "John standing by the window" em vez de "a man by the window").
- CONSISTÊNCIA VISUAL DE PERSONAGENS: Quando o dossiê fornecer visualDescription para personagens-chave, incorpore EXATAMENTE esses descritores visuais no visualDescription de cada cena onde o personagem aparece. Isso garante que o modelo de imagem mantenha a mesma aparência entre cenas.
- MULTIMODALIDADE: Se imagens forem fornecidas, analise-as para garantir consistência visual.
- CENAS DE ENCERRAMENTO (CTA — OBRIGATÓRIO): As últimas cenas do vídeo (segmento CTA do plano narrativo) DEVEM incluir: (1) uma frase de gatilho para o espectador seguir o canal — por exemplo convite para se inscrever, ativar o sininho ou acompanhar o canal, no tom do vídeo; (2) menção ao canal "The Gap Files" como assinatura de encerramento. A história narrativa deve estar COMPLETAMENTE encerrada antes do CTA — nunca corte uma frase no meio na última cena de conteúdo. Reserve as últimas 1-2 cenas exclusivamente para conclusão da frase/ideia e CTA.
${musicInstructions}

---
${visualInstructions}`
  }

  private buildUserPrompt(request: ScriptGenerationRequest): string {
    const targetWPM = request.targetWPM || 150
    const wordsPerScene = Math.round((targetWPM / 60) * 5) // 150 WPM = 12-13 palavras por 5s
    const minWords = wordsPerScene - 1
    const maxWords = wordsPerScene + 2 // Hard limit para não ultrapassar 5s
    const idealSceneCount = Math.ceil(request.targetDuration / 5)
    const maxExtraScenes = 4 // margem para concluir a história e CTA sem cortar frase
    const maxSceneCount = idealSceneCount + maxExtraScenes

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
- Use a lista "backgroundMusicTracks" com tracks { prompt, volume, startScene, endScene }
- Cada track referencia CENAS (não timestamps). A duração real será calculada automaticamente.
- Agrupe cenas por segmentos narrativos (HOOK, CONTEXT, RISING ACTION, CLIMAX, RESOLUTION, CTA)
- Música pode variar por segmento narrativo, mas NÃO faça uma track por cena`
    }

    let baseInstruction = `Crie um roteiro em ${request.language} sobre o tema: "${request.theme}"${formatContext}`

    if (request.dossierCategory) {
      baseInstruction += `\n\n🏷️ CLASSIFICAÇÃO TEMÁTICA: ${request.dossierCategory.toUpperCase()}`
      if (request.musicGuidance) {
        baseInstruction += `\n🎵 ORIENTAÇÃO MUSICAL PARA ESTA CLASSIFICAÇÃO: O prompt de música DEVE seguir esta direção: "${request.musicGuidance}"`
        baseInstruction += `\n💓 ATMOSFERA EMOCIONAL DA TRILHA: ${request.musicMood}`
        baseInstruction += `\nUse esta orientação como BASE para os prompts de backgroundMusic/backgroundMusicTracks. Adapte conforme o tom do roteiro, mas mantenha a essência da classificação.`
      }
      if (request.visualGuidance) {
        baseInstruction += `\n\n🖼️ ORIENTAÇÃO VISUAL (visualDescription): As descrições visuais de cada cena DEVEM seguir este tom e regras: ${request.visualGuidance}`
        baseInstruction += `\nAplique esta orientação em TODAS as cenas. O visualDescription deve ser pronto para geração de imagem e alinhado ao tema do vídeo.`
      }
    }

    // Fontes do dossiê (arquitetura flat/democratizada)
    const allSources = request.sources || request.additionalSources || []
    if (allSources.length > 0) {
      baseInstruction += `\n\n📚 FONTES DO DOSSIÊ (BASE NEURAL):`
      allSources.forEach((source, index) => {
        baseInstruction += `\n[📄 FONTE ${index + 1}] (${source.type}): ${source.title}\n${source.content}\n---`
      })
    }

    if (request.userNotes && request.userNotes.length > 0) {
      baseInstruction += `\n\n🧠 INSIGHTS E NOTAS DO AGENTE:\n${request.userNotes.join('\n- ')}`
    }

    // Persons & Neural Insights (Intelligence Center)
    const personsBlock = formatPersonsForPrompt(request.persons || [])
    if (personsBlock) {
      baseInstruction += `\n\n${personsBlock}`
    }
    const insightsBlock = formatNeuralInsightsForPrompt(request.neuralInsights || [])
    if (insightsBlock) {
      baseInstruction += `\n\n${insightsBlock}`
    }

    if (request.visualReferences && request.visualReferences.length > 0) {
      baseInstruction += `\n\n🖼️ REFERÊNCIAS VISUAIS EXISTENTES (DESCRITORES):\n${request.visualReferences.join('\n- ')}`
    }

    if (request.researchData) {
      baseInstruction += `\n\n📊 DADOS ESTATÍSTICOS/ESTRUTURADOS:\n${JSON.stringify(request.researchData, null, 2)}`
    }

    if (request.storyOutline) {
      baseInstruction += `\n\n${request.storyOutline}`
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
Use "backgroundMusic": { "prompt": "...", "volume": -12 } para definir UMA música para TODO o vídeo (prefira volume entre -12 e -10 para ficar audível).
O prompt deve seguir o formato Stable Audio 2.5: gênero, instrumentos, BPM, mood.
Defina "backgroundMusicTracks" como null.`
    } else if (isYouTubeCinematic) {
      musicWarning = `\n\n🚨 REGRA CRÍTICA DE MÚSICA DE FUNDO (YouTube Cinematic):
Use "backgroundMusicTracks" com lista de tracks { prompt, volume, startScene, endScene }.
"startScene" e "endScene" são NÚMEROS DE CENA (0-indexed), NÃO timestamps em segundos.
O prompt de cada track deve seguir o formato Stable Audio 2.5: gênero, instrumentos, BPM, mood.
Máximo de 38 cenas por track (limite do modelo). Defina "backgroundMusic" como null.`
    }

    const maxReflectionScenes = Math.max(3, Math.round(idealSceneCount * 0.15))
    const maxReflectionCeiling = Math.round(idealSceneCount * 0.20)

    return `${baseInstruction}

---
⚠️ REQUISITOS OBRIGATÓRIOS PARA APROVAÇÃO:
1. DURAÇÃO MÍNIMA: O vídeo deve ter pelo menos ${request.targetDuration} segundos (${idealSceneCount} cenas). Você PODE gerar até ${maxSceneCount} cenas (no máximo ${maxExtraScenes} cenas extras) para concluir a história e o CTA sem cortar frases.
2. QUANTIDADE DE CENAS: Gere entre ${idealSceneCount} e ${maxSceneCount} cenas. Use as cenas extras APENAS para: (a) terminar a última ideia/frase da história sem cortar no meio; (b) incluir o CTA completo (convite para seguir o canal + menção The Gap Files). Não extrapole além de ${maxSceneCount} cenas.
3. DURAÇÃO DA CENA: Cada cena tem slots fixos de 5 segundos.
4. CONTAGEM DE PALAVRAS: Cada narração DEVE ter entre ${minWords} e ${maxWords} palavras (${targetWPM} WPM ÷ 60 × 5s = ${wordsPerScene} palavras ideais). 🚨 NUNCA exceda ${maxWords} palavras - isso faz o áudio ultrapassar 5 segundos e quebra a sincronia. NUNCA faça cenas com menos de ${minWords} palavras - isso gera silêncio.
5. MÚSICA DE FUNDO: ${isShortFormat ? 'Use "backgroundMusic" { prompt, volume } para UMA música para TODO o vídeo. O prompt deve ser compatível com Stable Audio 2.5.' : 'Use "backgroundMusicTracks" com tracks { prompt, volume, startTime, endTime }. O prompt de cada track deve ser compatível com Stable Audio 2.5.'}
6. Se houver imagens anexas, use-as como referência visual primária.
7. 📐 PROPORÇÃO NARRATIVA: A seção de REFLEXÃO/LIÇÃO (após o corpo factual + ponte temporal) deve ter no MÁXIMO ${maxReflectionScenes} cenas (15% ideal, ${maxReflectionCeiling} cenas = teto absoluto de 20%). Invista as cenas no CORPO FACTUAL, não na reflexão.
8. 🚫 ANTI-REPETIÇÃO: Antes de finalizar, releia TODAS as cenas de reflexão. Se duas cenas expressam a mesma ideia com palavras diferentes, ELIMINE uma e redistribua o conteúdo para o corpo factual. Cada cena de reflexão deve trazer um ARGUMENTO ÚNICO e INÉDITO.
${guidelines}${musicWarning}

� VALIDAÇÃO FINAL OBRIGATÓRIA:
Antes de retornar o JSON, faça esta auditoria interna:
1. CONTE as cenas totais — deve estar entre ${idealSceneCount} e ${maxSceneCount}.
2. CONTE as cenas de reflexão/lição (após o corpo factual) — deve ser ≤${maxReflectionCeiling} cenas.
3. PROCURE repetições temáticas — se encontrar, ELIMINE e COMPACTE.
4. A última cena de conteúdo deve terminar com frase completa.
5. As últimas 1-2 cenas devem ser conclusão + CTA (seguir canal + The Gap Files).`
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

    const usage = tokenUsage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
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
      usage: tokenUsage,
      costInfo: {
        cost: calculateLLMCost(this.modelName, usage.inputTokens, usage.outputTokens),
        provider: this.getName(),
        model: this.modelName,
        metadata: {
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          total_tokens: usage.totalTokens
        }
      }
    }
  }
}
