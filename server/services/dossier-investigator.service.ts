/**
 * Dossier Investigator Service
 * 
 * Recebe uma "semente" (palavra, pessoa, tema) e investiga na web para
 * gerar automaticamente todos os metadados de um dossiê:
 * título, tema, classificação, tags, estilo visual, warning protocol
 * e prompt de Deep Research.
 * 
 * Usa:
 * - fetch MCP / Gemini Grounding para busca web
 * - LLM (via LlmFactory) para classificação e geração
 * - Skill prompt: server/skills/dossier-investigator.md
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import { getActiveClassifications, type IntelligenceClassificationId } from '../constants/intelligence-classifications'
import { getVisualStylesList, type VisualStyleId } from '../constants/visual-styles'

// =============================================================================
// TIPOS
// =============================================================================

export interface InvestigateRequest {
  /** A semente de investigação (palavra, nome, tema, combinação) */
  query: string
}

export interface InvestigateResult {
  /** Título editorial sugerido para o dossiê */
  title: string
  /** Vetor de retenção / tema com ângulo narrativo */
  theme: string
  /** ID da classificação de inteligência */
  classificationId: string
  /** Marcadores de metadados (tags) */
  tags: string[]
  /** ID do estilo visual sugerido (pode ser null) */
  suggestedVisualStyleId: string | null
  /** Diretrizes de Identidade do Universo (Warning Protocol) */
  visualIdentityContext: string
  /** Prompt otimizado para Gemini Deep Research */
  researchPrompt: string
  /** Nível de confiança (0-100) */
  confidence: number
  /** Justificativa das escolhas */
  reasoning: string
  /** Metadados da geração */
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// Schema Zod para structured output
const InvestigateOutputSchema = z.object({
  title: z.string().describe('Título editorial cativante para o dossiê, em pt-BR, máximo 100 caracteres'),
  theme: z.string().describe('Vetor de retenção — o gancho narrativo, não um resumo. Captura tensão/contradição/mistério'),
  classificationId: z.string().describe('ID da classificação de inteligência (da lista fornecida)'),
  tags: z.array(z.string()).describe('4-8 tags em português, lowercase, sem acentos'),
  suggestedVisualStyleId: z.string().nullable().describe('ID do estilo visual sugerido (da lista fornecida) ou null'),
  visualIdentityContext: z.string().describe('Diretrizes de identidade visual — 2-4 frases sobre tom, paleta, o que evitar/priorizar'),
  researchPrompt: z.string().describe('Prompt completo e otimizado para o Gemini Deep Research Agent'),
  confidence: z.number().min(0).max(100).describe('Nível de confiança nas escolhas (0-100)'),
  reasoning: z.string().describe('Justificativa das escolhas em 2-4 frases')
})

// =============================================================================
// SERVICE
// =============================================================================

export async function investigateSeed(
  request: InvestigateRequest
): Promise<InvestigateResult> {
  const query = request.query.trim()
  console.log(`[DossierInvestigator] 🕵️ Investigando semente: "${query}"`)

  // 1. Buscar contexto na web
  const webContext = await fetchWebContext(query)
  console.log(`[DossierInvestigator] 🌐 Contexto web obtido: ${webContext.length} caracteres`)

  // 2. Carregar skill prompt
  const skillPrompt = await loadSkillPrompt()

  // 3. Construir contexto com classificações e estilos disponíveis
  const classifications = getActiveClassifications()
  const visualStyles = getVisualStylesList()

  const classificationList = classifications.map(c => `- \`${c.id}\`: ${c.label} — ${c.description}`).join('\n')
  const visualStyleList = visualStyles.map(s => `- \`${s.id}\`: ${s.name} — ${s.description}`).join('\n')

  // 4. Preparar e enviar para LLM
  const assignment = await getAssignment('dossier-investigator')
  const model = await createLlmForTask('dossier-investigator', { temperature: 0.7 })

  const systemPrompt = skillPrompt
  const userPrompt = buildUserPrompt(query, webContext, classificationList, visualStyleList)

  console.log(`[DossierInvestigator] 📤 Enviando para ${assignment.provider} (${assignment.model})...`)

  const startTime = Date.now()

  let result: z.infer<typeof InvestigateOutputSchema>

  try {
    // Tentar structured output nativo
    const structuredModel = model.withStructuredOutput(InvestigateOutputSchema)
    result = await structuredModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ])
  } catch (structuredError) {
    console.warn('[DossierInvestigator] ⚠️ Structured output falhou, usando fallback de parsing manual...')

    // Fallback: enviar como texto e parsear JSON
    const response = await model.invoke([
      new SystemMessage(systemPrompt + '\n\nIMPORTANTE: Retorne SOMENTE um JSON válido, sem markdown, sem ```json, sem explicação.'),
      new HumanMessage(userPrompt)
    ])

    const rawText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    // Extrair JSON da resposta
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Resposta da IA não contém JSON válido')
    }

    result = InvestigateOutputSchema.parse(JSON.parse(jsonMatch[0]))
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  // Validar classificationId contra a lista real
  const validClassificationIds = classifications.map(c => c.id)
  if (!validClassificationIds.includes(result.classificationId as IntelligenceClassificationId)) {
    console.warn(`[DossierInvestigator] ⚠️ Classificação inválida: "${result.classificationId}". Usando "investigação" como fallback.`)
    result.classificationId = 'investigação'
  }

  // Validar visualStyleId contra a lista real
  if (result.suggestedVisualStyleId) {
    const validStyleIds = visualStyles.map(s => s.id)
    if (!validStyleIds.includes(result.suggestedVisualStyleId as VisualStyleId)) {
      console.warn(`[DossierInvestigator] ⚠️ Estilo visual inválido: "${result.suggestedVisualStyleId}". Removendo sugestão.`)
      result.suggestedVisualStyleId = null
    }
  }

  console.log(`[DossierInvestigator] ✅ Investigação completa em ${elapsed}s — Confiança: ${result.confidence}%`)
  console.log(`[DossierInvestigator] 📋 Título: "${result.title}"`)
  console.log(`[DossierInvestigator] 🏷️ Classificação: ${result.classificationId}`)
  console.log(`[DossierInvestigator] 🎨 Estilo: ${result.suggestedVisualStyleId || 'nenhum'}`)

  return {
    ...result,
    usage: undefined, // Token usage varies by provider
    provider: assignment.provider.toUpperCase(),
    model: assignment.model
  }
}

