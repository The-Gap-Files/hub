/**
 * Screenwriter Prompts — Etapa 2 do pipeline "Escritor → Roteirista"
 * ─────────────────────────────────────────────────────────────────────
 * O Roteirista recebe APENAS a prosa do Escritor + instruções técnicas.
 * Converte cada bloco de prosa em cenas cinematográficas com todos os campos
 * técnicos (visualDescription, motionDescription, audioDescription, SSML, etc.).
 *
 * O Roteirista NÃO recebe:
 * - Dossiê original (fontes, insights, notas, research)
 * - Story Outline
 *
 * O Roteirista RECEBE:
 * - Prosa do Escritor (única fonte narrativa)
 * - Instruções técnicas (visual, motion, áudio, SSML, duração, WPM)
 * - Personas com descrições visuais (para consistência de personagens)
 * - Estilo visual (para visualDescription)
 * - Formato do vídeo e música
 */

import type { ScriptGenerationRequest } from '../../../types/ai-providers'
import { buildVisualInstructionsForScript } from '../../../utils/wan-prompt-builder'
import { formatPersonsForPrompt } from '../../../utils/format-intelligence-context'

export type ProviderHint = 'openai' | 'gemini' | 'anthropic' | 'groq'

// =============================================================================
// SYSTEM PROMPT (Screenwriter)
// =============================================================================

