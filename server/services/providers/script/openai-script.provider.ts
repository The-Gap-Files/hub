/**
 * Implementação do gerador de scripts usando OpenAI
 * 
 * Este provedor usa a API da OpenAI (GPT-4) para gerar roteiros
 * segmentados em cenas para vídeos de história/conspiração.
 */

import type {
  IScriptGenerator,
  ScriptGenerationRequest,
  ScriptGenerationResponse,
  ScriptScene
} from '../../../types/ai-providers'
import { buildVisualInstructionsForScript } from '../../../utils/wan-prompt-builder'

export class OpenAIScriptProvider implements IScriptGenerator {
  private apiKey: string
  private model: string
  private baseUrl: string

  constructor(config: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey
    this.model = config.model ?? 'gpt-4o'
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1'
  }

  getName(): string {
    return 'openai'
  }

  async generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    console.log('[OpenAI Script] 🎬 Iniciando geração de roteiro...')
    console.log('[OpenAI Script] Tema:', request.theme)
    console.log('[OpenAI Script] Modelo:', this.model)

    const systemPrompt = this.buildSystemPrompt(request)
    const userPrompt = this.buildUserPrompt(request)

    // Log dos prompts para conferência técnica (conforme solicitado pelo usuário)
    console.log('--- [DEBUG] OPENAI SYSTEM PROMPT START ---')
    console.log(systemPrompt)
    console.log('--- [DEBUG] OPENAI SYSTEM PROMPT END ---')
    console.log('--- [DEBUG] OPENAI USER PROMPT START ---')
    console.log(userPrompt)
    console.log('--- [DEBUG] OPENAI USER PROMPT END ---')

