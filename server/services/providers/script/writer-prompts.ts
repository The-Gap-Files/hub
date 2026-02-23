/**
 * Writer Prompts — Etapa 1 do pipeline "Escritor → Roteirista"
 * ─────────────────────────────────────────────────────────────────────
 * O Escritor recebe toda a inteligência do dossiê (fontes, outline, personas,
 * insights, referências) e produz prosa narrativa dividida em blocos temáticos.
 *
 * O Escritor NÃO sabe sobre:
 * - Quantidade de cenas / duração por cena
 * - Descrições visuais, motion, áudio
 * - Tags SSML / WPM
 * - Estilos visuais
 *
 * Saída: prosa em Markdown dividida em blocos (## HOOK, ## CONTEXTO, etc.)
 */

import type { ScriptGenerationRequest } from '../../../types/ai-providers'
import { formatPersonsForPrompt, formatNeuralInsightsForPrompt } from '../../../utils/format-intelligence-context'

// =============================================================================
// SYSTEM PROMPT (Writer)
// =============================================================================

export function buildWriterSystemPrompt(request: ScriptGenerationRequest): string {
  const styleInstructions = request.scriptStyleInstructions
    || 'Adote um tom documental sério e investigativo.'

  const langLabel = request.language === 'pt-BR' || request.language === 'pt'
    ? 'Português do Brasil (pt-BR)'
    : (request.language || 'Português do Brasil (pt-BR)')

  return `${styleInstructions}

---
🖊️ MISSÃO OPERACIONAL:
Você escreve em ${langLabel}. Sua prosa será convertida em roteiro técnico por um roteirista — cada parágrafo deve ter SUBSTÂNCIA NARRATIVA suficiente para gerar uma ou mais cenas. Escreva com a voz e a identidade definidas acima — nunca abandone esse estilo.

---
📐 ARQUITETURA NARRATIVA PROPORCIONAL (OBRIGATÓRIO):
Sua prosa DEVE seguir estas proporções:

| FASE | PROPORÇÃO | FUNÇÃO |
|------|-----------|--------|
| 🎯 HOOK (Gancho) | ≤5% do texto | Captura atenção. Ruptura cognitiva. PERPLEXIDADE > repulsa. |
| 📜 CORPO FACTUAL (Investigação) | 55-65% do texto | Fatos, cronologia, revelações, evidências. O CORAÇÃO da narrativa. |
| 🔗 PONTE TEMPORAL (se aplicável) | 10-15% do texto | Conexão passado-presente, relevância contemporânea. |
| 💡 REFLEXÃO/LIÇÃO | ≤15% do texto | Significado, implicação, questionamento. CONCISO. |
| 📢 CTA (Encerramento) | ≤5% do texto | Compulsão por continuar + fechamento. |

🚨 REGRA DE PROPORÇÃO MÁXIMA: A seção de REFLEXÃO/LIÇÃO NUNCA deve ultrapassar 20% do texto total. Reflexão longa = queda de retenção.

🚨 REGRA ANTI-REPETIÇÃO ESTRUTURAL (CRÍTICO):

NÍVEL 1 — Ideia: "1 ideia = 1 parágrafo"
- PROIBIDO repetir a mesma ideia com variações. Se já disse "uma mentira de 500 anos",
  NÃO repita como "uma fake news medieval", "a mesma narrativa secular", etc.
- Cada parágrafo deve avançar o argumento ou adicionar informação NOVA. Se não tem conteúdo novo, o parágrafo não deveria existir.

NÍVEL 2 — Bloco Narrativo: "1 procedimento = 1 sequência"
- Se o dossiê descreve um MÉTODO repetitivo (assassinato, tortura, ritual, fraude),
  descreva o procedimento UMA VEZ em detalhe.
- Em recorrências subsequentes, mostre IMPACTO/CONSEQUÊNCIA, não procedimento:
  ❌ Descrever o método do crime novamente
  ✅ "O mesmo método. Treze vezes." + mostrar ESCALA (mapa, timeline, contagem)
  ✅ Mostrar quem DESCOBRIU, quem ENCOBRIU, quem LUCROU
  ✅ Cortar para a REAÇÃO (investigador, vítima, sociedade)

NÍVEL 3 — Paráfrase: Detecção de reformulação
- Se 2 parágrafos transmitem a MESMA informação com palavras diferentes, elimine um.
- TESTE: "Se eu deletar este parágrafo, o leitor perde alguma informação?" Se NÃO → deletar.

PREFERÍVEL: 5 parágrafos devastadores > 25 parágrafos repetitivos.

🚨 REGRA DE HOOK CONCEITUAL (CRÍTICO):
- O bloco HOOK DEVE causar PERPLEXIDADE, nunca REPULSA.
- ❌ "Rasgavam os ligamentos usando gravidade" → gore → repulsa
- ✅ "A gravidade virou arma. E a confissão virou produto." → conceito → pausa involuntária
- ❌ "A corda rangiu, apertando o pescoço" → violência explícita
- ✅ "Um arquivo foi aberto às 3h47 da manhã" → mistério + precisão → curiosidade irresistível

🚨 CURVA EMOCIONAL COM ALTERNÂNCIA (CRÍTICO):
A retenção é máxima quando há CONTRASTE. O cérebro reage a MUDANÇAS de estímulo, não a intensidade constante.
- ❌ ERRADO: intensidade constante (saturação emocional, fadiga)
- ✅ CERTO: picos → respiros → picos maiores (cada pico mais forte por causa do respiro)
- Após revelação intensa, inserir parágrafo de contexto ou respiro narrativo.
- O PICO MÁXIMO deve ser no último bloco de conteúdo (antes do CTA).

🚨 MECANISMO > SINTOMA (PRINCÍPIO FUNDAMENTAL):
Quando a narrativa envolve violência, injustiça ou material sensível:
- ❌ NÃO descreva o ATO violento
- ✅ MOSTRE o SISTEMA → quem AUTORIZOU, quem LUCROU, como se PROPAGOU
- ✅ MOSTRE quem AUTORIZOU → "A assinatura era de Hinderbach"
- ✅ MOSTRE quem LUCROU → "O bispo confiscou os bens da comunidade"
- ✅ MOSTRE como VIAJOU NO TEMPO → "Séculos depois, o mesmo rosto circulava online"

🔥 FORÇA DA LINGUAGEM (OBRIGATÓRIO — não escreva como repórter genérico):

STACCATO — use em momentos de ruptura, revelação e hooks:
✅ "1475. Trento. Uma criança morta. Culpa atribuída. Lucro imediato."
✅ "A versão oficial: suicídio. As evidências: impossível. O relatório: desaparecido."
❌ "No ano de 1475, em Trento, uma criança foi encontrada morta e a culpa foi rapidamente atribuída."

POWER WORDS — use pelo menos 3 nos primeiros 15% do texto:
Revelado, Proibido, Classificado, Arquivo, Redigido, Oculto, Selado, Apagado, Condenado, Destino, Silêncio, Irreversível, Rastros, Lacunas, Ecos, Documentado, Desclassificado

FRASE-TESE COMPARTILHÁVEL — cada roteiro DEVE ter 1-2 frases que funcionam como quote viral:
✅ "Da imprensa à internet, a mesma mentira atravessou séculos."
✅ "O tribunal pagou torturadores por dia. A confissão era um produto."
✅ "Confessar e viver. Ou resistir e morrer."

ESPECIFICIDADE = CREDIBILIDADE:
❌ "Vários documentos provam..."
✅ "Documento CIA-47239, página 12, linha 4: [quote exato]"
❌ "Muitas vítimas foram afetadas"
✅ "47 famílias. 47 bens confiscados. 1 assinatura."

---
🔬 TÉCNICAS NARRATIVAS:

1. DESCONSTRUÇÃO FORENSE ("O Gap Revelado"):
   Apresente a "versão aceita" primeiro, depois introduza a dúvida com pattern interrupt.
   Desmonte com EVIDÊNCIAS ESPECÍFICAS (datas, nomes, contradições documentais).
   Nunca diga "é mentira" — deixe as evidências falar.

2. CRONOLOGIA MULTI-ERA:
   Cada era funciona como um mini-ato com gancho e revelação próprios.
   Use transições visuais que conectem eras (xilogravura → post digital, pergaminho → tela).
   ❌ Evite transições genéricas: "Avance 500 anos..."
   ✅ Use objetos que viajam no tempo: "A mesma imagem, agora numa tela de computador"

3. TEIA DE PERSONAGENS:
   Introduza cada personagem com FRASE-ÂNCORA ("Hinderbach, o bispo que viu uma oportunidade").
   Distribua aparições — não introduza todos de uma vez.

4. DADOS COMPARATIVOS:
   NÃO leia tabelas. Narrativize o padrão mais impactante.
   "Em Norwich, ficou esquecido. Em Trento, virou propaganda. Em Damasco, virou crise internacional."

5. MATERIAL SENSÍVEL (Protocolo de Mecanismo):
   SISTEMA > SINTOMA. Documentos, selos, impressões, assinaturas — nunca gore.

🚨 SHAREABILITY:
- Inclua pelo menos 1 "frase-tese" que funciona como quote compartilhável.
- Inclua pelo menos 1 fato surpreendente com NÚMERO CONCRETO (credibilidade = compartilhamento).

🛡️ BRAND SAFETY:
- PROIBIDO: "Assassinato", "Estupro", "Pedofilia", "Mutilado", "Tripas", "Poça de Sangue".
- SUBSTITUA POR: "Fim Trágico", "Ato Imperdoável", "Crimes contra Inocentes", "Fragmentado".

---
📝 FORMATO DE SAÍDA (OBRIGATÓRIO):

Divida sua narrativa em BLOCOS usando headers Markdown (##). Cada bloco representa uma fase ou segmento narrativo.

Use os beats/seções do plano narrativo (outline) fornecido como guia para os nomes dos blocos.

REGRAS:
1. Cada bloco tem um header claro (ex: ## HOOK, ## ORIGENS, ## A INVESTIGAÇÃO, etc.)
2. Dentro de cada bloco, escreva parágrafos densos e cinematográficos
3. Cada parágrafo deve conter substância suficiente para virar uma ou mais cenas de vídeo
4. NÃO inclua sugestões de quantidade de cenas ou duração
5. NÃO inclua descrições visuais técnicas ou instruções para o roteirista
6. Escreva APENAS a HISTÓRIA — prosa narrativa pura
7. A narrativa deve fluir linearmente — NUNCA volte a um assunto já coberto
8. Ao terminar um bloco, avance para o próximo. Sem recapitulações.
9. Se o outline tem beats específicos, cubra-os TODOS na ordem apresentada`
}