export function buildScreenwriterSystemPrompt(request: ScriptGenerationRequest): string {
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

  // Music instructions
  const videoFormat = request.format || request.outputType || 'full-youtube'
  const isShortFormat = videoFormat.includes('tiktok') || videoFormat.includes('reels') || videoFormat.includes('teaser') || videoFormat.includes('shorts')
  const isYouTubeCinematic = videoFormat.includes('youtube') || videoFormat.includes('full')

  let musicInstructions = ''
  if (isShortFormat) {
    musicInstructions = `
---
🎵 ESTRATÉGIA DE MÚSICA DE FUNDO (YouTube Shorts):
- Use UMA música de fundo para TODO o vídeo: "backgroundMusic" com "prompt" e "volume"
- O "prompt" será usado no modelo Stable Audio 2.5 (gênero, instrumentos, BPM, mood)
- O "volume" é em dB para mixagem com narração (-24 a -6). Prefira -12 a -10.
- Defina "backgroundMusicTracks" como null.`
  } else if (isYouTubeCinematic) {
    musicInstructions = `
---
🎵 ESTRATÉGIA DE MÚSICA DE FUNDO (YouTube Cinematic):
- Use "backgroundMusicTracks" para tracks por SEGMENTO DE CENAS
- Cada track: { prompt, volume, startScene, endScene }
- "startScene"/"endScene" são números de cena (0-indexed). endScene null = até o fim.
- Prompt compatível com Stable Audio 2.5 (gênero, instrumentos, BPM, mood)
- Volume em dB (-24 a -6). Prefira -12 a -10.
- Agrupe cenas por SEGMENTOS NARRATIVOS (HOOK, CONTEXT, RISING ACTION, CLIMAX, RESOLUTION, CTA)
- Máximo de 38 cenas por track (limite do modelo Stable Audio)
- Defina "backgroundMusic" como null.`
  }

  return `Você é um roteirista técnico cinematográfico — especialista em converter prosa narrativa em roteiros técnicos para produção de vídeo com IA.

Você recebeu uma PROSA NARRATIVA escrita por um Escritor. Sua ÚNICA função é converter essa prosa em cenas técnicas, seguindo-a LINEARMENTE do início ao fim.

🚨 REGRA ABSOLUTA — LINEARIDADE:
- Siga a prosa do Escritor NA ORDEM EXATA em que aparece.
- NUNCA volte a um trecho já convertido em cenas.
- NUNCA repita informação que já virou cena.
- NUNCA avance para um trecho futuro e depois volte.
- Cada parágrafo da prosa vira uma ou mais cenas. Ao terminar de converter um parágrafo, passe para o próximo.
- Se a prosa tem 10 blocos (## headers), suas cenas devem seguir a mesma sequência: bloco 1 → bloco 2 → ... → bloco 10.

🚨 REGRA DE FIDELIDADE:
- A narração de cada cena deve ser FIEL ao conteúdo da prosa.
- Você pode CONDENSAR ou REFORMULAR para caber no limite de palavras por cena, mas NUNCA invente conteúdo que não está na prosa.
- Se a prosa não menciona algo, a cena NÃO deve mencionar.
- 🔥 PRESERVE O ESTILO: Se o Escritor usou frases staccato ("1475. Trento. Uma criança morta."), MANTENHA o staccato na narração. Se usou Power Words (Revelado, Proibido, Condenado, Arquivo, Selado, Destino, Silêncio, Irreversível), PRESERVE-AS. Ao condensar, priorize FORÇA sobre completude: 1 frase devastadora > 2 frases medianas. NUNCA "suavize" linguagem impactante em linguagem neutra.

---
DIRETRIZES TÉCNICAS (CRÍTICO):
- SINCRONIA: Cada cena DEVE durar EXATAMENTE 5 segundos de narração.
- 🌐 IDIOMA (REGRA ABSOLUTA): O campo "narration" DEVE ser escrito em ${request.language || 'pt-BR'}. Os campos "visualDescription", "motionDescription" e "audioDescription" DEVEM ser SEMPRE em inglês.
- DENSIDADE OBRIGATÓRIA: Com base na velocidade de fala (${targetWPM} WPM), cada cena DEVE conter entre ${wordsPerScene - 1} e ${maxWordsHard} palavras.
- 🚨 HARD LIMIT: NUNCA exceda ${maxWordsHard} palavras por cena. Cenas com mais de ${maxWordsHard} palavras ultrapassam 5 segundos e quebram a sincronia.
- PROIBIDO FRASES CURTAS: Cenas com menos de ${wordsPerScene - 1} palavras geram "buracos" no áudio.
- FLUIDEZ: O texto deve preencher exatamente 5 segundos de fala contínua.

🔗 SINCRONIZAÇÃO NARRATIVA — VISUAL — MOTION (REGRA MAIS IMPORTANTE):
O pipeline gera: (1) imagem a partir do visualDescription, (2) vídeo animado a partir dessa imagem usando motionDescription. Os 2 campos + a narração DEVEM ser UM ÚNICO MOMENTO NARRATIVO COERENTE.

🚨 NARRAÇÃO GOVERNA O VISUAL: O visualDescription DEVE representar visualmente O QUE A NARRAÇÃO ESTÁ DIZENDO.
- Se a narração diz "O bispo assinou a sentença", o visual DEVE mostrar: documento sendo assinado, selo episcopal, pena sobre pergaminho.
- ❌ PROIBIDO: Narração fala de "bispo assinou sentença" mas visualDescription mostra "a candle on a wooden table"
- TESTE: "Se alguém VÊ esta imagem e OUVE esta narração juntos, faz sentido imediato?" Se NÃO → reescreva.

🎬 MOTION DESCRIPTION (OBRIGATÓRIO): Cada cena DEVE ter "motionDescription" com instruções de MOVIMENTO em inglês para o modelo image-to-video. Descreva O QUE SE MOVE, não o que existe. REGRAS: (1) Foque em movimentos de CÂMERA (slow dolly forward, gentle pan left, subtle tilt up, slow zoom in) e SUJEITO (flames flickering, water rippling, dust floating). (2) 15-40 palavras. (3) NÃO repita a descrição visual. (4) Combine 1 movimento de câmera + 1-2 elementos animados.

🎨 AMBIENTE DA CENA (sceneEnvironment — OBRIGATÓRIO): Identificador curto em snake_case inglês do ambiente/locação (ex: "bishop_study", "canal_dawn"). Cenas consecutivas no MESMO local = MESMO sceneEnvironment.

🎬 KEYFRAME FINAL (endVisualDescription — OPCIONAL): Para cenas com MUDANÇA VISUAL significativa entre início e fim, inclua "endVisualDescription". Se incluir, inclua também "endImageReferenceWeight" (0.0-1.0). Em cenas estáticas, use null.

🎨 COERÊNCIA CROMÁTICA: As cores descritas no visualDescription DEVEM ser compatíveis com a paleta base do estilo visual definido.

🚨 PATTERN INTERRUPT VISUAL (OBRIGATÓRIO):
- Se o roteiro tem 8+ cenas, varie o sceneEnvironment. NÃO coloque todas as cenas no mesmo ambiente.
- A cada 5-6 cenas no mesmo ambiente, insira 1 cena com ambiente DIFERENTE.

PERSONAGENS: Quando houver personagens recorrentes, use SEMPRE os mesmos nomes/descritores no visualDescription. Use as descrições visuais fornecidas na seção de personagens.

🚫 ANATOMIA SEGURA: NUNCA descreva close-ups de mãos, dedos ou pés. Prefira silhuetas, sombras projetadas, objetos em foco. Para rostos, prefira perfil parcial, contraluz/silhueta, planos médios/abertos.

SOUND DESIGN: Descreva a atmosfera sonora (SFX/Ambience) em inglês técnico para cada cena. Seja ESPECÍFICO: "distant church bells with reverb" é melhor que "bells".

🎙️ AUDIO TAGS (SSML — ELEVENLABS):
- Pausa Curta: <break time="0.3s" />
- Pausa Média: <break time="0.75s" />
- Pausa Dramática: <break time="1.5s" />
- Ritmo Rápido: <prosody rate="115%">...</prosody>
- Ritmo Lento: <prosody rate="85%">...</prosody>

🛡️ BRAND SAFETY & GORE:
- PROIBIDO palavras como "Assassinato", "Estupro", "Pedofilia", "Mutilado".
- SUBSTITUA POR: "Fim Trágico", "Ato Imperdoável", "Crimes contra Inocentes".
- VISUAL: Nunca descreva corpos mutilados ou sangue. Foque na ATMOSFERA.

${musicInstructions}

---
${visualInstructions}`
}

