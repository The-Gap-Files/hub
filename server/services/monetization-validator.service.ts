/**
 * Monetization Plan Validator Service
 * 
 * Valida o plano de monetização COMPLETO (Full Video + Teasers) contra
 * regras de diversidade, coerência role×format e estratégia de funil.
 * 
 * Diferente dos outros validadores (por role), este valida o PLANO INTEIRO
 * porque os critérios são sobre o conjunto (distribuição, diversidade, redundância).
 * 
 * Fluxo: Monetization Planner → Monetization Validator → UI (aprovação)
 */

import { z } from 'zod'
import { loadSkill } from '../utils/skill-loader'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import { validatorsEnabled } from '../utils/validators'

// Schema de Resposta da Validação
const MonetizationValidationResultSchema = z.object({
  approved: z.boolean().describe('Se o plano foi aprovado ou reprovado'),
  violations: z.array(z.string()).optional().describe('Lista de violações fatais'),
  warnings: z.array(z.string()).optional().describe('Avisos não-fatais (combinações limítrofes, etc.)'),
  corrections: z.string().optional().describe('Instruções concretas para corrigir'),
  roleDistribution: z.object({
    gateway: z.number(),
    deepDive: z.number(),
    hookOnly: z.number(),
    isValid: z.boolean()
  }).optional().describe('Distribuição de roles encontrada'),
  formatDiversity: z.object({
    uniqueFormats: z.number(),
    isValid: z.boolean()
  }).optional().describe('Diversidade de formatos de short'),
  angleDiversity: z.object({
    uniqueAngles: z.number(),
    duplicates: z.array(z.string()),
    isValid: z.boolean()
  }).optional().describe('Diversidade de ângulos narrativos')
})

export type MonetizationValidationResult = z.infer<typeof MonetizationValidationResultSchema>

interface MonetizationPlanForValidation {
  fullVideo: {
    title: string
    hook: string
    angle: string
    scriptStyleId?: string
    keyPoints?: string[]
    emotionalArc?: string
  }
  teasers: Array<{
    title: string
    hook: string
    angle: string
    angleCategory: string
    narrativeRole: string
    shortFormatType?: string
    scriptOutline?: string
    avoidPatterns?: string[]
  }>
}

const LOG = '[MonetizationValidator]'

/**
 * Valida o plano de monetização completo.
 * Retorna resultado com diagnósticos de distribuição, diversidade e coerência.
 */
