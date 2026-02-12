import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'
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
  narrativeRole: string // gateway | deep-dive | hook-only
  angleCategory: string
  angleDescription: string
  avoidPatterns?: string[]
}

const LOG = '[StoryValidator]'

/**
 * Valida um Outline narrativo contra as regras de sua Role e Ângulo.
 * Usa Skills específicas (story-validator-*.md) como critério de aceite.
 */
export async function validateStoryOutline(
  outline: any,
  context: ValidationContext
): Promise<ValidationResult> {
  // 1. Identificar e carregar a Skill correta
  const skillFileName = `story-validator-${context.narrativeRole}.md`
  const skillPath = path.resolve(process.cwd(), 'server', 'skills', skillFileName)

  let validationSkill = ''
  try {
    validationSkill = await fs.readFile(skillPath, 'utf-8')
  } catch (error) {
    console.warn(`${LOG} Skill não encontrada para role "${context.narrativeRole}". Pulando validação.`)
    return { approved: true } // Se não tem regra específica, aprova por padrão (safe fail)
  }

  // 2. Montar o Prompt de Validação
  const prompt = `
PAINEL DE VALIDAÇÃO NARRATIVA
-----------------------------

SUA MISSÃO:
Atuar como o Story Analyst definido na Skill abaixo e validar se o outline gerado respeita RIGOROSAMENTE as regras.

${validationSkill}

CONTEXTO DO PROJETO:
- Tipo: ${context.itemType}
- Role: ${context.narrativeRole}
- Ângulo Obrigatório: ${context.angleCategory} ("${context.angleDescription}")
- Avoid Patterns (O QUE NÃO FAZER):
${(context.avoidPatterns || []).map(p => `  - ${p}`).join('\n')}

OUTLINE PARA ANÁLISE:
${JSON.stringify(outline, null, 2)}

INSTRUÇÃO FINAL:
Analise cada beat do outline. Verifique:
1. Contaminação de Contexto (fala de coisas fora do ângulo?)
2. Profundidade (respeita o nível de contexto da role?)
3. Anti-Padrões (violou algo?)

Responda APENAS no formato JSON definido.
`

  // 3. Chamar LLM via Factory (usa o modelo configurado para 'story-validator')
  console.log(`${LOG} Validando outline (${context.narrativeRole})...`)

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
