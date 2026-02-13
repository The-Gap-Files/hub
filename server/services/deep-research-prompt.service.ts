/**
 * Deep Research Prompt Service
 * 
 * Usa LangChain (via LlmFactory) para gerar um prompt otimizado
 * para o Gemini Deep Research Agent, baseado nos metadados do dossiê.
 * 
 * O prompt gerado é editável pelo usuário e será enviado ao Deep Research.
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createLlmForTask, getAssignment } from './llm/llm-factory'
import { getClassificationById } from '../constants/intelligence-classifications'

// =============================================================================
// TIPOS
// =============================================================================

export interface DeepResearchPromptRequest {
  /** Título do dossiê */
  title: string
  /** Tema / Vetor de retenção */
  theme: string
  /** ID da classificação de inteligência (ciência, true-crime, etc.) */
  classificationId?: string
  /** Tags / Marcadores de metadados */
  tags?: string[]
  /** Fontes já existentes no dossiê (apenas títulos para contexto) */
  existingSourceTitles?: string[]
  /** Assets visuais do dossiê (descrição + tags de cada imagem) */
  imageDescriptions?: { description: string; tags: string }[]
  /** Idioma desejado para o relatório de pesquisa */
  language?: 'pt-br' | 'en'
  /** Profundidade da pesquisa */
  depth?: 'quick' | 'standard' | 'deep'
}

export interface DeepResearchPromptResult {
  /** Prompt sugerido, pronto para uso no Deep Research */
  prompt: string
  /** Metadados da geração */
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  provider: string
  model: string
}

// =============================================================================
// SERVICE
// =============================================================================

export async function generateDeepResearchPrompt(
  request: DeepResearchPromptRequest
): Promise<DeepResearchPromptResult> {
  console.log(`[DeepResearchPrompt] 🔬 Gerando prompt para: "${request.title}"`)

  const assignment = await getAssignment('deep-research-prompt')
  const model = await createLlmForTask('deep-research-prompt', { temperature: 0.6 })

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(request)

  console.log(`[DeepResearchPrompt] 📤 Enviando para ${assignment.provider} (${assignment.model})...`)

  const startTime = Date.now()

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ])

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  // Extrair token usage
  const rawResponse = response as any
  const usage = rawResponse?.usage_metadata ?? rawResponse?.response_metadata?.usage ?? {}
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens)

  const promptText = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content)

  console.log(`[DeepResearchPrompt] ✅ Prompt gerado em ${elapsed}s — ${totalTokens} tokens`)

  return {
    prompt: promptText.trim(),
    usage: { inputTokens, outputTokens, totalTokens },
    provider: assignment.provider.toUpperCase(),
    model: assignment.model
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

function buildSystemPrompt(): string {
  return `Você é um estrategista de pesquisa investigativa especializado em criar prompts otimizados para agentes de pesquisa autônoma (Deep Research).

Sua tarefa é receber os metadados de um dossiê editorial e gerar o MELHOR PROMPT POSSÍVEL para um agente de pesquisa que vai:
1. Navegar pela web de forma autônoma
2. Ler e analisar dezenas de fontes
3. Sintetizar tudo em um relatório investigativo detalhado

## REGRAS OBRIGATÓRIAS:
- Retorne APENAS o prompt de pesquisa, sem explicações, sem preâmbulo, sem markdown extra
- O prompt deve ser claro, direto e direcionar o agente para os ângulos mais ricos
- Adapte o TOM e o FOCO baseado na classificação temática do dossiê:
  • True Crime → foco em timeline forense, perfis de envolvidos, documentos judiciais, contradições nas versões
  • História → foco em contexto de época, fontes primárias, documentos históricos, diferentes interpretações
  • Ciência → foco em papers, dados quantitativos, estado atual da pesquisa, viabilidade, consenso científico
  • Biografia → foco em cronologia de vida, relações, impacto, fontes pessoais, controvérsias
  • Investigação → foco em evidências documentais, seguir o dinheiro, conexões entre entidades
  • Mistério → foco em teorias propostas, evidências para cada uma, lacunas não explicadas
  • Conspiração → foco em documentos desclassificados, fontes oficiais vs alternativas, motivações de poder
- Inclua SEÇÕES que o relatório deve cobrir (adaptadas ao tema)
- Inclua DIRETRIZES de qualidade (priorizar fontes acadêmicas, citar URLs, etc.)
- O prompt deve instruir o idioma do relatório final
- Se existem fontes já coletadas, instrua o agente a NÃO repetir e sim APROFUNDAR

## FORMATO DO PROMPT GERADO:
O prompt deve seguir esta estrutura geral (adaptada ao tema):

1. Instrução principal de pesquisa (1-2 frases)
2. Contexto do dossiê (tema + classificação)
3. Ângulos específicos de investigação (3-7 pontos numerados)
4. Formato esperado do relatório (seções)
5. Diretrizes de qualidade
6. Idioma

Seja ESPECÍFICO ao tema. Não gere prompts genéricos.`
}

function buildUserPrompt(request: DeepResearchPromptRequest): string {
  const classification = request.classificationId
    ? getClassificationById(request.classificationId)
    : undefined

  const language = request.language === 'en' ? 'inglês' : 'português brasileiro'

  const depthLabel = {
    quick: 'Rápida (overview geral, ~2 minutos)',
    standard: 'Padrão (análise completa, ~3-5 minutos)',
    deep: 'Profunda (investigação exaustiva, ~5-10 minutos)'
  }[request.depth || 'standard']

  let prompt = `Gere o prompt de pesquisa otimizado para o seguinte dossiê:\n\n`
  prompt += `📋 TÍTULO: ${request.title}\n`
  prompt += `🎯 TEMA (Vetor de Retenção): ${request.theme}\n`

  if (classification) {
    prompt += `🏷️ CLASSIFICAÇÃO: ${classification.label} — ${classification.description}\n`
  }

  if (request.tags && request.tags.length > 0) {
    prompt += `🔖 MARCADORES: ${request.tags.join(', ')}\n`
  }

  prompt += `🌐 IDIOMA DO RELATÓRIO: ${language}\n`
  prompt += `📊 PROFUNDIDADE: ${depthLabel}\n`

  if (request.existingSourceTitles && request.existingSourceTitles.length > 0) {
    prompt += `\n📚 FONTES JÁ COLETADAS (não repetir, aprofundar):\n`
    request.existingSourceTitles.forEach((title, i) => {
      prompt += `  ${i + 1}. ${title}\n`
    })
  }

  if (request.imageDescriptions && request.imageDescriptions.length > 0) {
    prompt += `\n🖼️ ASSETS VISUAIS DO DOSSIÊ (contexto visual já coletado — use para direcionar a pesquisa):\n`
    request.imageDescriptions.forEach((img, i) => {
      prompt += `  ${i + 1}. ${img.description}`
      if (img.tags) {
        prompt += ` [tags: ${img.tags}]`
      }
      prompt += `\n`
    })
    prompt += `Considere estes assets visuais ao sugerir os ângulos de pesquisa — eles indicam o tipo de evidência visual já disponível e podem sugerir lacunas a investigar.\n`
  }

  prompt += `\nGere o prompt de pesquisa agora. Retorne SOMENTE o prompt, sem explicação.`

  return prompt
}
