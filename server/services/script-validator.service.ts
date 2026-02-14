/**
 * Script Validator Service
 * 
 * Valida o roteiro FINAL (cenas geradas) contra as regras de resolução,
 * open loops, duração e anti-padrões definidos pela narrativeRole.
 * 
 * Segue o mesmo padrão do story-validator.service.ts:
 * - Carrega skill .md específica por role
 * - Envia roteiro + regras para LLM
 * - Retorna approved/rejected com violações
 * 
 * Fluxo: Script Generator → Script Validator → Salvar (com metadata de validação)
 */

import { z } from 'zod'
import { loadSkill } from '../utils/skill-loader'
import { createLlmForTask, getAssignment } from './llm/llm-factory'

// Schema de Resposta da Validação
const ScriptValidationResultSchema = z.object({
  approved: z.boolean().describe('Se o roteiro foi aprovado ou reprovado'),
  violations: z.array(z.string()).optional().describe('Lista de violações encontradas (se houver)'),
  corrections: z.string().optional().describe('Instruções concretas para corrigir as violações (se reprovado)'),
  overResolution: z.boolean().optional().describe('Se o roteiro resolve demais para a role (true = resolve demais)')
})

export type ScriptValidationResult = z.infer<typeof ScriptValidationResultSchema>

export interface ScriptValidationContext {
  itemType: 'teaser' | 'fullVideo'
  narrativeRole: string // gateway | deep-dive | hook-only
  angleCategory?: string
  angleDescription?: string
  shortFormatType?: string
  targetDuration?: number // em segundos
  avoidPatterns?: string[]
  /** Nível tonal do hook selecionado pelo usuário (green, moderate, aggressive, lawless) */
  selectedHookLevel?: string
  /** Open loops planejados pelo Story Architect (se disponíveis) */
  plannedOpenLoops?: Array<{
    question: string
    closedAtBeat: number | null
  }>
}

interface ScriptScene {
  order: number
  narration: string
  visualDescription?: string
  estimatedDuration?: number
}

const LOG = '[ScriptValidator]'

/**
 * Resolve o nome do skill de validação de roteiro baseado no contexto.
 * - Teasers: teaser/script-validator-{narrativeRole}
 * - Full Video: (futuro) full-video/script-validator
 */
function resolveScriptValidationSkillName(context: ScriptValidationContext): string {
  if (context.itemType === 'fullVideo') {
    // Futuro: full-video/script-validator
    return ''
  }
  return `teaser/script-validator-${context.narrativeRole}`
}

/**
 * Valida um roteiro final (cenas) contra as regras da Role e ângulo.
 * Usa Skills específicas como critério de aceite.
 * 
 * Retorna validação com flag `overResolution` para diagnóstico rápido.
 */
