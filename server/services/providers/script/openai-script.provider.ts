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
    const systemPrompt = this.buildSystemPrompt(request)
    const userPrompt = this.buildUserPrompt(request)

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

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = JSON.parse(data.choices[0].message.content)

    return this.parseResponse(content)
  }

  private buildSystemPrompt(request: ScriptGenerationRequest): string {
    // Construir prompt de estilo de roteiro usando descrição + instruções
    let scriptStylePrompt = ''
    if (request.scriptStyleDescription && request.scriptStyleInstructions) {
      scriptStylePrompt = `${request.scriptStyleDescription}\n${request.scriptStyleInstructions}`
    } else if (request.scriptStyleInstructions) {
      scriptStylePrompt = request.scriptStyleInstructions
    } else {
      scriptStylePrompt = 'Adote um tom documental sério e investigativo.'
    }

    // Construir instruções visuais (Sempre estruturadas)
    let visualInstructions = ''

    if (request.visualBaseStyle) {
      // Se vier do banco estruturado, usa o que o usuário escolheu
      visualInstructions = buildVisualInstructionsForScript({
        baseStyle: request.visualBaseStyle,
        lightingTags: request.visualLightingTags || '',
        atmosphereTags: request.visualAtmosphereTags || '',
        compositionTags: request.visualCompositionTags || '',
        generalTags: request.visualGeneralTags
      })
    } else if (request.visualStyleDescription) {
      // Fallback para descrição antiga (string única)
      visualInstructions = `DIRETRIZ VISUAL OBRIGATÓRIA: ${request.visualStyleDescription}`
    } else {
      // FALLBACK TOTAL: Se não tiver nada, usa o padrão cinematográfico do canal
      visualInstructions = buildVisualInstructionsForScript({
        baseStyle: 'Cinematic Mystery Documentary',
        lightingTags: 'Chiaroscuro, dramatic volumetric lighting, shadows dancing',
        atmosphereTags: 'Mysterious, moody, foggy, dense atmosphere',
        compositionTags: 'Cinematic wide shots, extreme close-ups on textures',
        generalTags: '4k, highly detailed, realistic textures, grainy film look'
      })
    }

    // Definir intervalo de palavras baseado no pedido ou padrão (13 palavras ~ 5s)
    const targetWords = request.wordsPerScene || 13
    const minWords = Math.max(8, targetWords - 2)
    const maxWords = targetWords + 2
    const wordRange = `${minWords}-${maxWords}`

    return `Você é o roteirista principal do "The Gap Files" (A Lacuna), um mestre em storytelling cinematográfico e retenção viral. Seu objetivo é criar narrativas que evocam a sensação de "acesso a um arquivo secreto".

FÓRMULA DE RETENÇÃO "GAP GLITCH":
1. O GANCHO CRÍTICO (0-3s): Você tem apenas 3 segundos para parar o scroll. Comece "in media res" ou com uma contradição chocante. Use: Mistério (Feature) → Verdade Oculta (Benefit) → Exclusividade (Outcome).
2. PATTERN INTERRUPT: Cada cena de 5 segundos deve ser um choque visual/narrativo diferente da anterior. Mantenha o espectador em desequilíbrio informativo.
3. MICRO-HOOKS: Termine frases ou cenas com perguntas implícitas. Nunca entregue a verdade completa até o clímax.
4. SINCRONIA DE 5 SEGUNDOS: Narrações rítmicas de ${wordRange} palavras para caberem perfeitamente nos clipes.

DIRETRIZES VISUAIS & SENSORIAIS:
Além da técnica, inclua a "Camada Sensorial" nas suas descrições visuais:
- Descreva não apenas o que se vê, mas o sentimento, texturas, cheiros ou temperatura da cena (ex: "o frio úmido de uma tumba", "o cheiro de ozônio de uma máquina antiga").
- Mantenha o formato: [ESTILO BASE], [CENA COM AÇÃO SENSORIAL], [COMPOSIÇÃO], [ILUMINAÇÃO], [DETALHES EM MOVIMENTO].

SOUND DESIGN (IMERSÃO SONORA):
Descreva a atmosfera sonora (SFX/Ambience) em inglês técnico para cada cena.

ESTRUTURA DO ROTEIRO:
1. Gancho (0-10s): Foco total na fórmula Gap Glitch.
2. A Promessa: Estabeleça o contexto com Power Words, prometendo uma revelação que mudará perspectivas.
3. Desenvolvimento (A Investigação): Detalhes com ritmo, alternando fatos duros e especulações. Frases curtas.
4. Clímax/Twist (A Virada): Conecte o passado ao presente de forma surpreendente.
5. CTA (Estilo Redacted): Finalize com: "A história tem buracos. Nós os preenchemos."

VOCABULÁRIO DE PODER (OBRIGATÓRIO):
Revelado, Proibido, Classificado, Antigo, Verdade, Protocolo, Ecos, Redigido (Redacted), Arquivo.

---
ESTILO DE NARRATIVA REQUISITADO:
${scriptStylePrompt}

---
${visualInstructions}

---
IMPORTANTE: Retorne SEMPRE um JSON válido:
{
  "title": "Título Impactante (Estilo Redacted)",
  "summary": "Sinopse expandida da história em 2-3 parágrafos. Deve contextualizar o tema, apresentar o mistério central, e dar pistas sobre a revelação sem spoilar completamente o clímax. Use um tom envolvente e misterioso.",
  "scenes": [
    {
      "order": 1,
      "narration": "Texto TTS (${wordRange} palavras).",
      "visualDescription": "Prompt técnico + sensorial detalhado.",
      "audioDescription": "SFX/Atmosfera em inglês.",
      "estimatedDuration": 5
    }
  ]
}

REGRAS ADICIONAIS:
- O campo summary deve ser uma sinopse expandida (2-3 parágrafos) que contextualize a história de forma intrigante e profunda.
- O campo visualDescription deve ser rico o suficiente para modelos como Flux ou WAN 2.2.
- A narração deve soar como um segredo compartilhado, nunca como uma aula expositiva.`
  }

  private buildUserPrompt(request: ScriptGenerationRequest): string {
    const durationMinutes = Math.round(request.targetDuration / 60)
    const durationText = request.targetDuration >= 60
      ? `${durationMinutes} minutos (${request.targetDuration} segundos)`
      : `${request.targetDuration} segundos`

    // Calcular número ideal de cenas baseado em blocos de 5 segundos (duração do motion)
    const idealSceneCount = Math.ceil(request.targetDuration / 5)

    // Construir diretrizes
    let guidelines = ''
    if (request.mustInclude) {
      guidelines += `\n\nO que DEVE estar no roteiro:\n${request.mustInclude}`
    }
    if (request.mustExclude) {
      guidelines += `\n\nO que NÃO deve estar no roteiro:\n${request.mustExclude}`
    }

    const targetWords = request.wordsPerScene || 13
    const minWords = Math.max(8, targetWords - 2)
    const maxWords = targetWords + 2
    const wordRange = `${minWords}-${maxWords}`

    return `Crie um roteiro em ${request.language} sobre o tema: "${request.theme}"

Requisitos CRÍTICOS de Duração e Ritmo:
- O roteiro DEVE ter uma duração total o mais próxima possível de: ${durationText}.
- Divida o roteiro em aproximadamente ${idealSceneCount} cenas.
- Cada cena deve ter uma narração curta de ${wordRange} palavras (aproximadamente 5 segundos de fala).
- É VITAL que a narração de cada cena não ultrapasse esse limite de ${maxWords} palavras, para manter a sincronia perfeita com os clipes de vídeo.
- NÃO gere roteiros significativamente mais curtos ou mais longos que o solicitado.
- Se o tempo for curto (ex: 60s), seja extremamente direto e impactante.
- Se o tempo for longo, aprofunde-se nos detalhes, evidências e ramificações do tema.
- Cada cena deve herdar uma descrição visual cinematográfica única.
- O tom deve ser ${request.style ?? 'documentary'}.
${guidelines}
${request.additionalContext ? `\nContexto adicional: ${request.additionalContext}` : ''}`
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
