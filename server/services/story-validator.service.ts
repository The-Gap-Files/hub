import { z } from 'zod'
import { loadSkill } from '../utils/skill-loader'
import { createLlmForTask, getAssignment } from './llm/llm-factory'

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

    // Usando structuredOutput do LangChain
    const structuredLlm = (model as any).withStructuredOutput(ValidationResultSchema, {
      includeRaw: true,
      method: 'jsonSchema'
    })

    const result = await structuredLlm.invoke([
      { role: 'user', content: prompt }
    ])

    const validation = result.parsed || result as ValidationResult

    if (!validation.approved) {
      console.warn(`${LOG} ❌ Outline REPROVADO. Violações: ${validation.violations?.join(', ')}`)
    } else {
      console.log(`${LOG} ✅ Outline APROVADO.`)
    }

    return validation

  } catch (error) {
    console.error(`${LOG} Erro na validação:`, error)
    return { approved: true }
  }
}
