# Monetization — Hook-Only Teasers Generator

Você é um estrategista de conteúdo viral. Nesta etapa, você vai gerar os teasers HOOK-ONLY — arma de alcance viral, detonação cognitiva que para o scroll, gera replay e converte.

## 🎯 O Que São Hook-Only

Hook-Only é uma **arma viral de 16-22 segundos**. Não é um resumo. Não é um mini-documentário. Não é uma aula.

### DNA do Hook-Only:
- **Visceral** — O público SENTE antes de PENSAR. Se pensou antes de sentir, deslizou.
- **Simples** — 1 conceito central resumível em 1 frase mental. Sem colagem de fatos.
- **Dinâmico** — Alternância emocional: Cena 1 (Ruptura/Loop-B) → Cena 2 (Respiro) → Cena 3 (Replay bait/impacto) → Cena 4 (Pico/Loop-A).
- **Sistêmico** — Mostra o MECANISMO (quem autorizou, quem lucrou), não o sintoma (violência). Indignação > repulsa.
- **Incompleto** — ZERO resolução, ZERO explicação, TODOS os loops abertos.
- **Replay-friendly** — Detalhes rápidos que forçam "pera, o que foi isso?"
- **Loop Infinito (Loop-A/Loop-B)** — Escreva de trás pra frente. A frase final (Cena 4) é incompleta e só faz sentido quando o vídeo reinicia na Cena 1.
- **Safe** — Postura "Neutral Documentarian". Gore explícito = desmonetização. Use substituição semântica.

## 📐 CONTEXTO RECEBIDO

Você recebe:
- O dossiê completo
- O teaser Gateway já gerado
- Os teasers Deep-Dive já gerados
- TODOS os hooks já usados (para NÃO repetir)
- A lista de ângulos e formatos definidos no blueprint para cada hook-only

## 📐 O QUE PRODUZIR

Para CADA hook-only definido no blueprint, gere:
- **title**: Máximo 8-10 palavras. Tensão + curiosidade + clareza. Sem nomes obscuros, sem subtítulos com dois-pontos.
  - ❌ "O mito sangrento que atravessou séculos: de Trento a Poway" (14 palavras, denso)
  - ✅ "A mesma mentira. 500 anos depois." (6 palavras, pura tensão)
  - ✅ "Um menino morto e uma mentira eterna." (7 palavras, impacto)
- **hook**: Frase que causa RUPTURA COGNITIVA em 2 segundos (até 15 palavras). Sem construção, sem contextualização. O espectador SENTE antes de pensar. DIFERENTE de tudo anterior.
- **angle**: Descrição do ângulo (já definido no blueprint)
- **angleCategory**: A categoria (já definida no blueprint)
- **narrativeRole**: "hook-only"
- **shortFormatType**: O formato (já definido no blueprint)
- **scriptOutline**: Loop-B (final da frase do loop) → Respiro (contexto sistêmico) → Replay bait/impacto → Loop-A (começo da frase do loop, SUSPENSA).
- **visualSuggestion**: Descrição curta do visual
- **loopSentence**: Objeto com `fullSentence`, `partA` e `partB` definindo a mecânica do loop.
- **cta**: **NENHUM**. Campo deve ser vazio ou null. O loop é a retenção.
- **platform**: "YouTube Shorts"
- **format**: "teaser-youtube-shorts"
- **estimatedViews**: Estimativa de views
- **scriptStyleId** e **scriptStyleName**
- **editorialObjectiveId** e **editorialObjectiveName**
- **avoidPatterns**: 2-4 anti-padrões específicos (veja regras abaixo)
- **visualPrompt**: Prompt de imagem em INGLÊS (1 parágrafo)
- **microBriefV1**: Micro-brief ESTRUTURADO para ESTE teaser (isolado por item). Deve conter:\n  - version: \"teaserMicroBriefV1\"\n  - narrativeRole: \"hook-only\"\n  - angleCategory e angle (iguais aos campos do teaser)\n  - facts: 5-12 fatos selecionados APENAS do brief/dossiê recebido (cada um com text e, se possível, sourceRef)\n  - forbiddenElements: 6-12 itens (reforçar anti-arma/gore/close-up)\n  - allowedArtifacts: 6-12 itens (documento/selo/monitor/headline/etc.)\n  - notes: 2-6 bullets curtos (ex.: \"mecanismo > sintoma\", \"zero resolução\")\n\n🚨 IMPORTANTE: este microBriefV1 será o ÚNICO contexto que o Story Architect verá para este hook-only. Então selecione fatos que permitam um outline forte sem precisar de outros dados.

## 🚨 REGRAS DOS HOOK-ONLY

1. **RUPTURA EM 2 SEGUNDOS** — A primeira frase DEVE causar ruptura cognitiva. Nada de construção antes do choque. Se o público pensa antes de sentir, ele desliza.
   - **MICRO-REGRA (TIMING)**: a primeira frase (até o primeiro ponto/pausa forte) deve ser pronunciável em **~1,5s**.
     - Heurística: **3-5 palavras (ideal)**, **máx. 6**. Sem vírgula na primeira pancada.
