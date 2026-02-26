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

  if (request.visualScreenwriterHints) {
    visualInstructions += `\n\n[STYLE-SPECIFIC SCREENWRITER INSTRUCTIONS]\n${request.visualScreenwriterHints}`
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
- 🌐 IDIOMA (REGRA ABSOLUTA): O campo "narration" DEVE ser escrito em ${request.language || 'pt-BR'}. Os campos "visualDescription", "motionDescription" e "audioDescription" DEVEM ser SEMPRE em inglês.
- 🚨 HARD LIMIT: NUNCA exceda ${maxWordsHard} palavras por cena. Cenas com mais de ${maxWordsHard} palavras ultrapassam 5 segundos e quebram a sincronia de áudio.

🎙️ DOIS TIPOS DE CENA — ESCOLHA POR INTENÇÃO DRAMÁTICA:

• CENA DENSA (padrão narrativo): ${wordsPerScene - 1}–${maxWordsHard} palavras. Preenche os 5 segundos com narração fluida. Use para contexto, revelação elaborada, descrição de ação.

• CENA STACCATO (impacto / tensão / pontuação dramática): 4–8 palavras. O silêncio é intencional — cria tensão. O ÁUDIO gerado pelo ElevenLabs (fala + breaks) define a duração da cena no vídeo, então o TOTAL de fala + breaks DEVE somar ~5 segundos.

  FÓRMULA: palavras_faladas × (60/${targetWPM}) + soma_dos_breaks ≈ 5 segundos
  A ${targetWPM} WPM, cada palavra dura ~${(60 / targetWPM).toFixed(2)}s. Portanto:
  - 4 palavras ≈ ${(4 * 60 / targetWPM).toFixed(1)}s de fala → adicione ~${(5 - 4 * 60 / targetWPM).toFixed(1)}s em breaks
  - 6 palavras ≈ ${(6 * 60 / targetWPM).toFixed(1)}s de fala → adicione ~${(5 - 6 * 60 / targetWPM).toFixed(1)}s em breaks
  - 8 palavras ≈ ${(8 * 60 / targetWPM).toFixed(1)}s de fala → adicione ~${(5 - 8 * 60 / targetWPM).toFixed(1)}s em breaks

  EXEMPLOS CORRETOS (áudio total ≈ 5s cada):
  - "1966.<break time="1.0s"/> Terra seca.<break time="1.0s"/> Estado ausente.<break time="1.2s"/>"
  - "Silêncio vira estratégia.<break time="3.5s"/>"
  - "O jogo muda.<break time="3.7s"/>"
  - "Ele ocupa.<break time="1.5s"/> Nasce o CJNG.<break time="1.5s"/>"
  - "Mensagem entregue.<break time="1.5s"/> Nova ordem instalada.<break time="1.2s"/>"

REGRAS DE EQUILÍBRIO (obrigatório):
- Máximo 3 cenas staccato CONSECUTIVAS — depois volta para cena densa.
- Cenas staccato SEM breaks suficientes são PROIBIDAS — a cena durará menos de 5 segundos, quebrando a sincronia do vídeo.

🎯 HOOK SEGMENT OPTIMIZATION (Primeiros 30 segundos — OBRIGATÓRIO):
As primeiras 6 cenas (cenas 0-5) são a zona de retenção crítica onde o YouTube Analytics mede o "hook rate" (abandono nos primeiros 30s).

REGRAS ESPECIAIS para cenas 0-5:
- CENAS 0-2 (primeiros 10s): brollPriority=2 OBRIGATÓRIO. patternInterruptType deve ser "hard_cut" ou "smash_cut". onScreenText OBRIGATÓRIO na cena 0.
- CENAS 3-5 (segundos 10-30): Cada narração deve terminar com frase aberta ou dado surpreendente — NUNCA com frase conclusiva. Se a narração tem tom expositivo, corte-a no meio da revelação.
- CENA 5 (segundo 25-30): Re-engagement hook obrigatório — a narração deve plantar a promessa do restante do vídeo ("e o que ninguém ainda sabe é que...").
- riskFlags ["slow", "expository"] nas cenas 0-5 são FALHA CRÍTICA — reescreva a narração antes de sinalizar.

🚫 HOOK ANTI-ABSTRAÇÃO (cenas 0-3 — REGRA ABSOLUTA):
Nos primeiros 15 segundos, o cérebro do espectador quer: conflito concreto + ameaça clara + consequência direta.
❌ PROIBIDO nas cenas 0-3: frases filosóficas ou universais ("A história humana é...", "O ciclo eterno de...", "A natureza do poder...", "Desde o início dos tempos...").
✅ SUBSTITUA por: dado específico + personagem + situação concreta.
Exemplo ruim: "A história humana é um ciclo eterno de culpa e redenção."
Exemplo bom: "Uma cabana. Uma máquina de hemodiálise. O senhor do crime mais procurado do mundo — e ninguém sabia onde ele estava."

🎚️ RITMO E VARIAÇÃO NARRATIVA (ANTI-UNIFORMIDADE — OBRIGATÓRIO):
O MAIOR erro narrativo é o "ritmo plano": narração que começa forte, continua forte, e continua forte — sem picos, sem vales, sem respiração. Isso mata retenção.

PROIBIÇÕES DE CADÊNCIA:
❌ PROIBIDO: 3 cenas seguidas com o mesmo padrão sujeito+verbo ("Ele entendeu...", "Ele transformou...", "Ele mapeou...", "Ele observou..."). Varie a estrutura.
❌ PROIBIDO: tom analítico/institucional por mais de 4 cenas consecutivas. Quebre com emoção ou dado chocante.
❌ PROIBIDO: mais de 3 cenas seguidas sem pergunta, cliffhanger ou dado surpreendente.

TÉCNICAS DE VARIAÇÃO (use pelo menos 1 a cada 6-8 cenas):
✅ FRASE STACCATO: 2–6 palavras. Sem verbo. Impacto puro. Ex: "Quinze anos. Prisão. Escola do crime." — use SSML <break time="0.3s" /> entre fragmentos.
✅ PERGUNTA DIRETA: plante open loop. Ex: "Mas quem financiou tudo isso?"
✅ INVERSÃO COTIDIANA: conecte o abstrato ao concreto do dia-a-dia. Ex: Em vez de "financia operações criminosas" → "O abacate que chega à sua mesa... financia uma guerra."
✅ CHOQUE NUMÉRICO: dado específico que quebra expectativa. Ex: "Não dezenas. Setecentas toneladas por ano."
✅ CORTE ABRUPTO: término que força continuidade. Ex: "E então... ninguém voltou." (cena termina aqui — próxima cena expande)

ESTRUTURA DE ONDAS (obrigatório em roteiros com 30+ cenas):
- A cada 10–15 cenas: 1–2 cenas de "respiração" (ritmo mais lento, revelação emocional, micro-payoff).
- A cada 4–6 cenas: 1 pergunta retórica ou micro-cliffhanger na narração.
- Distribua 2–3 "CHOQUES NARRATIVOS" ao longo do vídeo: revelação inesperada que muda a perspectiva do espectador sobre o que já viu.

🔗 SINCRONIZAÇÃO NARRATIVA — VISUAL — MOTION (REGRA MAIS IMPORTANTE):
O pipeline gera: (1) imagem a partir do visualDescription, (2) vídeo animado a partir dessa imagem usando motionDescription. Os 2 campos + a narração DEVEM ser UM ÚNICO MOMENTO NARRATIVO COERENTE.

🚨 NARRAÇÃO GOVERNA O VISUAL: O visualDescription DEVE representar visualmente O QUE A NARRAÇÃO ESTÁ DIZENDO.
- Se a narração diz "O bispo assinou a sentença", o visual DEVE mostrar: documento sendo assinado, selo episcopal, pena sobre pergaminho.
- ❌ PROIBIDO: Narração fala de "bispo assinou sentença" mas visualDescription mostra "a candle on a wooden table"
- TESTE: "Se alguém VÊ esta imagem e OUVE esta narração juntos, faz sentido imediato?" Se NÃO → reescreva.

🎬 MOTION DESCRIPTION (OBRIGATÓRIO): Cada cena DEVE ter "motionDescription" com instruções de MOVIMENTO em inglês para o modelo image-to-video. Descreva O QUE SE MOVE, não o que existe. REGRAS: (1) Foque em movimentos de CÂMERA (slow dolly forward, gentle pan left, subtle tilt up, slow zoom in) e SUJEITO (flames flickering, water rippling, dust floating). (2) 15-40 palavras. (3) NÃO repita a descrição visual. (4) Combine 1 movimento de câmera + 1-2 elementos animados.

🎨 AMBIENTE DA CENA (sceneEnvironment — OBRIGATÓRIO): Identificador curto em snake_case inglês do ambiente/locação (ex: "bishop_study", "canal_dawn"). Cenas consecutivas no MESMO local = MESMO sceneEnvironment.

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

📊 CAMPOS VIRAL-FIRST (RETENÇÃO — OBRIGATÓRIO):
Cada cena DEVE incluir estes campos para alimentar o pipeline de retenção:

- **onScreenText** (opcional, máx 120 chars): Texto overlay queimado na tela durante a cena. Use para:
  • Dados impactantes: "3 milhões de mortos", "1475"
  • Perguntas retóricas: "Coincidência?", "Quem autorizou?"
  • Frases-tese compartilháveis: "A mesma mentira, 500 anos depois"
  • Língua: mesma da narração. null = sem overlay.
  • REGRA: pelo menos 1 a cada 4-5 cenas. Hook (cena 0) SEMPRE deve ter.

- **patternInterruptType** (opcional): Tipo de interrupção visual nesta cena.
  Opções: zoom, whip_pan, hard_cut, smash_cut, glitch, freeze, rack_focus, speed_ramp
  • Use a cada 3-5 cenas para quebrar monotonia visual.
  • Hook: prefira hard_cut ou smash_cut. Clímax: zoom ou speed_ramp.
  • null = transição padrão (sem interrupt).

- **brollPriority** (obrigatório, 0-2): Prioridade visual da cena.
  • 0 = simples (b-roll genérico, modelo rápido)
  • 1 = padrão (qualidade normal) — DEFAULT
  • 2 = hero shot (hook, clímax, virada — modelo premium)
  • Cenas 0-1 (hook) e cena de clímax DEVEM ser 2.

- **riskFlags** (obrigatório, array): Auto-avaliação de risco editorial.
  Opções: slow, expository, confusing, low_energy, redundant
  • Cenas sem risco = [] (array vazio).
  • Se uma cena é necessária mas "fria" (contextualização), marque ["expository"].
  • Isso permite que o Retention QA priorize revisão nas cenas sinalizadas.

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
  const durationBased = request.targetSceneCount ?? Math.ceil(request.targetDuration / 5)

  // Quando a prosa do Writer está presente, derivar o alvo de cenas a partir do
  // número real de parágrafos — a prosa pode ser maior que o targetDuration prevê.
  // Conta linhas individuais com conteúdo substancial (>20 chars, não-header).
  // A prosa usa \n simples entre parágrafos dentro de cada bloco ##, então
  // split(/\n\n+/) só encontrava ~12 grupos; linha-por-linha encontra os ~60-85 reais.
  // Cada parágrafo gera em média 2 cenas (regra de 3: 60 parágrafos → 120 cenas).
  // Nunca abaixo do valor baseado em duração.
  const proseParagraphCount = writerProse
    .split('\n')
    .filter(line => {
      const t = line.trim()
      return t.length > 20 && !t.startsWith('#') && !t.startsWith('═')
    })
    .length
  const proseBasedCount = Math.ceil(proseParagraphCount * 2.0)
  const idealSceneCount = Math.max(durationBased, proseBasedCount)

  // Contar blocos ## para instrução per-bloco (LLM tende a gerar ~5-6 cenas/bloco
  // independente do total — instrução por bloco é mais concreta e obedecida)
  const proseSectionCount = Math.max(1, (writerProse.match(/^## /gm) || []).length)
  const minScenesPerSection = Math.ceil(idealSceneCount / proseSectionCount)

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
  let prompt = `🎯 CONTRATO DE PRODUÇÃO — LEIA ANTES DA PROSA:
Objetivo: ${Math.round(request.targetDuration / 60)} minutos de vídeo = MÍNIMO ${idealSceneCount} cenas.
Esta prosa tem ${proseSectionCount} blocos narrativos (##). Você DEVE gerar MÍNIMO ${minScenesPerSection} cenas por bloco.
REGRA DE EXPANSÃO: cada parágrafo → 2 cenas. Parágrafos longos → 3 cenas. NUNCA 1 parágrafo = 1 cena.
Se qualquer bloco tiver menos de ${Math.max(6, minScenesPerSection - 3)} cenas, você FALHOU naquele bloco.
Total mínimo: ${idealSceneCount} cenas (${proseSectionCount} blocos × ${minScenesPerSection} cenas/bloco).
NÃO condense. NÃO pule. EXPANDA — cada detalhe da prosa merece sua própria cena.

📜 PROSA DO ESCRITOR (SUA ÚNICA FONTE NARRATIVA):
Converta a prosa abaixo em cenas cinematográficas. Siga a ordem do texto EXATAMENTE.
Cada parágrafo ou trecho se torna UMA OU MAIS cenas (mínimo 2 por parágrafo).
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
1. COBERTURA TOTAL DA PROSA (PRIORIDADE MÁXIMA): Converta TODA a prosa do Escritor em cenas — cada parágrafo deve virar 1–3 cenas. NÃO resuma, NÃO pule parágrafos, NÃO comprima 3 parágrafos em 1 cena. A referência é ~${idealSceneCount} cenas (${proseParagraphCount} parágrafos × 1–2 cenas/parágrafo). Se a prosa exigir MAIS cenas para cobrir tudo, GERE MAIS — nunca sacrifique conteúdo para atingir um número fixo.
2. FIDELIDADE À PROSA: Cada cena deve corresponder a um trecho da prosa do Escritor. Não invente conteúdo.
3. LINEARIDADE: As cenas DEVEM seguir a ordem da prosa. Se a prosa tem blocos A→B→C→D, as cenas devem cobrir A, depois B, depois C, depois D — NUNCA voltar a A ou B.
4. DURAÇÃO DA CENA: Cada cena = 5 segundos de narração.
5. CONTAGEM DE PALAVRAS: HARD LIMIT ${maxWords} palavras/cena. Cenas densas: ${minWords}–${maxWords} palavras. Cenas staccato: 4–8 palavras COM break SSML obrigatório. Média geral do roteiro ≥ ${minWords - 1} palavras/cena.
6. MÚSICA: ${isShortFormat ? 'backgroundMusic para vídeo todo.' : 'backgroundMusicTracks por segmento narrativo.'}
7. PROPORÇÃO: Reflexão/Lição ≤${maxReflectionScenes} cenas (máx ${maxReflectionCeiling}).
8. ANTI-REPETIÇÃO: Se duas cenas expressam a mesma ideia EXATA, ELIMINE uma. Mas cenas com ângulos diferentes sobre o mesmo tema são VÁLIDAS (ex: fato → consequência → reação).${providerSpecificItems}
${musicWarning}

🛡️ VALIDAÇÃO FINAL:
1. PROCURE REPETIÇÕES EXATAS — se duas cenas dizem a mesma coisa com palavras diferentes, ELIMINE uma. Cenas com ângulos complementares (causa → efeito) NÃO são repetição.
2. VERIFIQUE LINEARIDADE — as cenas seguem a ordem da prosa? Nenhum bloco foi revisitado?
3. SINCRONIZAÇÃO — para CADA cena: narração fala de X → visual mostra X?
4. MOTION — o motionDescription é coerente com o visualDescription?
5. PALAVRAS — cada cena tem 4–${maxWords} palavras? Cenas staccato (4–8) têm break SSML? Média geral ≥ ${minWords - 1} palavras/cena?`

  return prompt
}
