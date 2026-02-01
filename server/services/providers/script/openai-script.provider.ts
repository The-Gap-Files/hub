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

export class OpenAIScriptProvider implements IScriptGenerator {
  private apiKey: string
  private model: string
  private baseUrl: string

  constructor(config: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey
    this.model = config.model ?? 'gpt-4-turbo-preview'
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
    const styleInstructions: Record<string, string> = {
      documentary: 'Adote um tom documental sério e investigativo.',
      mystery: 'Crie tensão e mistério, com revelações graduais.',
      narrative: 'Conte uma história envolvente com arco narrativo claro.',
      educational: 'Seja informativo mas acessível, explicando conceitos complexos.'
    }

    const visualStyleInstructions: Record<string, string> = {
      epictok: 'O estilo visual deve ser uma ilustração 2D digital com traços de tinta (inked outlines), sombreamento plano (flat cell shading) e estética de pôster vintage. Use uma paleta de cores terrosas e tons dessaturados. A vibe deve lembrar as artes de fundo do Studio Ghibli e o estilo de Eyvind Earle.',
      gta6: 'O estilo visual deve ser vibrante, com cores saturadas, iluminação de pôr do sol de Miami e estética de jogo moderno de alto orçamento.',
      cyberpunk: 'O estilo visual deve ser neon, futurista, com chuva, luzes coloridas e tecnologia avançada.',
      'oil-painting': 'O estilo visual deve parecer uma pintura a óleo clássica, com pinceladas visíveis e textura de tela.',
      photorealistic: 'O estilo visual deve ser fotorrealista, como se fosse uma fotografia de cinema em alta resolução.'
    }

    const visualStylePrompt = request.visualStyle
      ? visualStyleInstructions[request.visualStyle] ?? ''
      : ''

    return `Você é o roteirista principal do "The Gap Files" (A Lacuna), um canal focado em história proibida, mistérios e o "lado oculto" da realidade.
Seu objetivo NÃO é apenas informar, mas criar uma experiência imersiva de "acesso a um arquivo secreto". O tom deve ser confidencial, urgente e cinematográfico, evocando a sensação de que o espectador está vendo algo que não deveria.

PSICOLOGIA DA RETENÇÃO E RITMO (SKILLS CRÍTICAS):
- Pattern Interrupt: O YouTube moderno exige mudanças visuais constantes. Cada cena de 5 segundos deve ser um "choque visual" diferente da anterior (mude o ângulo, o foco ou a iluminação).
- Micro-Hooks: Use a narração para criar perguntas constantes na mente do espectador. Nunca responda tudo de uma vez.
- Sincronia de 5 Segundos: O sistema de vídeo gera clipes de exatamente 5 segundos. Escreva narrações rítmicas que caibam perfeitamente nesse tempo (aprox. 12-15 palavras por cena).

ESTRUTURA OBRIGATÓRIA DO ROTEIRO:
1. O Gancho (0-10s): Comece "in media res" ou com uma contradição chocante. Use a fórmula: Mistério -> Verdade Oculta -> Exclusividade.
2. Desenvolvimento: Alterne fatos duros com narrativas emocionais. Evite tom de "aula" ou enciclopédia. Use frases curtas, ritmo rápido e pausas dramáticas.
3. Clímax/Twist: Conecte o passado ao presente de forma surpreendente.
4. Encerramento: Finalize com a assinatura do canal (ex: "A história tem buracos. Nós os preenchemos.") ou um convite sutil para novos "arquivos".

VOCABULÁRIO DE PODER (POWER WORDS):
Incorpore palavras que geram autoridade e mistério: *Revelado, Proibido, Classificado, Antigo, Verdade, Protocolo, Ecos, Omitido (Redacted), Arquivo.*

${styleInstructions[request.style ?? 'documentary']}
${visualStylePrompt ? `DIRETRIZ VISUAL OBRIGATÓRIA (Mantenha a coerência em todas as cenas): ${visualStylePrompt}` : ''}

IMPORTANTE: Retorne SEMPRE um JSON válido com a seguinte estrutura:
{
  "title": "Título do vídeo (Curto, Misterioso e Viral)",
  "scenes": [
    {
      "order": 1,
      "narration": "Texto narrado (Focado em emoção e ritmo).",
      "visualDescription": "Descrição para IA de imagem (inglês ou português detalhado), focando em atmosfera, iluminação e ângulo de câmera.",
      "estimatedDuration": 15
    }
  ]
}

Cada cena deve ter:
- narration: O texto exato para TTS.
- visualDescription: Prompt técnico para geração de imagem (descreva luz, textura, lente e composição).
- estimatedDuration: Duração em segundos.

As descrições visuais devem ser CINEMATOGRÁFICAS e EMOCTIVAS:
- Defina a iluminação (Chiaroscuro, Volumétrica, Neon, Luz Natural Dramática)
- Defina a atmosfera (Sombria, Épica, Misteriosa, Nebulosa)
- Defina a composição (Close-up, Wide shot, Low angle)`
  }

  private buildUserPrompt(request: ScriptGenerationRequest): string {
    const durationMinutes = Math.round(request.targetDuration / 60)
    const durationText = request.targetDuration >= 60 
      ? `${durationMinutes} minutos (${request.targetDuration} segundos)`
      : `${request.targetDuration} segundos`
    
    // Calcular número ideal de cenas baseado em blocos de 5 segundos (duração do motion)
    const idealSceneCount = Math.ceil(request.targetDuration / 5)

    return `Crie um roteiro em ${request.language} sobre o tema: "${request.theme}"

Requisitos CRÍTICOS de Duração e Ritmo:
- O roteiro DEVE ter uma duração total o mais próxima possível de: ${durationText}.
- Divida o roteiro em aproximadamente ${idealSceneCount} cenas.
- Cada cena deve ter uma narração curta de 12 a 15 palavras (aproximadamente 5 segundos de fala).
- É VITAL que a narração de cada cena não ultrapasse esse limite, para manter a sincronia perfeita com os clipes de vídeo.
- NÃO gere roteiros significativamente mais curtos ou mais longos que o solicitado.
- Se o tempo for curto (ex: 60s), seja extremamente direto e impactante.
- Se o tempo for longo, aprofunde-se nos detalhes, evidências e ramificações do tema.
- Cada cena deve ter uma descrição visual cinematográfica única.
- O tom deve ser ${request.style ?? 'documentary'}.

${request.additionalContext ? `Contexto adicional: ${request.additionalContext}` : ''}`
  }

  private parseResponse(content: {
    title: string
    scenes: Array<{
      order: number
      narration: string
      visualDescription: string
      estimatedDuration: number
    }>
  }): ScriptGenerationResponse {
    const scenes: ScriptScene[] = content.scenes.map((scene, index) => ({
      order: scene.order ?? index + 1,
      narration: scene.narration,
      visualDescription: scene.visualDescription,
      estimatedDuration: scene.estimatedDuration ?? 5
    }))

    const fullText = scenes.map(s => s.narration).join('\n\n')
    const wordCount = fullText.split(/\s+/).length
    const estimatedDuration = scenes.reduce((acc, s) => acc + s.estimatedDuration, 0)

    return {
      title: content.title,
      fullText,
      scenes,
      wordCount,
      estimatedDuration,
      provider: this.getName(),
      model: this.model
    }
  }
}