export async function validateMonetizationPlan(
  plan: MonetizationPlanForValidation
): Promise<MonetizationValidationResult> {
  if (!validatorsEnabled()) {
    console.log(`${LOG} ⏭️ Validação DESABILITADA temporariamente (bypass global).`)
    return { approved: true }
  }

  // 1. Carregar skill de validação
  let validationSkill = ''
  try {
    validationSkill = loadSkill('monetization-validator')
  } catch (error) {
    console.warn(`${LOG} Skill não encontrada. Pulando validação.`)
    return { approved: true }
  }

  // 2. Formatar plano para análise
  const teasersSummary = plan.teasers.map((t, i) =>
    `Teaser ${i + 1}: role=${t.narrativeRole}, angle=${t.angleCategory}, format=${t.shortFormatType || 'não definido'}, hook="${t.hook}", avoidPatterns=[${(t.avoidPatterns || []).join('; ')}]`
  ).join('\n')

  const fullVideoSummary = `Full Video: title="${plan.fullVideo.title}", hook="${plan.fullVideo.hook}", angle="${plan.fullVideo.angle}", style=${plan.fullVideo.scriptStyleId || 'não definido'}`

  // 3. Diagnósticos rápidos (pré-LLM, para incluir no prompt)
  const roleCount = {
    gateway: plan.teasers.filter(t => t.narrativeRole === 'gateway').length,
    deepDive: plan.teasers.filter(t => t.narrativeRole === 'deep-dive').length,
    hookOnly: plan.teasers.filter(t => t.narrativeRole === 'hook-only').length
  }

  const angleCategories = plan.teasers.map(t => t.angleCategory)
  const uniqueAngles = [...new Set(angleCategories)]
  const duplicateAngles = angleCategories.filter((a, i) => angleCategories.indexOf(a) !== i)

  const formatTypes = plan.teasers.map(t => t.shortFormatType || 'não definido')
  const uniqueFormats = [...new Set(formatTypes)]

  // 4. Montar prompt
  const prompt = `
PAINEL DE VALIDAÇÃO DO PLANO DE MONETIZAÇÃO
--------------------------------------------

SUA MISSÃO:
Atuar como Revisor de Plano de Monetização e validar se o plano segue TODAS as regras.

${validationSkill}

PLANO PARA ANÁLISE:

${fullVideoSummary}

${teasersSummary}

DIAGNÓSTICOS PRÉ-CALCULADOS:
- Total de teasers: ${plan.teasers.length}
- Roles: Gateway=${roleCount.gateway}, Deep-Dive=${roleCount.deepDive}, Hook-Only=${roleCount.hookOnly}
- Ângulos únicos: ${uniqueAngles.length} de ${plan.teasers.length} (${duplicateAngles.length > 0 ? `DUPLICADOS: ${[...new Set(duplicateAngles)].join(', ')}` : 'sem duplicatas'})
- Formatos únicos: ${uniqueFormats.length} (${uniqueFormats.join(', ')})

INSTRUÇÃO:
Analise o plano COMPLETO usando TODOS os 8 critérios da skill.
Considere os diagnósticos acima como base, mas faça sua própria análise qualitativa também.

Responda APENAS no formato JSON definido.
`

  // 5. Chamar LLM
  console.log(`${LOG} Validando plano (${plan.teasers.length} teasers)...`)
  console.log(`${LOG} 📊 Roles: G=${roleCount.gateway} DD=${roleCount.deepDive} HO=${roleCount.hookOnly} | Ângulos únicos: ${uniqueAngles.length} | Formatos únicos: ${uniqueFormats.length}`)

  try {
    const assignment = await getAssignment('monetization-validator')
    const model = await createLlmForTask('monetization-validator')

    console.log(`${LOG} Usando ${assignment.provider} (${assignment.model})`)

    const m = model as any
    const isGroqLlama4 = assignment.provider.toLowerCase().includes('groq') && assignment.model.includes('llama-4')
    const structuredLlm = assignment.provider === 'replicate' && typeof m.withStructuredOutputReplicate === 'function'
      ? m.withStructuredOutputReplicate(MonetizationValidationResultSchema, { includeRaw: true })
      : m.withStructuredOutput(MonetizationValidationResultSchema, { includeRaw: true, ...(isGroqLlama4 ? { method: 'jsonMode' } : {}) })

    const { invokeWithLogging } = await import('../utils/llm-invoke-wrapper')
    const result = await invokeWithLogging(structuredLlm, [
      { role: 'user', content: prompt }
    ], { taskId: 'monetization-validator', provider: assignment.provider, model: assignment.model })

    const validation = (result.parsed || result) as unknown as MonetizationValidationResult

    // Liberar violações que devem ser apenas warnings (nunca reprovar)
    const LIBERADOS = [
      /detalhe gráfico|anatômico|gore.*não identificado|recomendado revisar/i,
      /combinações limítrofes.*não foram verificadas|limítrofes de role e format/i
    ]
    if (validation.violations?.length) {
      const liberadas: string[] = []
      const restantes: string[] = []
      for (const v of validation.violations) {
        if (LIBERADOS.some(r => r.test(v))) liberadas.push(v)
        else restantes.push(v)
      }
      if (liberadas.length > 0) {
        validation.warnings = [...(validation.warnings || []), ...liberadas]
        validation.violations = restantes.length > 0 ? restantes : undefined
        if (!validation.violations?.length) {
          validation.approved = true
        }
        console.log(`${LOG} 🔓 Liberados (movidos para warnings): ${liberadas.join('; ')}`)
      }
    }

    // Suprimir warnings sobre conteúdo gráfico/explícito — o sistema suporta
    // todos os níveis tonais (green→lawless) por design. Esses avisos são falsos positivos.
    const WARNINGS_SUPRIMIDOS = [
      /gráfico|explícit|violento|sensível|inapropriado|ofensivo/i,
      /revisar.*hook.*garantir|garantir.*não.*contenha/i,
      /conteúdo.*adulto|público.*menor|restrição.*idade/i
    ]
    if (validation.warnings?.length) {
      const suprimidos: string[] = []
      validation.warnings = validation.warnings.filter((w: string) => {
        if (WARNINGS_SUPRIMIDOS.some(r => r.test(w))) {
          suprimidos.push(w)
          return false
        }
        return true
      })
      if (suprimidos.length > 0) {
        console.log(`${LOG} 🔇 Warnings suprimidos (falso positivo de conteúdo): ${suprimidos.join('; ')}`)
      }
      if (validation.warnings.length === 0) validation.warnings = undefined
    }

    if (!validation.approved) {
      console.warn(`${LOG} ❌ Plano REPROVADO. Violações: ${validation.violations?.join(', ')}`)
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn(`${LOG} ⚠️ Warnings: ${validation.warnings.join(', ')}`)
      }
    } else {
      console.log(`${LOG} ✅ Plano APROVADO.`)
      if (validation.warnings && validation.warnings.length > 0) {
        console.log(`${LOG} ⚠️ Warnings (não-fatais): ${validation.warnings.join(', ')}`)
      }
    }

    return validation

  } catch (error: any) {
    const { handleGroqJsonValidateError } = await import('../utils/groq-error-handler')
    const result = handleGroqJsonValidateError<MonetizationValidationResult>(error, LOG)

    if (result.success) {
      return {
        approved: result.data.approved ?? true,
        violations: result.data.violations,
        warnings: result.data.warnings,
        corrections: result.data.corrections,
      } as MonetizationValidationResult
    }

    console.error(`${LOG} Erro na validação:`, error)
    return { approved: true }
  }
}
