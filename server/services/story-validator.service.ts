import { z } from 'zod'
import { loadSkill } from '../utils/skill-loader'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import { validatorsEnabled } from '../utils/validators'

// Schema de Resposta da Validação
const ValidationResultSchema = z.object({
  approved: z.boolean().describe('Se o outline foi aprovado ou reprovado'),
  violations: z.array(z.string()).optional().describe('Lista de violações encontradas (se houver)'),
  corrections: z.string().optional().describe('Instruções concretas para corrigir as violações (se reprovado)')
})

export type ValidationResult = z.infer<typeof ValidationResultSchema>

interface ValidationContext {
  itemType: 'teaser' | 'fullVideo'
  narrativeRole: string // gateway | deep-dive | hook-only | full-video
  angleCategory: string
  angleDescription: string
  avoidPatterns?: string[]
}

const LOG = '[StoryValidator]'

/**
 * Resolve o nome do skill de validação baseado no contexto.
 * - Teasers: story-validator-{narrativeRole} (ex: story-validator-gateway)
 * - Full Video: full-video/story-validator
 */
function resolveValidationSkillName(context: ValidationContext): string {
  if (context.itemType === 'fullVideo' || context.narrativeRole === 'full-video') {
    return 'full-video/story-validator'
  }
  return `teaser/story-validator-${context.narrativeRole}`
}

/**
 * Valida um Outline narrativo contra as regras de sua Role e Ângulo.
 * Usa Skills específicas como critério de aceite:
 * - Teasers: server/skills/story-validator-{role}.md
 * - Full Video: server/skills/full-video/story-validator.md
 */