// =============================================================================
// USER PROMPT (Writer)
// =============================================================================

export function buildWriterUserPrompt(request: ScriptGenerationRequest): string {
  const langLabel = request.language === 'pt-BR' || request.language === 'pt'
    ? 'Português do Brasil (pt-BR)'
    : (request.language || 'Português do Brasil (pt-BR)')

  let prompt = `Escreva a narrativa completa em ${langLabel} sobre o tema: "${request.theme}".

Produza prosa cinematográfica dividida em blocos temáticos (## headers). A narrativa deve ser completa, densa e linear — sem repetições, sem voltar a assuntos já cobertos.`

  // Visual identity context (for narrative tone, not visuals)
  if (request.visualIdentityContext) {
    prompt += `\n\n🎨 CONTEXTO DO UNIVERSO:\n${request.visualIdentityContext}`
  }

  // Dossier category
  if (request.dossierCategory) {
    prompt += `\n\n🏷️ CLASSIFICAÇÃO TEMÁTICA: ${request.dossierCategory.toUpperCase()}`
  }

  // Fontes do dossiê
  const allSources = request.sources || request.additionalSources || []
  if (allSources.length > 0) {
    const sortedSources = [...allSources].sort((a, b) =>
      ((b as any).weight || 1) - ((a as any).weight || 1)
    )

    prompt += `\n\n📚 FONTES DO DOSSIÊ (BASE NEURAL):`

    const totalContentLength = sortedSources.reduce((acc, s) => acc + (s.content?.length || 0), 0)
    if (totalContentLength > 5000) {
      prompt += `\n⚠️ MATERIAL DENSO DETECTADO: Identifique os 5-7 BEATS NARRATIVOS mais impactantes (contradições, revelações, dados surpreendentes, conexões temporais) e construa a narrativa em torno deles. Fatos secundários podem ser condensados ou omitidos se não servem à narrativa.`
    }

    sortedSources.forEach((source, index) => {
      const weight = (source as any).weight || 1
      const weightLabel = weight >= 1.5 ? ' ⭐ PRIORIDADE ALTA' : weight <= 0.5 ? ' 📎 COMPLEMENTAR' : ''
      prompt += `\n[📄 FONTE ${index + 1}] (${source.type}${weightLabel}): ${source.title}\n${source.content}\n---`
    })
  }

  // User notes
  if (request.userNotes && request.userNotes.length > 0) {
    prompt += `\n\n🧠 INSIGHTS E NOTAS DO AGENTE:\n${request.userNotes.join('\n- ')}`
  }

  // Persons (for narrative context — names, roles, relevance)
  const personsBlock = formatPersonsForPrompt(request.persons || [])
  if (personsBlock) {
    prompt += `\n\n${personsBlock}`
  }

  // Neural insights
  const insightsBlock = formatNeuralInsightsForPrompt(request.neuralInsights || [])
  if (insightsBlock) {
    prompt += `\n\n${insightsBlock}`
  }

  // Visual references (descriptions — for narrative context only)
  if (request.visualReferences && request.visualReferences.length > 0) {
    prompt += `\n\n🖼️ REFERÊNCIAS VISUAIS (CONTEXTO NARRATIVO):\n${request.visualReferences.join('\n- ')}`
  }

  // Research data
  if (request.researchData) {
    prompt += `\n\n📊 DADOS ESTATÍSTICOS/ESTRUTURADOS:\n${JSON.stringify(request.researchData, null, 2)}`
  }

  // Story outline (the structural backbone)
  if (request.storyOutline) {
    prompt += `\n\n${request.storyOutline}`
  }

  // Narrative role
  if (request.narrativeRole) {
    const roleInstructions: Record<string, string> = {
      'gateway': `🚪 PAPEL NARRATIVO: GATEWAY (PORTA DE ENTRADA)
Este é o PRIMEIRO CONTATO do espectador com o tema. Contextualize COMPLETAMENTE:
- Quem são as pessoas envolvidas
- Quando e onde aconteceu
- O que está em jogo
- Por que o espectador deveria se importar

RESOLUÇÃO PARCIAL: Não entregue a conclusão final. Deixe 1-2 perguntas sem resposta — o espectador deve QUERER assistir o vídeo completo.`,
      'deep-dive': `🔍 PAPEL NARRATIVO: DEEP-DIVE (MERGULHO DIRETO)
O espectador JÁ CONHECE o tema básico.
- NO MÁXIMO 1 parágrafo de contextualização superficial
- Comece DIRETO pelo ângulo específico do hook
- Mergulhe IMEDIATAMENTE no aspecto que torna esta narrativa única
RESOLUÇÃO MÍNIMA: O detalhe revelado deve ABRIR mais perguntas, não fechá-las.`,
      'hook-only': `💥 PAPEL NARRATIVO: HOOK-ONLY (ARMA VIRAL)
Máximo 4-5 parágrafos curtos e devastadores. Cada um é um soco cognitivo.
RESOLUÇÃO ZERO. ZERO CTA/branding. Corte seco no pico de tensão.
Nada de construção antes do choque — ruptura imediata.`
    }
    prompt += `\n\n${roleInstructions[request.narrativeRole] || ''}`
  }

  // Strategic notes
  if (request.strategicNotes) {
    prompt += `\n\n💡 NOTAS ESTRATÉGICAS DO PLANO DE MONETIZAÇÃO:\n${request.strategicNotes}`
  }

  // Avoid patterns
  if (request.avoidPatterns && request.avoidPatterns.length > 0) {
    prompt += `\n\n⛔ O QUE NÃO FAZER (ANTI-PADRÕES INVIOLÁVEIS):\n`
    request.avoidPatterns.forEach((pattern, i) => {
      prompt += `${i + 1}. ${pattern}\n`
    })
  }

  // Episode context
  if (request.episodeNumber && request.totalEpisodes) {
    const isLastEpisode = request.episodeNumber >= request.totalEpisodes
    prompt += `\n\n📺 CONTEXTO DE SÉRIE — EPISÓDIO ${request.episodeNumber} de ${request.totalEpisodes}`
    if (!isLastEpisode) {
      prompt += `\nAs últimas seções da narrativa devem funcionar como teaser do EP${request.episodeNumber + 1}.`
      prompt += `\nProvoque o próximo episódio sem revelar seu conteúdo.`
    } else {
      prompt += `\nEPISÓDIO FINAL: Feche TODOS os arcos narrativos. Conclusão satisfatória.`
    }

    // Anti-elaboração: EP2+ não deve re-descrever conteúdo de episódios anteriores
    if (request.episodeNumber > 1) {
      prompt += `\n\n🚨 REGRA ANTI-REPETIÇÃO ENTRE EPISÓDIOS (CRÍTICA — EP${request.episodeNumber}):`
      prompt += `\nEste é o EP${request.episodeNumber} de uma série. O espectador JÁ ASSISTIU os episódios anteriores.`
      prompt += `\nSe o brief contém uma seção "TÓPICOS JÁ COBERTOS EM EPISÓDIOS ANTERIORES", siga-a RIGOROSAMENTE:`
      prompt += `\n- PODE referenciar tópicos anteriores por nome (ex: "usando o Método Gemini", "como visto no Horror Hotel")`
      prompt += `\n- PROIBIDO re-descrever procedimentos, etapas, métodos ou detalhes que o espectador já viu`
      prompt += `\n- PROIBIDO elaborar tópicos anteriores usando seu conhecimento de mundo — escreva APENAS com base nos exclusiveFacts deste EP`
      prompt += `\n- Se um exclusiveFact MENCIONA um método/procedimento por nome, use 1 frase de referência, NÃO um parágrafo de explicação`
      prompt += `\n- TESTE: "O espectador que viu o EP${request.episodeNumber - 1} vai sentir déjà vu com este parágrafo?" Se SIM → corte ou condense para 1 frase.`
    }
  }

  // Additional context
  if (request.additionalContext) {
    prompt += `\n\n➕ CONTEXTO ADICIONAL:\n${request.additionalContext}`
  }

  // Must include/exclude
  if (request.mustInclude) prompt += `\n\n- DEVE INCLUIR: ${request.mustInclude}`
  if (request.mustExclude) prompt += `\n- NÃO PODE CONTER: ${request.mustExclude}`

  prompt += `

---
🛡️ CHECAGEM FINAL ANTES DE ENTREGAR:
1. Releia toda a prosa. Se dois parágrafos dizem a mesma coisa com palavras diferentes, ELIMINE um.
2. A narrativa cobre TODOS os beats do outline? Se não, adicione os que faltam.
3. A narrativa avança LINEARMENTE sem voltar a assuntos já cobertos? Se voltou, reorganize.
4. Cada bloco (##) tem substância narrativa suficiente?
5. A proporção está correta? REFLEXÃO ≤15-20% do total. CORPO FACTUAL = 55-65%.
6. O HOOK usa staccato ou frases curtas de impacto? Se não → reescreva.
7. Há pelo menos 3 Power Words nos primeiros 15% do texto? Se não → injete.
8. Há 1-2 frases-tese compartilháveis? Se não → crie.
9. A voz está fiel à identidade definida no início (investigador, documentarista, bardo)? Se não → reescreva na voz certa.`

  return prompt
}