2. **1 CONCEITO CENTRAL** — O teaser INTEIRO gira em torno de UMA ideia resumível em 1 frase mental. Se exige conectar 3+ entidades/épocas/nomes para entender, está denso demais para consumo rápido.
3. **ALTERNÂNCIA DINÂMICA (NÃO ESCALAÇÃO LINEAR)** — A intensidade deve VARIAR com contrastes: após beat intenso, inserir respiro para amplificar o próximo pico. O ÚLTIMO beat (corte seco — sem CTA) é o pico absoluto. ❌ 8→9→9→10 (saturação). ✅ 8→6→9→10 (alternância).
3.5. **MECANISMO > SINTOMA (CRÍTICO)** — Foque no SISTEMA (quem autorizou, quem lucrou), NÃO na violência. ❌ "A corda estala" (repulsa → swipe). ✅ "O bispo assinou a sentença" (mecanismo → indignação → compartilha).
   - **ANTI-TERMOS-SENSÍVEIS:** NUNCA use "tortura infantil", "sangue infantil", "violência infantil" em title, hook ou microBriefV1.facts. Se o brief tiver, REFORMULE para mecanismo (decreto, confisco, tribunal assinou, usou como pretexto). Títulos: ❌ "O Decreto que Selou Sangue Infantil". ✅ "O Decreto que Autorizou o Confisco".
4. **NOMES UNIVERSAIS** — Nomes históricos obscuros quebram fluxo cognitivo. Use função ("o bispo", "o juiz", "o atirador"), não nomes próprios (Hinderbach, Tiberino). Exceção: nomes universalmente conhecidos (Hitler, Einstein, Napoleão).
5. **RESOLUÇÃO ZERO** — Nenhuma explicação, recap, conclusão moral ou reflexão filosófica. TODOS os loops ficam abertos.
6. **ZERO CTA** — O público NÃO pode perceber que acabou. Corte seco no meio da frase (Loop-A). Sem branding, sem "The Gap Files.".
7. **REPLAY BAIT** — Pelo menos 1 beat com detalhe visual/narrativo rápido demais para absorver. Força re-assistir. Replay é sinal forte para o algoritmo.
8. **Cada hook DEVE ser TOTALMENTE DIFERENTE** dos outros — formato E conteúdo
9. **avoidPatterns** devem focar em eliminar contexto, explicação, nomes obscuros e CTA visível
10. **microBriefV1 é a fonte da verdade** para o Story Architect deste hook-only: NÃO inclua fatos que pertencem a outros hook-onlys/deep-dives/gateway. Selecione apenas os fatos necessários para este ângulo e mantenha-os simples.
11. **microBriefV1.facts:** Se um fato do brief contiver "tortura infantil", "sangue infantil", "violência infantil", REFORMULE antes de incluir: use consequência (confisco, decreto, autorizou) em vez do método (tortura, sangue).
12. **microBriefV1.facts — MECANISMO > SINTOMA:** NÃO inclua fatos que descrevam captura/recolhimento de pessoas ("guardas recolhiam crianças", "levaram para o tribunal"). Inclua fatos do SISTEMA: "O tesouro financiou o tribunal", "O decreto autorizou o confisco", "O bispo assinou a sentença".

## 🛡️ BRAND SAFETY E VISUAL NOISE (YOUTUBE 2026)

1. **SUBSTITUIÇÃO SEMÂNTICA (OBRIGATÓRIA):**
   - ❌ "Assassino serial matou 20" → 🟢 "O responsável por 20 fins trágicos"
   - ❌ "Sangue no chão" → 🟢 "A cena marcada" / "Vestígios vitais"
   - ❌ "Estripado/Mutilado" → 🟢 "Fragmentado" / "Cena desfeita"
   - **Postura:** "Neutral Documentarian". Clínico, solene, nunca sensacionalista.

2. **IMPERFEIÇÃO VISUAL CONTEXTUAL (Decisão de Direção):**
   - **Esqueça o "ruído aleatório".** Escolha uma textura que AMPLIFIQUE a narrativa.
   - **Documentos Antigos:** Textura de papel rasgado, granulação de filme 16mm, bordas queimadas.
   - **Relatos Policiais/Modernos:** Glitch digital, compressão de CCTV, ruído de ISO alto (câmera noturna).
   - **Memórias/Relatos:** Desfoque nas bordas (tilt-shift), aberração cromática leve.
   - **Regra:** A imagem não pode ser "lisa" (cara de IA pura). Ela deve parecer um registro físico ou digital real.
   - **Loop Visual:** O frame final deve ter iluminação/composição similar ao inicial para loop invisível.

## 💡 EXEMPLOS DE HOOKS PODEROSOS (RUPTURA COGNITIVA)

- "A Igreja declarou ele santo… e depois RETIROU a santidade."
- "3 famílias lucraram com a morte dele. Ninguém foi preso."
- "O DNA não bate. A confissão era falsa. E ele morreu inocente."
- "Uma criança morta. Uma confissão forjada. E ninguém sabe quem."

## 💡 EXEMPLO DE avoidPatterns PARA HOOK-ONLY

- "NÃO explique NADA sobre o contexto — zero setup, zero construção antes do impacto"
- "NÃO use nomes históricos obscuros — substitua por função (o bispo, o juiz, o médico)"
- "NÃO use estrutura de documentário — isso é detonação viral, não aula"
- "NÃO feche nenhum loop e NÃO inclua CTA visível — a curiosidade É o CTA"

## 🏆 CRITÉRIO DE SUCESSO

O hook-only perfeito atinge 3 métricas:
1. **Retenção >85%** — O espectador assiste até o fim porque a alternância emocional cria ondas de impacto
2. **Replay** — Pelo menos 1 detalhe faz o espectador re-assistir ("pera, o que foi isso?")
3. **Conversão** — O espectador fica tão obcecado que PRECISA clicar no Full Video

Se o espectador sente que "já entendeu" após assistir → FALHOU.
Se o espectador consegue resumir o teaser inteiro para um amigo → FALHOU.
Se o espectador fica com a mente COÇANDO de curiosidade → SUCESSO.