    console.log('[OpenAI Script] 📤 Enviando request para OpenAI API...')
    const startTime = Date.now()

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[OpenAI Script] 📥 Resposta recebida em ${elapsed}s`)

    if (!response.ok) {
      const error = await response.text()
      console.error('[OpenAI Script] ❌ Erro na API:', response.status, error)
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    console.log('[OpenAI Script] 🔍 Processando JSON retornado...')
    const data = await response.json()
    const content = JSON.parse(data.choices[0].message.content)

    console.log('[OpenAI Script] ✅ Roteiro gerado com sucesso!')
    console.log('[OpenAI Script] Título:', content.title)
    console.log('[OpenAI Script] Número de cenas:', content.scenes?.length || 0)

    // Validação pós-geração
    const expectedScenes = Math.ceil(request.targetDuration / 5)
    const actualScenes = content.scenes?.length || 0
    const expectedDuration = expectedScenes * 5
    const actualDuration = actualScenes * 5

    if (actualScenes !== expectedScenes) {
      console.warn(`[OpenAI Script] ⚠️ AVISO: Número de cenas incorreto!`)
      console.warn(`[OpenAI Script]    Esperado: ${expectedScenes} cenas`)
      console.warn(`[OpenAI Script]    Recebido: ${actualScenes} cenas`)
      console.warn(`[OpenAI Script]    Diferença: ${actualScenes - expectedScenes} cenas`)
    }

    if (actualDuration !== request.targetDuration) {
      console.warn(`[OpenAI Script] ⚠️ AVISO: Duração total incorreta!`)
      console.warn(`[OpenAI Script]    Esperado: ${request.targetDuration}s`)
      console.warn(`[OpenAI Script]    Recebido: ${actualDuration}s`)
      console.warn(`[OpenAI Script]    Diferença: ${actualDuration - request.targetDuration}s`)
    }

    return this.parseResponse(content)
  }

  private buildSystemPrompt(request: ScriptGenerationRequest): string {
    // 1. Instruções do Estilo de Roteiro (Vindas do Banco de Dados)
    let styleInstructions = ''
    if (request.scriptStyleInstructions) {
      styleInstructions = request.scriptStyleInstructions
    } else {
      styleInstructions = 'Adote um tom documental sério e investigativo.'
    }

    // 2. Construir instruções visuais (Sempre estruturadas)
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

    // 3. Calcular restrições de tempo/palavras
    const targetWPM = request.targetWPM || 150
    const wordsPerScene = Math.round((targetWPM / 60) * 5)
    const minWords = Math.max(8, wordsPerScene - 2)
    const maxWords = wordsPerScene + 2
    const wordRange = `${minWords}-${maxWords}`

    // 4. Montar Prompt Final
    return `Você é um roteirista mestre em storytelling cinematográfico e retenção viral.

---
ESTILO NARRATIVO E PERSONA:
${styleInstructions}

---
DIRETRIZES TÉCNICAS:
- SINCRONIA: Narrações rítmicas de ${wordRange} palavras por cena para caberem em 5 segundos.
- SOUND DESIGN: Descreva a atmosfera sonora (SFX/Ambience) em inglês técnico para cada cena.
- CAMADA SENSORIAL: Nas descrições visuais, inclua sentimentos, texturas e atmosfera (ex: "frio úmido", "cheiro de ozônio").

---
${visualInstructions}

---
FORMATO DE SAÍDA (JSON OBRIGATÓRIO):
Retorne SEMPRE um JSON válido com esta estrutura:
{
  "title": "Título Impactante",
  "summary": "Sinopse expandida (2-3 parágrafos) que contextualize a história de forma intrigante.",
  "scenes": [
    {
      "order": 1,
      "narration": "Texto da narração (${wordRange} palavras).",
      "visualDescription": "Prompt técnico + sensorial detalhado para geração de imagem.",
      "audioDescription": "SFX/Atmosfera sonora em inglês.",
      "estimatedDuration": 5
    }
  ]
}

REGRAS FINAIS:
- A narração deve soar natural e envolvente, seguindo a identidade definida acima.
- O campo visualDescription deve ser rico e detalhado para modelos de IA de ponta.`
  }

  private buildUserPrompt(request: ScriptGenerationRequest): string {
    // Calcular restrições de tempo/palavras
    const targetWPM = request.targetWPM || 150
    const wordsPerScene = Math.round((targetWPM / 60) * 5)
    const minWords = Math.max(8, wordsPerScene - 2)
    const maxWords = wordsPerScene + 2
    const wordRange = `${minWords}-${maxWords}`

    const durationMinutes = Math.round(request.targetDuration / 60)
    const durationText = request.targetDuration >= 60
      ? `${durationMinutes} minutos (${request.targetDuration} segundos)`
      : `${request.targetDuration} segundos`

    // Calcular número ideal de cenas baseado em blocos de 5 segundos (duração do motion)
    const idealSceneCount = Math.ceil(request.targetDuration / 5)

    // Construir diretrizes
    let guidelines = ''
    if (request.mustInclude) {
      guidelines += `\n\n[DIRETRIZ CRÍTICA - DEVE INCLUIR]:\n${request.mustInclude}`
    }
    if (request.mustExclude) {
      guidelines += `\n\n[DIRETRIZ CRÍTICA - NÃO PODE CONTER]:\n${request.mustExclude}`
    }

    // Construir instrução base
    let baseInstruction = `Crie um roteiro em ${request.language} sobre o tema: "${request.theme}"`

    // Se houver documento fonte, adicionar instrução específica
    if (request.additionalContext) {
      baseInstruction += `\n\n📄 DOCUMENTO FONTE (use como base para o roteiro):\n${request.additionalContext}\n\nIMPORTANTE: Use o conteúdo acima como base principal. Extraia os pontos-chave, fatos e narrativa deste documento para criar o roteiro. NÃO invente informações que não estejam no documento.`
    }

    return `${baseInstruction}

⚠️ ATENÇÃO: VOCÊ DEVE GERAR EXATAMENTE ${idealSceneCount} CENAS. NÃO MENOS, NÃO MAIS. ⚠️

Requisitos CRÍTICOS de Duração e Ritmo:
- O roteiro DEVE ter uma duração total o mais próxima possível de: ${durationText}.
- NÚMERO DE CENAS OBRIGATÓRIO: ${idealSceneCount} cenas (${request.targetDuration} segundos ÷ 5 segundos por cena = ${idealSceneCount} cenas)
- Cada cena deve ter uma narração curta de EXATAMENTE ${wordRange} palavras (para durar 5 segundos).
- É VITAL que a narração de cada cena não ultrapasse esse limite de ${maxWords} palavras.
- NÃO gere roteiros significativamente mais curtos ou mais longos que o solicitado.
- Se o tempo for curto (ex: 60s), seja extremamente direto e impactante.
- Se o tempo for longo (${request.targetDuration}s), aprofunde-se nos detalhes, evidências e ramificações do tema.
- Cada cena deve ter uma descrição visual cinematográfica única.
- O tom deve ser ${request.style ?? 'documentary'}.
${guidelines}

🔴 VALIDAÇÃO FINAL OBRIGATÓRIA:
Antes de retornar o JSON, CONTE quantas cenas você gerou no array "scenes".
Se o número for DIFERENTE de ${idealSceneCount}, você DEVE adicionar ou remover cenas até ter EXATAMENTE ${idealSceneCount} cenas.
NÚMERO EXATO DE CENAS ESPERADO: ${idealSceneCount}
`
  }

  private parseResponse(content: {
    title: string
    summary: string
    scenes: Array<{
      order: number
      narration: string
      visualDescription: string
      audioDescription?: string
      estimatedDuration: number
    }>
  }): ScriptGenerationResponse {
    const scenes: ScriptScene[] = content.scenes.map((scene, index) => ({
      order: scene.order ?? index + 1,
      narration: scene.narration,
      visualDescription: scene.visualDescription,
      audioDescription: scene.audioDescription,
      estimatedDuration: scene.estimatedDuration ?? 5
    }))

    const fullText = scenes.map(s => s.narration).join('\n\n')
    const wordCount = fullText.split(/\s+/).length
    const estimatedDuration = scenes.reduce((acc, s) => acc + s.estimatedDuration, 0)

    return {
      title: content.title,
      summary: content.summary || '',
      fullText,
      scenes,
      wordCount,
      estimatedDuration,
      provider: this.getName(),
      model: this.model
    }
  }
}