/**
 * Shared Script Prompts — Single Source of Truth
 * 
 * Contém toda a lógica de construção de prompts e schemas Zod
 * que era duplicada nos 3 providers (OpenAI, Gemini, Anthropic).
 * 
 * Cada provider agora importa daqui e foca APENAS na parte de
 * conexão LangChain + SDK específico.
 * 
 * Fluxo: Provider.generate() → buildSystemPrompt() + buildUserPrompt() → LLM → parseScriptResponse()
 */

import { z } from 'zod'
import type {
  ScriptGenerationRequest,
  ScriptGenerationResponse,
  ScriptScene
} from '../../../types/ai-providers'
import { calculateLLMCost } from '../../../constants/pricing'
import { buildVisualInstructionsForScript } from '../../../utils/wan-prompt-builder'
import { formatPersonsForPrompt, formatNeuralInsightsForPrompt } from '../../../utils/format-intelligence-context'

// =============================================================================
// ZOD SCHEMAS (Output Estruturado)
// =============================================================================

export const ScriptSceneSchema = z.object({
  order: z.number().describe('A ordem sequencial da cena'),
  narration: z.string().describe('O texto que será narrado pelo locutor (DEVE ser no IDIOMA DO VÍDEO especificado na request, NUNCA em inglês — apenas visualDescription, motionDescription e audioDescription são em inglês)'),
  visualDescription: z.string().describe('Descrição técnica e sensorial para o modelo de geração de imagem (SEMPRE EM INGLÊS). DEVE representar visualmente o que a narração diz. Se a narração fala de "bispo assinou sentença", o visual DEVE mostrar documento/selo/assinatura — NUNCA uma vela ou paisagem desconectada.'),
  sceneEnvironment: z.string().describe('Identificador curto do ambiente/locação da cena em snake_case em inglês (ex: "bishop_study", "canal_dawn", "courtroom", "ocean_surface"). Cenas consecutivas no MESMO ambiente devem ter o MESMO valor.'),
  motionDescription: z.string().nullable().describe('Instruções de MOVIMENTO para o modelo image-to-video (SEMPRE EM INGLÊS). Descreva movimentos de câmera (dolly, pan, tilt) e elementos animados (chamas, água, vento, poeira) que devem animar a imagem. NÃO repita o que já está na imagem — foque no que se MOVE. 15-40 palavras.'),
  audioDescription: z.string().nullable().describe('Atmosfera sonora e SFX em inglês técnico. Descreva sons de ambiente (rain, wind, crowd murmur), impactos (door slam, thunder crack), e atmosfera (eerie drone, tension strings). Seja ESPECÍFICO: "distant church bells with reverb" é melhor que "bells".'),
  audioDescriptionVolume: z.number().min(-24).max(-6).default(-12).describe('Volume do SFX em dB para mixagem com a narração. Range: -24 (quase inaudível) a -6 (proeminente). Default: -12 (equilíbrio). Sons de ambiente: -18 a -15. Impactos dramáticos: -9 a -6.'),
  estimatedDuration: z.number().default(5).describe('Duração estimada em segundos (entre 5 e 6 segundos)')
})

export const BackgroundMusicTrackSchema = z.object({
  prompt: z.string().describe('Prompt para geração de música no formato Stable Audio. Inclua gênero, instrumentos, BPM, mood e estilo. Exemplo: "Ambient, Drone, Dark Strings, Pulsing Heartbeat Rhythm, Tension Build-Up, Mysterious, Cinematic, Atmospheric, 80 BPM"'),
  volume: z.number().describe('Volume em dB para mixagem com narração (-24 a -6). Prefira -12 a -10 para fundo claramente audível; -18 fica baixo demais. Ex.: -12 médio, -10 mais presente, -6 alto.'),
  startScene: z.number().describe('Número da cena onde esta track começa (0 = primeira cena)'),
  endScene: z.number().nullable().describe('Número da última cena desta track (null = até a última cena do vídeo)')
})

export const BackgroundMusicSchema = z.object({
  prompt: z.string().describe('Prompt para geração de música no formato Stable Audio. Inclua gênero, instrumentos, BPM, mood e estilo. Exemplo: "Ambient, Drone, Dark Strings, Subtle Pads, Mysterious, Cinematic, Atmospheric, well-arranged composition, 80 BPM"'),
  volume: z.number().describe('Volume em dB para mixagem com narração (-24 a -6). Prefira -12 a -10 para fundo claramente audível; -18 fica baixo demais. Ex.: -12 médio, -10 mais presente, -6 alto.')
})

export const ScriptResponseSchema = z.object({
  title: z.string().describe('Título impactante para o vídeo'),
  summary: z.string().describe('Sinopse intrigante de 2-3 parágrafos'),
  scenes: z.array(ScriptSceneSchema).describe('Lista de cenas que compõem o vídeo'),
  backgroundMusic: BackgroundMusicSchema.nullable().describe('Música de fundo única para TODO o vídeo (use apenas para vídeos curtos YouTube Shorts). Use null para vídeos longos. Regra: "video todo"'),
  backgroundMusicTracks: z.array(BackgroundMusicTrackSchema).nullable().describe('Lista de tracks de música de fundo por segmento de cenas (use apenas para vídeos longos YouTube Cinematic). Use null para vídeos curtos. Cada track define uma música com prompt, volume, startScene e endScene.')
})

export type ScriptResponse = z.infer<typeof ScriptResponseSchema>

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