// =============================================================================
// WEB CONTEXT FETCHER
// =============================================================================

/**
 * Busca contexto na web usando fetch para obter informações sobre a semente.
 * Faz 2-3 buscas rápidas para montar um contexto rico.
 */
async function fetchWebContext(query: string): Promise<string> {
  const searchUrls = [
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3`,
    `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3`
  ]

  const contextParts: string[] = []

  // Buscar na Wikipedia (EN + PT) em paralelo
  const results = await Promise.allSettled(
    searchUrls.map(async (url) => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'TheGapFiles-Investigator/1.0' }
      })
      if (!response.ok) return null
      return response.json()
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const data = result.value as any
      const searchResults = data?.query?.search || []
      for (const item of searchResults) {
        const snippet = item.snippet?.replace(/<[^>]*>/g, '') || ''
        if (snippet) {
          contextParts.push(`[${item.title}]: ${snippet}`)
        }
      }
    }
  }

  // Se encontrou artigos, buscar conteúdo mais detalhado do primeiro resultado PT
  if (contextParts.length > 0) {
    try {
      const ptResults = results[1]
      if (ptResults && ptResults.status === 'fulfilled') {
        const ptData = (ptResults as PromiseFulfilledResult<any>).value as any
        const firstTitle = ptData?.query?.search?.[0]?.title
        if (firstTitle) {
          const extraUrl = `https://pt.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(firstTitle)}&prop=extracts&exintro=true&explaintext=true&format=json`
          const extraResponse = await fetch(extraUrl, {
            signal: AbortSignal.timeout(8000),
            headers: { 'User-Agent': 'TheGapFiles-Investigator/1.0' }
          })
          if (extraResponse.ok) {
            const extraData = await extraResponse.json() as any
            const pages = extraData?.query?.pages || {}
            const firstPage = Object.values(pages)[0] as any
            if (firstPage?.extract) {
              // Limitar a ~2000 chars para não sobrecarregar o prompt
              contextParts.push(`\n[Artigo completo - ${firstTitle}]:\n${firstPage.extract.substring(0, 2000)}`)
            }
          }
        }
      }
    } catch {
      // Silenciosa — contexto extra é opcional
    }
  }

  if (contextParts.length === 0) {
    return `Nenhum resultado encontrado na web para "${query}". Use seu conhecimento interno para investigar.`
  }

  return contextParts.join('\n\n')
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

async function loadSkillPrompt(): Promise<string> {
  const skillPath = join(process.cwd(), 'server', 'skills', 'dossier-investigator.md')
  return readFile(skillPath, 'utf-8')
}

function buildUserPrompt(
  query: string,
  webContext: string,
  classificationList: string,
  visualStyleList: string
): string {
  return `## SEMENTE DE INVESTIGAÇÃO

\`${query}\`

## CONTEXTO DA PESQUISA WEB

${webContext}

## CLASSIFICAÇÕES DE INTELIGÊNCIA DISPONÍVEIS

${classificationList}

## ESTILOS VISUAIS DISPONÍVEIS

${visualStyleList}

---

Investigue a semente acima usando o contexto web fornecido.
Gere o JSON completo com todos os campos definidos na skill.
Lembre-se: o título deve ter ÂNGULO NARRATIVO, o tema deve ser um GANCHO DE RETENÇÃO, e o prompt de pesquisa deve ser EXTREMAMENTE ESPECÍFICO e DIRECIONAL.`
}