export async function validateStoryOutline(
  outline: any,
  context: ValidationContext
): Promise<ValidationResult> {
  if (!validatorsEnabled()) {
    console.log(`${LOG} ⏭️ Validação DESABILITADA temporariamente (bypass global).`)
    return { approved: true }
  }

  const isFullVideo = context.itemType === 'fullVideo' || context.narrativeRole === 'full-video'
  const skillName = resolveValidationSkillName(context)

  // 1. Carregar a Skill de validação via skill-loader (suporta subpastas)
  let validationSkill = ''
  try {
    validationSkill = loadSkill(skillName)
  } catch (error) {
    console.warn(`${LOG} Skill não encontrada: "${skillName}". Pulando validação.`)
    return { approved: true } // Se não tem regra específica, aprova por padrão (safe fail)
  }

  // 1.5. Validação Programática de Campos Obrigatórios (antes do LLM)
  const isHookOnly = context.narrativeRole === 'hook-only'
  const violations: string[] = []

  // Campos que SEMPRE devem estar preenchidos
  if (!outline.hookStrategy || outline.hookStrategy.trim() === '') {
    violations.push('Campo obrigatório "hookStrategy" está vazio')
  }
  if (!outline.hookVariants || outline.hookVariants.length !== 4) {
    violations.push('Campo "hookVariants" deve conter exatamente 4 variantes')
  }
  // promiseSetup: obrigatório para gateway/deep-dive, opcional para hook-only
  // (hook-only integra o anchor na ruptura, não num campo separado)
  if (!isHookOnly && (!outline.promiseSetup || outline.promiseSetup.trim() === '')) {
    violations.push('Campo obrigatório "promiseSetup" está vazio (mínimo: anchor com local)')
  }
  if (!outline.risingBeats || outline.risingBeats.length < 2) {
    violations.push('Campo "risingBeats" deve conter pelo menos 2 beats')
  }

  // Campos que devem estar PREENCHIDOS para gateway/deep-dive, mas VAZIOS para hook-only
  if (!isHookOnly) {
    // Gateway/Deep-dive: exigir campos de resolução preenchidos
    if (!outline.climaxMoment || outline.climaxMoment.trim() === '') {
      violations.push('Campo obrigatório "climaxMoment" está vazio (obrigatório para gateway/deep-dive)')
    }
    if (!outline.climaxFormula || outline.climaxFormula.trim() === '') {
      violations.push('Campo obrigatório "climaxFormula" está vazio (obrigatório para gateway/deep-dive)')
    }
    if (!outline.resolutionPoints || outline.resolutionPoints.length < 2) {
      violations.push('Campo "resolutionPoints" deve conter pelo menos 2 pontos (obrigatório para gateway/deep-dive)')
    }
    if (!outline.resolutionAngle || outline.resolutionAngle.trim() === '') {
      violations.push('Campo obrigatório "resolutionAngle" está vazio (obrigatório para gateway/deep-dive)')
    }
    if (!outline.ctaApproach || outline.ctaApproach.trim() === '') {
      violations.push('Campo obrigatório "ctaApproach" está vazio (obrigatório para gateway/deep-dive)')
    }
    if (!outline.emotionalArc || outline.emotionalArc.trim() === '') {
      violations.push('Campo obrigatório "emotionalArc" está vazio (obrigatório para gateway/deep-dive)')
    }
    if (!outline.toneProgression || outline.toneProgression.trim() === '') {
      violations.push('Campo obrigatório "toneProgression" está vazio (obrigatório para gateway/deep-dive)')
    }
    if (!outline.whatToReveal || outline.whatToReveal.length < 1) {
      violations.push('Campo "whatToReveal" deve conter pelo menos 1 item (obrigatório para gateway/deep-dive)')
    }
  }

  // Se houver violações programáticas, retornar imediatamente
  if (violations.length > 0) {
    console.warn(`${LOG} ❌ Validação programática REPROVADA. Violações: ${violations.join(', ')}`)
    return {
      approved: false,
      violations,
      corrections: isHookOnly
        ? 'Para hook-only, deixe os campos de resolução vazios (climaxMoment, climaxFormula, resolutionPoints, resolutionAngle, ctaApproach, emotionalArc, toneProgression, whatToReveal, whatToHold, whatToIgnore = "" ou []). Preencha hookStrategy, hookVariants e risingBeats. O campo promiseSetup pode ficar vazio (anchor vai integrado na ruptura).'
        : 'Para gateway/deep-dive, todos os campos de resolução devem estar preenchidos com conteúdo específico (não genérico). Revise os campos vazios listados acima.'
    }
  }

  // 2. Montar o Prompt de Validação
  const roleLabel = isFullVideo ? 'Full Video' : context.narrativeRole
  const prompt = `
PAINEL DE VALIDAÇÃO NARRATIVA
-----------------------------

SUA MISSÃO:
Atuar como o Story Analyst definido na Skill abaixo e validar se o outline gerado respeita RIGOROSAMENTE as regras.

${validationSkill}

CONTEXTO DO PROJETO:
- Tipo: ${context.itemType}
- Role: ${roleLabel}
- Ângulo Obrigatório: ${context.angleCategory} ("${context.angleDescription}")
- Avoid Patterns (O QUE NÃO FAZER):
${(context.avoidPatterns || []).map(p => `  - ${p}`).join('\n')}

OUTLINE PARA ANÁLISE:
${JSON.stringify(outline, null, 2)}

INSTRUÇÃO FINAL:
${isFullVideo ? `Analise o outline de FULL VIDEO. Execute os 14 checks definidos na skill:
1. Cold Open presente (Fatal)
2. Promise/Declaração nos primeiros 10%
3. Setup ≤ 25% das cenas
4. ≥5 rising beats
5. Escalação progressiva entre beats (Fatal)
6. Midpoint presente entre 40-60% (Fatal)
7. Re-engagement hooks a cada ~36 cenas
8. Dark Moment (70-75%)
9. Clímax posicionado (80-92%)
10. Resolução + CTA nos últimos 10% (Fatal)
11. Ângulo respeitado em todos os beats
12. Arco emocional com ≥5 estados
13. Cenas totais = duração/5
14. Avoid Patterns respeitados

Regra: 1+ fatal = REPROVADO. 0 fatais + 2+ graves = REPROVADO.` : `Analise cada beat do outline. Verifique:
1. Contaminação de Contexto (fala de coisas fora do ângulo?)
2. Profundidade (respeita o nível de contexto da role?)
3. Anti-Padrões (violou algo?)`}

Responda APENAS no formato JSON definido.
`

  // 3. Chamar LLM via Factory (usa o modelo configurado para 'story-validator')
  console.log(`${LOG} Validando outline (${roleLabel})...`)

  try {
    const assignment = await getAssignment('story-validator')
    const model = await createLlmForTask('story-validator')

    console.log(`${LOG} Usando ${assignment.provider} (${assignment.model}) para validação`)

    // Determinar method de structured output baseado no provider/model
    const isGemini = assignment.provider.toLowerCase().includes('gemini') || assignment.provider.toLowerCase().includes('google')
    const isGroq = assignment.provider.toLowerCase().includes('groq')
    const isGroqLlama4 = isGroq && assignment.model.includes('llama-4')
    const isGroqGptOss = isGroq && assignment.model.includes('gpt-oss')

    const m = model as any
    let structuredLlm: any
    if (assignment.provider === 'replicate' && typeof m.withStructuredOutputReplicate === 'function') {
      structuredLlm = m.withStructuredOutputReplicate(ValidationResultSchema, { includeRaw: true })
    } else {
      const method = isGemini ? 'functionCalling' : isGroqLlama4 ? 'jsonMode' : isGroqGptOss ? 'jsonSchema' : undefined
      structuredLlm = m.withStructuredOutput(ValidationResultSchema, {
        includeRaw: true,
        ...(method ? { method } : {})
      })
    }

    const { invokeWithLogging } = await import('../utils/llm-invoke-wrapper')
    const result = await invokeWithLogging(structuredLlm, [
      { role: 'user', content: prompt }
    ], { taskId: 'story-validator', provider: assignment.provider, model: assignment.model })

    const validation = (result.parsed || result) as unknown as ValidationResult

    if (!validation.approved) {
      console.warn(`${LOG} ❌ Outline REPROVADO. Violações: ${validation.violations?.join(', ')}`)
    } else {
      console.log(`${LOG} ✅ Outline APROVADO.`)
    }

    return validation

  } catch (error: any) {
    const { handleGroqJsonValidateError } = await import('../utils/groq-error-handler')
    const result = handleGroqJsonValidateError<ValidationResult>(error, LOG)

    if (result.success) {
      return {
        approved: result.data.approved ?? true,
        violations: result.data.violations,
        corrections: result.data.corrections,
      } as ValidationResult
    }

    console.error(`${LOG} Erro na validação:`, error)
    return { approved: true }
  }
}