export function buildSystemPrompt(request: ScriptGenerationRequest): string {
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

  // Determinar formato do vídeo para instruções de música
  const videoFormat = request.format || request.outputType || 'full-youtube'
  const isShortFormat = videoFormat.includes('tiktok') || videoFormat.includes('reels') || videoFormat.includes('teaser') || videoFormat.includes('shorts')
  const isYouTubeCinematic = videoFormat.includes('youtube') || videoFormat.includes('full')

  let musicInstructions = ''
  if (isShortFormat) {
    musicInstructions = `
---
🎵 ESTRATÉGIA DE MÚSICA DE FUNDO (YouTube Shorts):
- 🚨 REGRA: "video todo" - Use UMA música de fundo para TODO o vídeo do início ao fim
- Use o campo "backgroundMusic" com "prompt" e "volume"
- O "prompt" será usado diretamente no modelo Stable Audio 2.5 para gerar a música
- FORMATO DO PROMPT: Inclua gênero, sub-gênero, instrumentos específicos, BPM, mood e estilo
- O "volume" é em dB para mixagem com narração (-24 a -6). Prefira -12 a -10 para a música ser claramente audível; -18 fica baixo demais.
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
- O "volume" é em dB para mixagem com narração (-24 a -6). Prefira -12 a -10 para a música ser claramente audível; -18 fica baixo demais.
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

  return `Você é um arquiteto de compulsão narrativa — um roteirista que domina storytelling cinematográfico, retenção viral e inteligência de plataforma simultaneamente.

Você entende que o algoritmo é seu co-criador: ele decide distribuição ANTES que qualquer humano veja o conteúdo. Você projeta para algoritmo + humano ao mesmo tempo. Violência explícita penaliza distribuição. Intensidade linear satura o espectador. Mostrar o SISTEMA que criou a injustiça é sempre mais poderoso E mais seguro que mostrar a injustiça em si.

---
ESTILO NARRATIVO E PERSONA:
${styleInstructions}

---
📐 ARQUITETURA NARRATIVA PROPORCIONAL (OBRIGATÓRIO):
O roteiro DEVE seguir proporções rígidas entre seus atos. Isso é CRÍTICO para manter a retenção do início ao fim.

| FASE | PROPORÇÃO DO TOTAL | FUNÇÃO |
|------|-------|--------|
| 🎯 HOOK (Gancho) | ≤5% das cenas | Captura atenção. Ruptura cognitiva. PERPLEXIDADE > repulsa. |
| 📜 CORPO FACTUAL (Investigação) | 55-65% das cenas | Fatos, cronologia, revelações, evidências. O CORAÇÃO do vídeo. |
| 🔗 PONTE TEMPORAL (se aplicável) | 10-15% das cenas | Conexão passado-presente, relevância contemporânea. |
| 💡 REFLEXÃO/LIÇÃO | ≤15% das cenas | Significado, implicação, questionamento. CONCISO e IMPACTANTE. |
| 📢 CTA (Encerramento) | ≤5% das cenas (máx 2-3 cenas) | Compulsão por continuar + assinatura "The Gap Files". |

🚨 REGRA DE PROPORÇÃO MÁXIMA: A seção de REFLEXÃO/LIÇÃO NUNCA deve ultrapassar 20% do total de cenas. Prefira 15-20%. Reflexão longa = QUEDA DE RETENÇÃO.

🚨 REGRA ANTI-REPETIÇÃO ESTRUTURAL (CRÍTICO):

NÍVEL 1 — Ideia: "1 ideia = 1 cena"
- PROIBIDO repetir a mesma ideia com variações. Se já disse "uma mentira de 500 anos",
  NÃO repita como "uma fake news medieval", "a mesma narrativa secular", etc.
- Cada cena deve avançar o argumento ou adicionar informação NOVA. Se não tem conteúdo novo, a cena não deveria existir.

NÍVEL 2 — Bloco Narrativo: "1 procedimento = 1 sequência"
- Se o dossiê descreve um MÉTODO repetitivo (assassinato, tortura, ritual, fraude),
  descreva o procedimento UMA VEZ em detalhe (4-6 cenas máximo).
- Em recorrências subsequentes, mostre IMPACTO/CONSEQUÊNCIA, não procedimento:
  ❌ Descrever o método do crime novamente cena a cena
  ✅ "O mesmo método. Treze vezes." + mostrar ESCALA (mapa, timeline, contagem)
  ✅ Mostrar quem DESCOBRIU, quem ENCOBRIU, quem LUCROU
  ✅ Cortar para a REAÇÃO (investigador, vítima, sociedade)

NÍVEL 3 — Paráfrase: Detecção de reformulação
- Se 2 cenas transmitem a MESMA informação com palavras diferentes, elimine uma.
- TESTE: "Se eu deletar esta cena, o espectador perde alguma informação?" Se NÃO → deletar.

PREFERÍVEL: 5 cenas devastadoras > 25 cenas repetitivas.

🚨 REGRA DE HOOK CONCEITUAL (CRÍTICO):
- A primeira cena DEVE causar PERPLEXIDADE, nunca REPULSA.
- ❌ "Rasgavam os ligamentos usando gravidade" → gore → swipe por repulsa → algoritmo penaliza
- ✅ "A gravidade virou arma. E a confissão virou produto." → conceito → pausa involuntária
- ❌ "A corda rangiu, apertando o pescoço" → violência explícita → filtro de conteúdo sensível
- ✅ "Um arquivo foi aberto às 3h47 da manhã" → mistério + precisão → curiosidade irresistível

🚨 CURVA EMOCIONAL COM ALTERNÂNCIA (CRÍTICO):
A retenção é máxima quando há CONTRASTE entre cenas. O cérebro reage a MUDANÇAS de estímulo, não a intensidade constante.
- ❌ ERRADO: 9/10 → 9/10 → 9/10 → 9/10 (saturação emocional, fadiga na cena 3)
- ✅ CERTO: 8/10 → 6/10 → 8/10 → 5/10 → 10/10 (cada pico mais forte por causa do respiro)
- NUNCA 3+ cenas consecutivas na mesma intensidade emocional.
- Após revelação intensa, inserir cena de contexto ou respiro visual.
- O PICO MÁXIMO deve ser no último beat de conteúdo (antes do CTA/branding) ou, em vídeos muito longos, na antepenúltima (para permitir “impacto residual” + encerramento).
- Para montar a curva, considere estes tipos: RUPTURA (9-10), REVELAÇÃO (7-8), RESPIRO (5-6), PONTE (6-7), ESCALADA (8-9), IMPACTO (10).

🚨 MECANISMO > SINTOMA (PRINCÍPIO FUNDAMENTAL):
Quando a narrativa envolve violência, injustiça ou material sensível:
- ❌ NÃO mostre o ATO violento → "Sob tortura de squassada, os judeus descreveram rituais"
- ✅ MOSTRE o SISTEMA → "A xilogravura de 1475 espalhou a história pela Europa" (mecanismo de propagação)
- ✅ MOSTRE quem AUTORIZOU → "A assinatura era de Hinderbach" (responsável pelo sistema)
- ✅ MOSTRE quem LUCROU → "O bispo confiscou os bens da comunidade" (beneficiário)
- ✅ MOSTRE como VIAJOU NO TEMPO → "Séculos depois, o mesmo rosto circulava online" (cadeia de transmissão)
- O espectador que vê tortura sente REPULSA e passa. O que vê o SISTEMA sente INDIGNAÇÃO e COMPARTILHA.
- Visuais devem ser ATMOSFÉRICOS (documentos, selos, impressões, sombras) — nunca gráficos/sangrentos.

🚨 PATTERN INTERRUPT VISUAL (OBRIGATÓRIO):
- Se o roteiro tem 8+ cenas, varie o sceneEnvironment. NÃO coloque todas as cenas no mesmo ambiente.
- A cada 5-6 cenas no mesmo ambiente, insira 1 cena com ambiente DIFERENTE (documento, exterior, multidão, etc.)
- Monotonia visual = fadiga = queda de retenção.

🚨 CTA POR COMPULSÃO (NÃO POR PEDIDO — PARA SHORTS/TEASERS):
- O melhor CTA é quando o espectador NÃO PERCEBE que é CTA.
- ❌ "Inscreva-se para descobrir!" / "Siga The Gap Files para revelar..." (pedido explícito → algoritmo sabe que o conteúdo acabou)
- ❌ "...se tiver estômago" / "...se aguenta a verdade" (excludente, reduz compartilhamento)
- ✅ "A verdade está nos arquivos." / "Da imprensa à internet, a mesma mentira atravessou séculos." (compulsão — o espectador vai ao perfil por necessidade, não por pedido)
- Para HOOK-ONLY: ZERO CTA/branding. Corte seco. Sem convite. Sem explicação.
- Para GATEWAY/DEEP-DIVE: Frase-tese poderosa que encerra + menção orgânica ao canal.
- Para FULL VIDEO (YouTube longo): Convite direto mas orgânico é ESPERADO e benéfico. Use frase-tese + convite natural ("Se essa história te fez pensar, se inscreva no The Gap Files"). Em vídeos longos, o espectador espera ser convidado — a ausência parece um descuido.

🚨 TRANSIÇÃO ENTRE EPISÓDIOS (SÉRIE — quando episodeNumber presente):
- Se este é um episódio de série (EP1, EP2...) e NÃO é o último episódio:
  - As últimas 2-3 cenas ANTES do CTA devem funcionar como TEASER do próximo episódio.
  - Crie tensão usando os open loops / ganchos abertos do outline (perguntas sem resposta).
  - Formato ideal: (1) Encerrar o arco do EP atual → (2) Levantar a pergunta que abre o próximo EP → (3) CTA com menção à continuação ("No próximo episódio do The Gap Files...").
  - ❌ NÃO revele o conteúdo do próximo EP — apenas provoque.
  - ✅ Use: "Mas o que ninguém esperava..." / "A resposta para isso... só no próximo episódio." / "Essa história está longe de acabar."
- Se este é o ÚLTIMO episódio da série (EP3): Feche TODOS os arcos. Conclusão satisfatória + CTA padrão.

🚨 SHAREABILITY (PROJETAR PARA COMPARTILHAMENTO):
- Todo roteiro DEVE ter pelo menos 1 "frase-tese" que funciona como screenshot/quote compartilhável.
- Ex: "Da imprensa à internet, a mesma mentira atravessou séculos" → o espectador quer mandar pra alguém.
- Inclua pelo menos 1 fato surpreendente com NÚMERO CONCRETO (credibilidade = share).
- Para pontes temporais, use transições visuais fortes (pergaminho → tela digital).

---
🔬 TÉCNICAS NARRATIVAS AVANÇADAS (INTELIGÊNCIA NARRATIVA):

1. DESCONSTRUÇÃO FORENSE ("O Gap Revelado"):
   Quando a pesquisa apresenta uma narrativa oficial vs. evidências que a contradizem:
   - Apresente a "versão aceita" primeiro, depois introduza a dúvida com PATTERN INTERRUPT ("Mas os registros contam outra história...")
   - Desmonte com EVIDÊNCIAS ESPECÍFICAS (datas, nomes, contradições documentais)
   - Nunca diga "é mentira" — deixe as evidências falar. O espectador CONCLUI sozinho
   - Essa é a essência do The Gap Files: o "gap" entre a versão oficial e a verdade forense

2. CRONOLOGIA MULTI-ERA:
   Quando a pesquisa cobre séculos ou múltiplas eras:
   - Cada era funciona como um MINI-ATO com gancho e revelação próprios
   - Use TRANSIÇÕES VISUAIS que conectam eras (xilogravura → post digital, pergaminho → tela)
   - ❌ Evite transições genéricas: "Avance 500 anos..."
   - ✅ Use objetos que viajam no tempo: "A mesma imagem, agora numa tela de computador"
   - Mostre a CADEIA DE TRANSMISSÃO: como a ideia/mito viajou e se transformou

3. TEIA DE PERSONAGENS (3+ figuras):
   - Introduza cada personagem com FRASE-ÂNCORA (ex.: "Hinderbach, o bispo que viu uma oportunidade")
   - Para shorts/teasers: use FUNÇÕES em vez de nomes obscuros ("o bispo", "o juiz", "o médico")
   - Para vídeos longos: use nomes com frase-âncora na introdução
   - Distribua aparições — não introduza todos de uma vez

4. DADOS COMPARATIVOS:
   - NÃO leia a tabela — NARRATIVIZE o padrão mais impactante
   - Formato ideal: "Em Norwich, ficou esquecido. Em Trento, virou propaganda. Em Damasco, virou crise internacional."

5. MATERIAL SENSÍVEL (Protocolo de Mecanismo):
   Com temas de tortura, perseguição, genocídio ou injustiça:
   - SISTEMA > SINTOMA — foque em quem ordenou, quem lucrou, qual documento legitimou
   - Descrições visuais: DOCUMENTOS, SELOS, IMPRESSÕES, ASSINATURAS — nunca gore/sangue
   - ❌ "Close de corda no pescoço" → ✅ "Close de selo sendo quebrado em documento"
   - ❌ "Corpo sendo torturado" → ✅ "Mão assinando sentença, moedas ao lado"
   - ❌ "Sangue em pedra" → ✅ "Tinta escorrendo em xilogravura na prensa"

---
DIRETRIZES TÉCNICAS (CRÍTICO):
- SINCRONIA: Cada cena DEVE durar EXATAMENTE 5 segundos de narração.
- 🌐 IDIOMA: O campo \\"narration\\" DEVE ser escrito no IDIOMA DO VÍDEO (definido na request). Os campos \\"visualDescription\\", \\"motionDescription\\" e \\"audioDescription\\" DEVEM ser SEMPRE em inglês. NUNCA misture — narração no idioma do vídeo, campos técnicos em inglês.
- DENSIDADE OBRIGATÓRIA: Com base na velocidade de fala (${targetWPM} WPM), cada cena DEVE conter entre ${wordsPerScene - 1} e ${maxWordsHard} palavras. A conta é: ${targetWPM} WPM ÷ 60 × 5s = ${wordsPerScene} palavras ideais.
- 🚨 HARD LIMIT: NUNCA exceda ${maxWordsHard} palavras por cena. Cenas com mais de ${maxWordsHard} palavras ultrapassam 5 segundos e quebram a sincronia do vídeo.
- PROIBIDO FRASES CURTAS: Cenas com menos de ${wordsPerScene - 1} palavras geram "buracos" no áudio. Expanda com adjetivos, detalhes sensoriais ou contexto.
- FLUIDEZ: O texto deve preencher exatamente 5 segundos de fala contínua. Nem mais, nem menos.
- SOUND DESIGN: Descreva a atmosfera sonora (SFX/Ambience) em inglês técnico para cada cena.
- MÚSICA DE FUNDO: Use "backgroundMusic" para vídeos curtos (YouTube Shorts) ou "backgroundMusicTracks" para vídeos longos (YouTube). O campo "prompt" deve ser compatível com Stable Audio 2.5 (gênero, instrumentos, BPM, mood). O campo "volume" (dB) será aplicado via FFmpeg na mixagem.
- CAMADA SENSORIAL: Nas descrições visuais, inclua sentimentos, texturas e atmosfera.
- 🔗 SINCRONIZAÇÃO NARRATIVA — VISUAL — MOTION (REGRA MAIS IMPORTANTE DO PIPELINE):
  O pipeline gera: (1) imagem a partir do visualDescription, (2) vídeo animado (motion) a partir dessa imagem usando motionDescription. Os 2 campos + a narração DEVEM ser UM ÚNICO MOMENTO NARRATIVO COERENTE.

  🚨 NARRAÇÃO GOVERNA O VISUAL: O visualDescription DEVE representar visualmente O QUE A NARRAÇÃO ESTÁ DIZENDO naquela cena.
  - Se a narração diz "O bispo assinou a sentença", o visual DEVE mostrar: um documento sendo assinado, um selo episcopal, uma pena sobre pergaminho.
  - ❌ PROIBIDO: Narração fala de "bispo assinou sentença" mas visualDescription mostra "a candle on a wooden table" (DESCONEXO)
  - ❌ PROIBIDO: Narração fala de "confisco de bens" mas visualDescription mostra "fog drifting over a lake" (ATMOSFÉRICO SEM RELAÇÃO)
  - ✅ CORRETO: Narração "O bispo assinou" → visualDescription "Wide shot of a dark study, sealed document on desk, episcopal wax seal catching candlelight, quill pen resting beside ink pot"
  PERGUNTA-TESTE: "Se alguém VÊ esta imagem e OUVE esta narração juntos, faz sentido imediato?" Se NÃO → reescreva.

- 🎬 MOTION DESCRIPTION (motionDescription — OBRIGATÓRIO): Cada cena DEVE ter um campo "motionDescription" com instruções de MOVIMENTO em inglês para o modelo image-to-video. Este prompt descreve O QUE SE MOVE, não o que existe (a imagem já contém isso). REGRAS: (1) Foque em movimentos de CÂMERA (slow dolly forward, gentle pan left, subtle tilt up, slow zoom in) e SUJEITO (flames flickering, water rippling, dust floating, wind moving fabric, shadows shifting). (2) Mantenha entre 15-40 palavras — prompts curtos e diretos funcionam melhor. (3) NÃO repita a descrição visual — o modelo já vê a imagem. (4) Combine 1 movimento de câmera + 1-2 elementos animados. (5) Use verbos de ação: flickering, drifting, swaying, rippling, shifting, crawling, floating. (6) 🚨 ALINHAMENTO COM NARRAÇÃO: O motion deve refletir a AÇÃO narrada. Se a narração fala de "assinar", o motion pode incluir "hand shadow moving across document" ou "quill settling on parchment".
  EXEMPLOS:
  - "Slow dolly forward toward desk, candle flames gently swaying"
  - "Gentle camera drift to the right, dust particles floating"
  - "Static wide shot with subtle breathing motion, torch flames dancing, shadows crawling"
  - "Slow push-in on the document, smoke wisps rising from cooling wax"

- 🎨 AMBIENTE DA CENA (sceneEnvironment — OBRIGATÓRIO): Cada cena DEVE ter um campo "sceneEnvironment" com um identificador curto em snake_case (inglês) do ambiente/locação. Exemplos: "bishop_study", "canal_dawn", "courtroom_trento", "ocean_surface". REGRAS: (1) Cenas consecutivas que ocorrem no MESMO local devem ter o MESMO sceneEnvironment. (2) Quando a narrativa muda de local, o sceneEnvironment DEVE mudar. (3) Isso é usado automaticamente pelo pipeline para injetar continuidade visual entre cenas — NÃO inclua prefixos de estilo no visualDescription, eles serão adicionados pelo sistema.
- 🎨 COERÊNCIA CROMÁTICA (CRÍTICO): As cores descritas no visualDescription de cada cena DEVEM ser compatíveis com a paleta base do estilo visual definido. Se o estilo é amber/noir, não descreva céus violeta ou vegetação verde vibrante — use tons compatíveis (amber-grey sky, muted dark tones). As cores naturais do ambiente devem ALINHAR-SE com a paleta do estilo, não competir com ela.
- PERSONAGENS: Quando houver personagens recorrentes na narrativa, use SEMPRE os nomes (ou um descritor consistente, ex.: "the detective", "Maria") no visualDescription em todas as cenas em que aparecem. Isso reduz variação entre cenas e ajuda a manter coerência visual (ex.: "John standing by the window" em vez de "a man by the window").
- CONSISTÊNCIA VISUAL DE PERSONAGENS: Quando o dossiê fornecer visualDescription para personagens-chave, incorpore EXATAMENTE esses descritores visuais no visualDescription de cada cena onde o personagem aparece. Isso garante que o modelo de imagem mantenha a mesma aparência entre cenas.
- MULTIMODALIDADE: Se imagens forem fornecidas, analise-as para garantir consistência visual.
- 🚫 ANATOMIA SEGURA (CRÍTICO): Modelos de imagem geram anomalias em mãos (dedos extras, fundidos, faltando) e rostos detalhados. Para EVITAR isso nas visualDescriptions: (1) NUNCA descreva close-ups de mãos, dedos ou pés — prefira silhuetas, sombras projetadas, objetos em foco com mãos desfocadas ou cortadas pelo enquadramento; (2) Para rostos, prefira: perfil parcial, contraluz/silhueta, rosto em sombra com apenas maxilar ou olhos iluminados, planos médios/abertos onde o rosto não é o foco; (3) Quando mãos/rostos forem inevitáveis, use distância (medium/wide shot) em vez de close-up; (4) Alternativas visuais potentes: sombra de uma mão sobre documento, luvas, mãos escondidas em mangas, objetos segurados em primeiro plano com mãos desfocadas atrás.
- CENAS DE ENCERRAMENTO (CTA — OBRIGATÓRIO): As últimas cenas DEVEM: (1) Encerrar com frase-tese poderosa e compartilhável; (2) A história narrativa deve estar COMPLETAMENTE encerrada antes do CTA; (3) Para shorts/teasers: prefira compulsão ("A verdade está nos arquivos.") a pedido ("Inscreva-se!"); (4) Para vídeos longos: convite orgânico + branding; (5) Para EPISÓDIOS de série (não último EP): incluir 2-3 cenas de teaser do próximo episódio ENTRE a conclusão e o CTA — use ganchos abertos e perguntas provocativas.
  - Exceção: HOOK-ONLY não tem CTA/branding. É corte seco no pico + loop infinito.

🎙️ AUDIO TAGS (SSML STANDARD — ELEVENLABS):
Use tags de controle de áudio para dar vida à narração. A IA lê rápido demais se você não pausar.
- Pausa Curta (Respiro/Vírgula): <break time="0.3s" />
- Pausa Média (Ponto final): <break time="0.75s" />
- Pausa Dramática (Tensão): <break time="1.5s" />
- Silêncio Absoluto (Fim): <break time="2.5s" />
- Ritmo Rápido (Urgência): <prosody rate="115%">...</prosody>
- Ritmo Lento (Solenidade): <prosody rate="85%">...</prosody>
- USE EXPLICITAMENTE essas tags no campo "narration". Não use reticências (...) para pausas longas.

🛡️ BRAND SAFETY & GORE (FILTRO FINAL):
- PROIBIDO: Palavras como "Assassinato", "Estupro", "Pedofilia", "Mutilado", "Tripas", "Poça de Sangue".
- SUBSTITUA POR: "Fim Trágico", "Ato Imperdoável", "Crimes contra Inocentes", "Cena Marcada", "Fragmentado".
- VISUAL: Nunca descreva corpos mutilados ou sangue. Foque na ATMOSFERA (sombras, documentos, objetos pessoais deixados para trás).

${musicInstructions}

---
${visualInstructions}`
}

// =============================================================================
// USER PROMPT
// =============================================================================

export type ProviderHint = 'openai' | 'gemini' | 'anthropic' | 'groq'

export function buildUserPrompt(request: ScriptGenerationRequest, providerHint?: ProviderHint): string {
  const targetWPM = request.targetWPM || 150
  const wordsPerScene = Math.round((targetWPM / 60) * 5) // 150 WPM = 12-13 palavras por 5s
  const minWords = wordsPerScene - 1
  const maxWords = wordsPerScene + 2 // Hard limit para não ultrapassar 5s
  const idealSceneCount = request.targetSceneCount ?? Math.ceil(request.targetDuration / 5)
  const maxExtraScenes = 4 // margem para concluir a história e CTA sem cortar frase
  const maxSceneCount = idealSceneCount + maxExtraScenes

  // Determinar formato do vídeo
  const videoFormat = request.format || request.outputType || 'full-youtube'
  const isShortFormat = videoFormat.includes('tiktok') || videoFormat.includes('reels') || videoFormat.includes('teaser') || videoFormat.includes('shorts')
  const isYouTubeCinematic = videoFormat.includes('youtube') || videoFormat.includes('full')

  let formatContext = ''
  if (isShortFormat) {
    formatContext = `\n\n📱 FORMATO DO VÍDEO: YouTube Shorts (vídeo curto, 15-180s)
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

  // Diretrizes de identidade visual do universo do dossiê (Warning Protocol)
  if (request.visualIdentityContext) {
    baseInstruction += `\n\n🎨 DIRETRIZES DE IDENTIDADE DO UNIVERSO (WARNING PROTOCOL):\n${request.visualIdentityContext}`
  }

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

  // Fontes do dossiê (arquitetura flat/democratizada, com priorização por peso)
  const allSources = request.sources || request.additionalSources || []
  if (allSources.length > 0) {
    // Ordenar por peso (maior prioridade primeiro)
    const sortedSources = [...allSources].sort((a, b) => ((b as any).weight || 1) - ((a as any).weight || 1))

    baseInstruction += `\n\n📚 FONTES DO DOSSIÊ (BASE NEURAL):`

    // Hint de síntese inteligente para fontes densas
    const totalContentLength = sortedSources.reduce((acc, s) => acc + (s.content?.length || 0), 0)
    if (totalContentLength > 5000) {
      baseInstruction += `\n⚠️ MATERIAL DENSO DETECTADO: Você recebeu pesquisa extensa. NÃO tente cobrir tudo linearmente — identifique os 5-7 BEATS NARRATIVOS mais impactantes (contradições, revelações, dados surpreendentes, conexões temporais) e construa o roteiro em torno deles. Fatos secundários podem ser condensados ou omitidos se não servem à narrativa.`
    }

    sortedSources.forEach((source, index) => {
      const weight = (source as any).weight || 1
      const weightLabel = weight >= 1.5 ? ' ⭐ PRIORIDADE ALTA' : weight <= 0.5 ? ' 📎 COMPLEMENTAR' : ''
      baseInstruction += `\n[📄 FONTE ${index + 1}] (${source.type}${weightLabel}): ${source.title}\n${source.content}\n---`
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

  // Papel narrativo do item de monetização (governa profundidade de contextualização)
  console.log(`[ScriptPrompt] 🎭 narrativeRole=${request.narrativeRole || 'NENHUM'}, strategicNotes=${request.strategicNotes ? 'sim' : 'não'}`)
  if (request.narrativeRole) {
    const roleInstructions: Record<string, string> = {
      'gateway': `🚪 PAPEL NARRATIVO: GATEWAY (PORTA DE ENTRADA)
Este vídeo é o PRIMEIRO CONTATO do espectador com o tema. DEVE contextualizar COMPLETAMENTE:
- Quem são as pessoas envolvidas
- Quando e onde aconteceu
- O que está em jogo
- Por que o espectador deveria se importar
O espectador NUNCA ouviu falar sobre este assunto. Trate como uma história sendo contada pela primeira vez.

🚨 RESOLUÇÃO PARCIAL — Este teaser é TOPO DE FUNIL:
- Contextualiza DO QUE se trata, mas NÃO entrega a conclusão final
- NÃO explique a causa real/científica do evento
- NÃO revele a motivação completa dos envolvidos
- NÃO dê conclusão moral fechada
- DEIXE pelo menos 1-2 perguntas sem resposta — o espectador deve QUERER assistir o Full Video
- Termine apontando para algo MAIOR que não foi explorado`,
      'deep-dive': `🔍 PAPEL NARRATIVO: DEEP-DIVE (MERGULHO DIRETO)
🚨 REGRA CRÍTICA: Este vídeo NÃO É introdutório. O espectador JÁ CONHECE o tema básico.
- NO MÁXIMO 1 frase de contextualização superficial (quem/onde/quando)
- NÃO recontar a história desde o início
- NÃO explicar o cenário histórico/geográfico básico
- Comece DIRETO pelo ângulo específico do hook
- Mergulhe IMEDIATAMENTE no aspecto que torna este vídeo único
- A contextualização mínima (se necessária) deve estar numa ÚNICA cena, nunca 2+
EXEMPLO DO QUE NÃO FAZER: Se o hook é sobre uma confissão sob tortura, NÃO comece com "Trento, 1475. Um menino..." — comece pela tortura/confissão.

🚨 RESOLUÇÃO MÍNIMA — Este teaser é TOPO DE FUNIL:
- Revela um aspecto profundo mas NÃO fecha o caso inteiro
- O detalhe revelado deve ABRIR mais perguntas, não fechá-las
- DEIXE pelo menos 1-2 perguntas sem resposta
- Termine com contradição ou evidência que gera MAIS dúvidas`,
      'hook-only': `💥 PAPEL NARRATIVO: HOOK-ONLY (ARMA VIRAL)
🚨 REGRAS ABSOLUTAS QUE GOVERNAM ESTE ROTEIRO:

RUPTURA EM 2 SEGUNDOS: A primeira cena DEVE causar ruptura cognitiva — o scroll para. Nada de construção antes do choque.
- ❌ "Em uma cidade da Itália..." / "Há muitos séculos..." (construção)
- ✅ "Uma criança morta. Uma confissão forjada. Ninguém sabe quem." (ruptura)

1 CONCEITO CENTRAL: Todo o roteiro gira em torno de UMA ideia resumível em 1 frase. Se exige conectar 3+ entidades para entender, está denso demais.

ANTI-FILLER (DENSIDADE): Em hook-only, cada cena é cara. PROIBIDO gastar 1 cena com poesia/atmosfera vazia.
- Cada cena deve conter pelo menos 1 elemento informacional CONCRETO:
  • AGENTE/função ("o bispo", "o tribunal", "o impressor")
  • ARTEFATO ("selo", "decreto", "livro", "registro", "xilogravura")
  • AÇÃO de mecanismo ("assinou", "autorizou", "confiscou", "financiou", "publicou")
  • CONSEQUÊNCIA concreta (sem gore): "confisco", "propaganda", "viralização", "enriquecimento"
- ❌ Errado (filler): "Um selo dourado pisca, como um sussurro na escuridão."
- ✅ Certo (respiro com conteúdo): "O selo autorizou o confisco. E ninguém assinou por engano."

CURVA EMOCIONAL COM PICO FINAL: Em **4 cenas (sem CTA)**, use alternância (high → pause → high → peak). O cérebro reage a MUDANÇAS, não a intensidade constante.
- ✅ CERTO (conteúdo): 9 → 6 → 9 → 10 (alternância com pico na ÚLTIMA cena)
- ❌ ERRADO: 9 → 9 → 9 → 9 (platô) ou 9 → 10 → 10 → 10 (saturação)

NOMES UNIVERSAIS: Use funções ("o bispo", "o juiz", "o médico"), não nomes históricos obscuros (Hinderbach, Tiberino). Se o público não reconhece o nome em 1 segundo, use a função.

MECANISMO > SINTOMA: Mostre o SISTEMA (quem autorizou, quem lucrou, qual documento), não a violência em si. Conceito > gore.

RESOLUÇÃO ZERO — PURA PROVOCAÇÃO:
- NENHUMA explicação, recap, conclusão moral ou reflexão filosófica
- NÃO responda NENHUMA pergunta levantada — TODOS os loops ficam abertos
- ❌ "alimentando ódio milenar sem fim" (conclusão moral = resolução)
- ❌ "a verdade é que..." / "na realidade..." (explicação)

CTA/BRANDING (PROIBIDO):
- NÃO inclua "The Gap Files." em nenhuma cena.
- NÃO inclua convite ("siga", "inscreva-se", "curta", "comente", "compartilhe").
- O “mecanismo de retenção” é o Loop Infinito, não CTA.

REPLAY BAIT: Pelo menos 1 cena com detalhe visual/narrativo rápido demais para absorver. Força re-assistir.

DURAÇÃO: **4 cenas** (**16-22 segundos**). Cada cena é um soco cognitivo. Máximo absoluto: **5 cenas**.`
    }

    baseInstruction += `\n\n${roleInstructions[request.narrativeRole] || ''}`
  }

  // Notas estratégicas do plano de monetização
  if (request.strategicNotes) {
    baseInstruction += `\n\n💡 NOTAS ESTRATÉGICAS DO PLANO DE MONETIZAÇÃO:\n${request.strategicNotes}\nUse essas notas para guiar o tom, a intensidade e os pontos de ênfase do roteiro.`
  }

  // Anti-padrões do monetizador (instruções de "O que NÃO fazer")
  if (request.avoidPatterns && request.avoidPatterns.length > 0) {
    baseInstruction += `\n\n⛔ O QUE NÃO FAZER (ANTI-PADRÕES INVIOLÁVEIS do plano de monetização):\n`
    request.avoidPatterns.forEach((pattern, i) => {
      baseInstruction += `${i + 1}. ${pattern}\n`
    })
    baseInstruction += `\n🚨 As instruções acima são INVIOLÁVEIS. Se qualquer cena do seu roteiro viola um desses anti-padrões, REESCREVA a cena antes de finalizar.`
  }

  // Contexto de episódio (série) — governa transições e teasers entre EPs
  if (request.episodeNumber && request.totalEpisodes) {
    const isLastEpisode = request.episodeNumber >= request.totalEpisodes
    baseInstruction += `\n\n📺 CONTEXTO DE SÉRIE — EPISÓDIO ${request.episodeNumber} de ${request.totalEpisodes}`
    if (!isLastEpisode) {
      baseInstruction += `\n🔴 TRANSIÇÃO OBRIGATÓRIA: Este NÃO é o último episódio. As últimas 2-3 cenas antes do CTA DEVEM funcionar como teaser do EP${request.episodeNumber + 1}.`
      baseInstruction += `\n- Use os ganchos abertos (open loops) do outline para criar tensão.`
      baseInstruction += `\n- Provoque o próximo episódio sem revelar seu conteúdo.`
      baseInstruction += `\n- O CTA deve mencionar a continuação: "No próximo episódio do The Gap Files..." ou similar.`
    } else {
      baseInstruction += `\n🏁 EPISÓDIO FINAL: Feche TODOS os arcos narrativos. Conclusão satisfatória + CTA padrão.`
    }
  }

  if (request.additionalContext) {
    baseInstruction += `\n\n➕ CONTEXTO ADICIONAL:\n${request.additionalContext}`
  }

  let guidelines = ''
  if (request.mustInclude) guidelines += `\n- DEVE INCLUIR: ${request.mustInclude}`
  if (request.mustExclude) guidelines += `\n- NÃO PODE CONTER: ${request.mustExclude}`

  let musicWarning = ''
  if (isShortFormat) {
    musicWarning = `\n\n🚨 REGRA CRÍTICA DE MÚSICA DE FUNDO (YouTube Shorts):
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

  // Itens de validação específicos por provider
  let providerSpecificItems = ''
  if (providerHint === 'gemini') {
    providerSpecificItems = `\n9. 💎 GEMINI SPECIAL: Aproveite sua capacidade de contexto estendida para garantir continuidade perfeita entre cenas, evitando repetições e contradições.`
  }

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
8. 🚫 ANTI-REPETIÇÃO: Antes de finalizar, releia TODAS as cenas de reflexão. Se duas cenas expressam a mesma ideia com palavras diferentes, ELIMINE uma e redistribua o conteúdo para o corpo factual. Cada cena de reflexão deve trazer um ARGUMENTO ÚNICO e INÉDITO.${providerSpecificItems}
${guidelines}${musicWarning}

🛡️ VALIDAÇÃO FINAL OBRIGATÓRIA:
Antes de retornar o JSON, faça esta auditoria interna:
1. CONTE as cenas totais — deve estar entre ${idealSceneCount} e ${maxSceneCount}.
2. CONTE as cenas de reflexão/lição (após o corpo factual) — deve ser ≤${maxReflectionCeiling} cenas.
3. PROCURE repetições temáticas — se encontrar, ELIMINE e COMPACTE.
4. A última cena de conteúdo deve terminar com frase completa.
5. As últimas 1-2 cenas devem ser conclusão + CTA (seguir canal + The Gap Files).
6. 🔗 SINCRONIZAÇÃO NARRAÇÃO ↔ VISUAL (CHECAR CENA POR CENA): Para CADA cena, a narração fala de X — o visualDescription MOSTRA X visualmente? Se a narração fala de "bispo assinou", o visual mostra assinatura/documento/selo? Se NÃO → REESCREVA o visualDescription.
7. 🔗 MOTION ↔ VISUAL: O motionDescription descreve movimento coerente com o visualDescription? O motion anima elementos que existem na imagem? Se incompatível → REESCREVA.
8. 📺 TRANSIÇÃO DE EPISÓDIO: Se episodeNumber < totalEpisodes, as últimas 2-3 cenas ANTES do CTA devem provocar o próximo episódio (teaser/gancho). Se não houver teaser → ADICIONE.`
}

// =============================================================================
// PARSE RESPONSE
// =============================================================================

export function parseScriptResponse(
  content: ScriptResponse,
  request: ScriptGenerationRequest,
  providerName: string,
  modelName: string,
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number }
): ScriptGenerationResponse {
  const scenes: ScriptScene[] = content.scenes.map((scene, index) => ({
    order: scene.order ?? index + 1,
    narration: scene.narration,
    visualDescription: scene.visualDescription,
    sceneEnvironment: scene.sceneEnvironment ?? undefined,
    motionDescription: scene.motionDescription ?? undefined,
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
    provider: providerName,
    model: modelName,
    usage: tokenUsage,
    costInfo: {
      cost: calculateLLMCost(modelName, usage.inputTokens, usage.outputTokens),
      provider: providerName,
      model: modelName,
      metadata: {
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens
      }
    }
  }
}

// =============================================================================
// IMAGE PROCESSING (Multimodal)
// =============================================================================

/**
 * Processa imagens da request e retorna array de content parts para LangChain.
 * Usado por todos os providers para injetar imagens no contexto multimodal.
 */
export function processImagesForLangChain(
  images: ScriptGenerationRequest['images'],
  logPrefix: string
): Array<{ type: 'image_url'; image_url: { url: string; detail?: string } }> {
  if (!images || images.length === 0) return []

  console.log(`${logPrefix} 👁️ Injetando ${images.length} imagens no contexto multimodal...`)

  const parts: Array<{ type: 'image_url'; image_url: { url: string; detail?: string } }> = []

  images.forEach((img, idx) => {
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
      console.warn(`${logPrefix} ⚠️ Falha ao converter imagem ${idx}. Erro: ${e}`)
    }

    if (!base64Data) {
      console.warn(`${logPrefix} ⚠️ Imagem ${idx} ignorada: falha na extração de dados. Tipo: ${typeof img.data}`)
      if (typeof img.data === 'object') {
        try {
          const preview = JSON.stringify(img.data).slice(0, 100)
          console.warn(`${logPrefix} 🔍 Preview do objeto de dados: ${preview}...`)
        } catch { }
      }
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
      console.warn(`${logPrefix} ⚠️ Imagem ${idx} ignorada: formato não suportado (${mimeType}). Permitidos: ${validMimeTypes.join(', ')}`)
      return
    }

    parts.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64Data}`
      }
    })
  })

  return parts
}

// =============================================================================
// FALLBACK PARSER (Zod v4 Compat)
// =============================================================================

/**
 * Tenta extrair e validar JSON de uma resposta raw quando withStructuredOutput falha.
 * Necessário por incompatibilidade Zod v4 + LangChain em alguns providers.
 */
export function fallbackParseRawResponse(rawMessage: any, logPrefix: string): ScriptResponse | null {
  // Tentativa 1: Extrair de tool_calls (Anthropic function calling)
  const toolCalls = rawMessage?.tool_calls || rawMessage?.lc_kwargs?.tool_calls
  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    const firstTool = toolCalls[0]
    const toolData = firstTool?.args || firstTool?.input

    // Debug: logar estrutura real
    console.log(`${logPrefix} 🔍 tool_calls[0] keys:`, Object.keys(firstTool || {}))
    if (toolData) {
      const toolKeys = Object.keys(toolData)
      console.log(`${logPrefix} 🔍 toolData keys (${toolKeys.length}):`, toolKeys.slice(0, 10))
      console.log(`${logPrefix} 🔍 toolData preview (500 chars):`, JSON.stringify(toolData).substring(0, 500))
    }

    if (toolData) {
      try {
        const validated = ScriptResponseSchema.parse(toolData)
        console.log(`${logPrefix} ✅ Fallback parse bem sucedido (tool_calls)`)
        return validated
      } catch (parseError: any) {
        // Se parse direto falhou, tentar com dados nested
        // O Claude pode retornar { extract: { title, summary, scenes } }
        const nestedData = toolData?.extract || toolData?.output || toolData?.result || toolData?.response
        if (nestedData) {
          try {
            const validated = ScriptResponseSchema.parse(nestedData)
            console.log(`${logPrefix} ✅ Fallback parse bem sucedido (tool_calls nested)`)
            return validated
          } catch (nestedError) {
            console.error(`${logPrefix} ❌ tool_calls nested parse também falhou`)
          }
        }
        console.error(`${logPrefix} ❌ tool_calls parse falhou:`, parseError?.issues || parseError)
      }
    }
  }

  // Tentativa 1b: Extrair de additional_kwargs (Anthropic raw tool_use blocks)
  const additionalKwargs = rawMessage?.additional_kwargs || rawMessage?.lc_kwargs?.additional_kwargs
  if (additionalKwargs?.tool_use) {
    const toolUse = Array.isArray(additionalKwargs.tool_use) ? additionalKwargs.tool_use[0] : additionalKwargs.tool_use
    if (toolUse?.input) {
      try {
        const validated = ScriptResponseSchema.parse(toolUse.input)
        console.log(`${logPrefix} ✅ Fallback parse bem sucedido (additional_kwargs.tool_use)`)
        return validated
      } catch (e) {
        console.error(`${logPrefix} ❌ additional_kwargs.tool_use parse falhou`)
      }
    }
  }

  // Tentativa 2: Extrair de content (text response)
  let rawText = ''
  if (typeof rawMessage?.content === 'string') {
    rawText = rawMessage.content
  } else if (typeof rawMessage?.kwargs?.content === 'string') {
    rawText = rawMessage.kwargs.content
  } else if (Array.isArray(rawMessage?.content)) {
    const textPart = rawMessage.content.find((p: any) => p.type === 'text')
    rawText = textPart?.text || ''
  }

  if (!rawText) {
    console.error(`${logPrefix} ❌ Não foi possível extrair texto da resposta raw.`)
    console.error(`${logPrefix} 🔍 rawMessage keys:`, Object.keys(rawMessage || {}))
    return null
  }

  let cleanJson = rawText.trim()
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  try {
    const parsed = JSON.parse(cleanJson)
    const validated = ScriptResponseSchema.parse(parsed)
    console.log(`${logPrefix} ✅ Fallback manual de parsing bem-sucedido!`)
    return validated
  } catch (parseError) {
    console.error(`${logPrefix} ❌ Fallback de parsing falhou:`, parseError)
    console.error(`${logPrefix} 🔍 Raw (500 chars):`, rawText.substring(0, 500))
    return null
  }
}

// =============================================================================
// TOKEN USAGE EXTRACTOR
// =============================================================================

export function extractTokenUsage(rawMessage: any): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const usage = rawMessage?.usage_metadata || rawMessage?.response_metadata?.usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)
  return { inputTokens, outputTokens, totalTokens }
}