export async function validateScript(
  scenes: ScriptScene[],
  context: ScriptValidationContext
): Promise<ScriptValidationResult> {
  const skillName = resolveScriptValidationSkillName(context)

  if (!skillName) {
    console.log(`${LOG} Sem skill de validação para ${context.itemType}. Pulando.`)
    return { approved: true }
  }

  // 0. Check determinístico: CTA final em HOOK-ONLY deve ser exatamente "The Gap Files."
  // (evita gastar tokens com validação LLM em algo que é regra hard)
  if (context.itemType === 'teaser' && context.narrativeRole === 'hook-only' && scenes.length > 0) {
    const last = scenes[scenes.length - 1]
    const lastNarration = (last?.narration || '').trim().replace(/\s+/g, ' ')
    if (lastNarration !== 'The Gap Files.') {
      return {
        approved: false,
        violations: [
          `CTA inválido em hook-only: a última cena deve ser EXATAMENTE "The Gap Files." (recebido: "${lastNarration || '[vazio]'}")`
        ],
        corrections:
          'Reescreva a ÚLTIMA cena para ter a narração EXATAMENTE: "The Gap Files." (sem texto adicional antes/depois).',
        overResolution: false
      }
    }
  }

  // 1. Carregar skill de validação
  let validationSkill = ''
  try {
    validationSkill = loadSkill(skillName)
  } catch (error) {
    console.warn(`${LOG} Skill não encontrada: "${skillName}". Pulando validação.`)
    return { approved: true }
  }

  // 2. Formatar cenas para análise (narração + visual + áudio)
  const scenesFormatted = scenes.map((s, i) => {
    let formatted = `Cena ${i}: "${s.narration}"`
    if (s.visualDescription) {
      formatted += `\n  Visual: "${s.visualDescription}"`
    }
    return formatted
  }).join('\n')

  const totalDuration = scenes.length * 5
  const roleLabel = context.narrativeRole

  // 3. Bloco de open loops planejados (se disponível do outline)
  let openLoopsBlock = ''
  if (context.plannedOpenLoops && context.plannedOpenLoops.length > 0) {
    const openOnes = context.plannedOpenLoops.filter(l => l.closedAtBeat === null)
    openLoopsBlock = `
OPEN LOOPS PLANEJADOS (do Story Architect):
Os seguintes threads narrativos foram planejados para FICAR ABERTOS no final:
${openOnes.map(l => `• "${l.question}" — NÃO deve ser respondido no roteiro`).join('\n')}

Verifique se o roteiro RESPEITA esses loops abertos. Se algum deles foi respondido/fechado nas cenas, é violação.`
  }

  // 4. Montar prompt
  const prompt = `
PAINEL DE VALIDAÇÃO DE ROTEIRO FINAL
-------------------------------------

SUA MISSÃO:
Atuar como o Revisor de Roteiro definido na Skill abaixo e validar se o roteiro gerado respeita RIGOROSAMENTE as regras.

${validationSkill}

CONTEXTO DO PROJETO:
- Tipo: ${context.itemType}
- Role: ${roleLabel}
${context.angleCategory ? `- Ângulo: ${context.angleCategory}${context.angleDescription ? ` ("${context.angleDescription}")` : ''}` : ''}
${context.shortFormatType ? `- Formato do Short: ${context.shortFormatType}` : ''}
- Duração total: ${totalDuration}s (${scenes.length} cenas × 5s)
${context.targetDuration ? `- Duração alvo: ${context.targetDuration}s` : ''}
${context.avoidPatterns && context.avoidPatterns.length > 0 ? `- Anti-Padrões (O QUE NÃO FAZER):\n${context.avoidPatterns.map(p => `  - ${p}`).join('\n')}` : ''}
${context.selectedHookLevel === 'lawless' || context.selectedHookLevel === 'aggressive' || context.selectedHookLevel === 'custom' ? `
⚠️ NÍVEL TONAL SELECIONADO: ${context.selectedHookLevel?.toUpperCase()}
O usuário ESCOLHEU e APROVOU um tom ${context.selectedHookLevel}. Isso significa:
- Linguagem forte, acusatória e direta é PERMITIDA (ex: "farsa", "mentira", "crime fabricado")
- Palavras de julgamento moral são aceitáveis no TOM — elas fazem parte do estilo escolhido
- O que NÃO é permitido mesmo em lawless: RESOLVER A HISTÓRIA (revelar motivações completas, fechar todos os loops, dar conclusão final)
- Diferencie: LINGUAGEM FORTE (tom) vs. INFORMAÇÃO QUE RESOLVE (conteúdo). Só reprove por resolução excessiva, não por vocabulário agressivo.` : ''}
${openLoopsBlock}

ROTEIRO PARA ANÁLISE (${scenes.length} cenas):
${scenesFormatted}

INSTRUÇÃO FINAL:
Analise CADA CENA do roteiro. Verifique TODOS os critérios da skill.

FOCO 1 — RESOLUÇÃO: Verificar se o roteiro RESOLVE DEMAIS para a role "${roleLabel}".
- Se a role é gateway → resolução deve ser PARCIAL (contextualiza mas não fecha)
- Se a role é deep-dive → resolução deve ser MÍNIMA (aprofunda mas não conclui)
- Se a role é hook-only → resolução deve ser ZERO (pura provocação)

FOCO 2 — MECANISMO > SINTOMA: Verificar narração E visual de CADA CENA.
A narração e o visualDescription devem focar no SISTEMA (documentos, assinaturas, tribunais, confiscos, propaganda), não em violência física GRÁFICA.

⚠️ DISTINÇÃO CRÍTICA — NÃO confunda:
- DESCRIÇÃO GRÁFICA de violência = REPROVADO (detalhes de como a tortura/ataque aconteceu fisicamente)
  Ex: "A corda rasgou seus pulsos", "Sangue escorria pelo altar", "Balas perfuraram as paredes"
- REFERÊNCIA FACTUAL a evento = PERMITIDO (mencionar QUE algo aconteceu, sem descrever como)
  Ex: "Ele atacou a sinagoga de Poway", "O mito inspirou um massacre em 2019", "A mentira matou novamente"
Referências factuais a ataques, massacres, mortes são CADEIA DE TRANSMISSÃO — são o MECANISMO mostrando CONSEQUÊNCIA, não gore.

PALAVRAS-GATILHO NA NARRAÇÃO (sinalizar só se usadas com DESCRIÇÃO GRÁFICA):
  - tortura, squassada, strappado, corda, corrente, açoite, sangue escorrendo, ferida aberta, cadáver mutilado
PALAVRAS PERMITIDAS (referência factual):
  - atacou, massacre, ataque, assassinato, matou, morreu (quando descrevem FATO, não DETALHE GRÁFICO)
PALAVRAS-GATILHO NO VISUAL (sinalizar sempre):
  - torture, pulley, chain, rope, whip, blood, wound, corpse, hanged, suspended, shackle, iron maiden, gun, bullet
SUBSTITUIÇÕES RECOMENDADAS (para descrições gráficas):
  - "sob tortura, confessou" → "o tribunal registrou a confissão no terceiro dia"
  - "iron pulley, condemned man suspended" → "bishop's study, illuminated ledger, sealed document"
  - "gunshots echo" → "keyboard clicks, monitor hum"

FOCO 3 — NOMES OBSCUROS (ESPECIALMENTE EM HOOK-ONLY E DEEP-DIVE):
- Nomes históricos que NÃO são universalmente conhecidos quebram o fluxo cognitivo.
- Em hook-only: QUALQUER nome obscuro é violação grave (o público médio não sabe quem é).
- Em deep-dive: nomes devem ser acompanhados de função na primeira menção.
- Em gateway: nomes podem aparecer desde que a função seja mencionada junto.
EXEMPLOS:
  - ❌ "Hinderbach ordenou" → ✅ "O bispo ordenou"
  - ❌ "Tiberino analisou" → ✅ "O médico analisou"
  - ❌ "John Earnest citou" → ✅ "O atirador citou" (se hook-only) ou "John Earnest, o atirador, citou" (se gateway)
EXCEÇÃO: Nomes universalmente conhecidos (Hitler, Einstein, Napoleão) são permitidos.

FOCO 4 — DENSIDADE / ANTI-FILLER (ESPECIALMENTE EM HOOK-ONLY):
- Cada cena (exceto a última de CTA) deve carregar informação NOVA. Cena "bonita" mas vazia derruba retenção.
- Se a narração de uma cena é puramente atmosférica/poética sem agente/artefato/ação/consequência → REPROVADO.
- EXEMPLO RUIM (filler): "Um selo dourado pisca brevemente, desaparecendo como um sussurro na escuridão profunda."
- EXEMPLO BOM (respiro com conteúdo): "O selo autorizou o confisco. E ninguém assinou por engano."

Marque "overResolution: true" se o roteiro entrega conclusão/explicação demais para a role.

Responda APENAS no formato JSON definido.
`

  // 5. Chamar LLM
  console.log(`${LOG} Validando roteiro (${roleLabel}, ${scenes.length} cenas, ${totalDuration}s)...`)

  try {
    const assignment = await getAssignment('script-validator')
    const model = await createLlmForTask('script-validator')

    console.log(`${LOG} Usando ${assignment.provider} (${assignment.model}) para validação`)

    const m = model as any
    const isGroqLlama4 = assignment.provider.toLowerCase().includes('groq') && assignment.model.includes('llama-4')
    const structuredLlm = assignment.provider === 'replicate' && typeof m.withStructuredOutputReplicate === 'function'
      ? m.withStructuredOutputReplicate(ScriptValidationResultSchema, { includeRaw: true })
      : m.withStructuredOutput(ScriptValidationResultSchema, { includeRaw: true, ...(isGroqLlama4 ? { method: 'jsonMode' } : {}) })

    const { invokeWithLogging } = await import('../utils/llm-invoke-wrapper')
    const result = await invokeWithLogging(structuredLlm, [
      { role: 'user', content: prompt }
    ], { taskId: 'script-validator', provider: assignment.provider, model: assignment.model })

    const validation = (result.parsed || result) as unknown as ScriptValidationResult

    // Proteção contra approved:false sem violations (LLM pode omitir o campo)
    if (!validation.approved && (!validation.violations || validation.violations.length === 0)) {
      console.warn(`${LOG} ⚠️ LLM reprovou sem listar violações. Tratando como APROVADO (sem evidência de problema).`)
      validation.approved = true
    }

    if (!validation.approved) {
      console.warn(`${LOG} ❌ Roteiro REPROVADO. Violações: ${validation.violations?.join(', ')}`)
      if (validation.overResolution) {
        console.warn(`${LOG} ⚠️ OVER-RESOLUTION detectada: roteiro resolve demais para role "${roleLabel}"`)
      }
    } else {
      console.log(`${LOG} ✅ Roteiro APROVADO.`)
    }

    return validation

  } catch (error: any) {
    const { handleGroqJsonValidateError } = await import('../utils/groq-error-handler')
    const result = handleGroqJsonValidateError<ScriptValidationResult>(error, LOG)

    if (result.success) {
      return {
        approved: result.data.approved ?? true,
        violations: result.data.violations,
        corrections: result.data.corrections,
      } as ScriptValidationResult
    }

    console.error(`${LOG} Erro na validação:`, error)
    // Falha silenciosa — não bloqueia o pipeline
    return { approved: true }
  }
}
