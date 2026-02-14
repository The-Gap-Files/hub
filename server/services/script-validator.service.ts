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

  // 1. Carregar skill de validação
  let validationSkill = ''
  try {
    validationSkill = loadSkill(skillName)
  } catch (error) {
    console.warn(`${LOG} Skill não encontrada: "${skillName}". Pulando validação.`)
    return { approved: true }
  }

  // 2. Formatar cenas para análise
  const scenesFormatted = scenes.map((s, i) =>
    `Cena ${i}: "${s.narration}"`
  ).join('\n')

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

FOCO PRINCIPAL: Verificar se o roteiro RESOLVE DEMAIS para a role "${roleLabel}".
- Se a role é gateway → resolução deve ser PARCIAL (contextualiza mas não fecha)
- Se a role é deep-dive → resolução deve ser MÍNIMA (aprofunda mas não conclui)
- Se a role é hook-only → resolução deve ser ZERO (pura provocação)

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