// =============================================================================
// USER PROMPT (Screenwriter)
// =============================================================================

export function buildScreenwriterUserPrompt(
  writerProse: string,
  request: ScriptGenerationRequest,
  providerHint?: ProviderHint
): string {
  const targetWPM = request.targetWPM || 150
  const wordsPerScene = Math.round((targetWPM / 60) * 5)
  const minWords = wordsPerScene - 1
  const maxWords = wordsPerScene + 2
  const idealSceneCount = request.targetSceneCount ?? Math.ceil(request.targetDuration / 5)

  const videoFormat = request.format || request.outputType || 'full-youtube'
  const isShortFormat = videoFormat.includes('tiktok') || videoFormat.includes('reels') || videoFormat.includes('teaser') || videoFormat.includes('shorts')
  const isYouTubeCinematic = videoFormat.includes('youtube') || videoFormat.includes('full')

  let formatContext = ''
  if (isShortFormat) {
    formatContext = `\n\n📱 FORMATO: YouTube Shorts
Use "backgroundMusic": { prompt, volume } para UMA música para TODO o vídeo.`
  } else if (isYouTubeCinematic) {
    formatContext = `\n\n🎬 FORMATO: YouTube Cinematic
Use "backgroundMusicTracks" com tracks { prompt, volume, startScene, endScene }.`
  }

  // Build the prompt
  let prompt = `📜 PROSA DO ESCRITOR (SUA ÚNICA FONTE NARRATIVA):
Converta a prosa abaixo em cenas cinematográficas. Siga a ordem do texto EXATAMENTE.
Cada parágrafo ou trecho se torna uma ou mais cenas.
NUNCA volte a um trecho já convertido. NUNCA repita informação já transformada em cena.

${'═'.repeat(60)}
${writerProse}
${'═'.repeat(60)}
${formatContext}`

  // Persons with visual descriptions (for character consistency in visuals)
  const personsBlock = formatPersonsForPrompt(request.persons || [])
  if (personsBlock) {
    prompt += `\n\n🎭 PERSONAGENS (USE ESTAS DESCRIÇÕES VISUAIS PARA CONSISTÊNCIA):\n${personsBlock}`
  }

  // Visual identity context (affects visual descriptions)
  if (request.visualIdentityContext) {
    prompt += `\n\n🎨 DIRETRIZES DE IDENTIDADE VISUAL:\n${request.visualIdentityContext}`
  }

  // Dossier category + visual/music guidance
  if (request.dossierCategory) {
    prompt += `\n\n🏷️ CLASSIFICAÇÃO: ${request.dossierCategory.toUpperCase()}`
    if (request.musicGuidance) {
      prompt += `\n🎵 ORIENTAÇÃO MUSICAL: "${request.musicGuidance}"`
      prompt += `\n💓 ATMOSFERA EMOCIONAL: ${request.musicMood}`
    }
    if (request.visualGuidance) {
      prompt += `\n🖼️ ORIENTAÇÃO VISUAL: ${request.visualGuidance}`
    }
  }

  // Avoid patterns (some are visual)
  if (request.avoidPatterns && request.avoidPatterns.length > 0) {
    prompt += `\n\n⛔ ANTI-PADRÕES VISUAIS/TÉCNICOS:\n`
    request.avoidPatterns.forEach((pattern, i) => {
      prompt += `${i + 1}. ${pattern}\n`
    })
  }

  // Episode context (for CTA handling)
  if (request.episodeNumber && request.totalEpisodes) {
    const isLastEpisode = request.episodeNumber >= request.totalEpisodes
    prompt += `\n\n📺 SÉRIE — EP${request.episodeNumber}/${request.totalEpisodes}`
    if (!isLastEpisode) {
      prompt += `\nAs últimas 2-3 cenas antes do CTA devem funcionar como teaser do EP${request.episodeNumber + 1}.`
    }
  }

  // Music format specifics
  let musicWarning = ''
  if (isShortFormat) {
    musicWarning = `\n\n🚨 MÚSICA: Use "backgroundMusic": { "prompt": "...", "volume": -12 }.
O prompt segue formato Stable Audio 2.5. Defina "backgroundMusicTracks" como null.`
  } else if (isYouTubeCinematic) {
    musicWarning = `\n\n🚨 MÚSICA: Use "backgroundMusicTracks" com lista de tracks { prompt, volume, startScene, endScene }.
Calibre startScene/endScene com base no número REAL de cenas que você gerou.
Última track DEVE ter endScene: null. Defina "backgroundMusic" como null.`
  }

  const maxReflectionScenes = Math.max(3, Math.round(idealSceneCount * 0.15))
  const maxReflectionCeiling = Math.round(idealSceneCount * 0.20)

  let providerSpecificItems = ''
  if (providerHint === 'gemini') {
    providerSpecificItems = `\n9. 💎 GEMINI: Aproveite contexto estendido para garantir continuidade perfeita entre cenas.`
  }

  prompt += `

---
⚠️ REQUISITOS OBRIGATÓRIOS PARA APROVAÇÃO:
1. QUANTIDADE DE CENAS: O Arquiteto planejou ~${idealSceneCount} cenas como referência. Gere quantas cenas a prosa PRECISAR — sem repetir informação. Menos cenas com conteúdo único é MELHOR que muitas cenas repetitivas.
2. FIDELIDADE À PROSA: Cada cena deve corresponder a um trecho da prosa do Escritor. Não invente conteúdo.
3. LINEARIDADE: As cenas DEVEM seguir a ordem da prosa. Se a prosa tem blocos A→B→C→D, as cenas devem cobrir A, depois B, depois C, depois D — NUNCA voltar a A ou B.
4. DURAÇÃO DA CENA: Cada cena = 5 segundos de narração.
5. CONTAGEM DE PALAVRAS: Cada narração entre ${minWords} e ${maxWords} palavras. NUNCA exceda ${maxWords}.
6. MÚSICA: ${isShortFormat ? 'backgroundMusic para vídeo todo.' : 'backgroundMusicTracks por segmento narrativo.'}
7. PROPORÇÃO: Reflexão/Lição ≤${maxReflectionScenes} cenas (máx ${maxReflectionCeiling}).
8. ANTI-REPETIÇÃO (PRIORIDADE MÁXIMA): Se duas cenas expressam a mesma ideia, ELIMINE uma. Cada cena deve ser ÚNICA. Qualidade > quantidade.${providerSpecificItems}
${musicWarning}

🛡️ VALIDAÇÃO FINAL:
1. PROCURE REPETIÇÕES — se duas cenas dizem a mesma coisa com palavras diferentes, ELIMINE uma. Qualidade > quantidade.
2. VERIFIQUE LINEARIDADE — as cenas seguem a ordem da prosa? Nenhum bloco foi revisitado?
3. SINCRONIZAÇÃO — para CADA cena: narração fala de X → visual mostra X?
4. MOTION — o motionDescription é coerente com o visualDescription?
5. PALAVRAS — cada cena tem entre ${minWords}-${maxWords} palavras?`

  return prompt
}
