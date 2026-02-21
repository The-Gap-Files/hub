/**
 * POST /api/sources/[id]/summarize
 * 
 * Resume o conteúdo de uma fonte do dossiê usando LangChain.
 * Para textos que excedem o contexto do modelo, usa estratégia Map-Reduce:
 *   1. Divide o texto em chunks que cabem no contexto
 *   2. Resume cada chunk individualmente (MAP)
 *   3. Consolida os resumos parciais em um resumo final (REDUCE)
 */

import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'
import { createLlmForTask, getAssignment } from '../../../services/llm/llm-factory'
import type { LlmTaskId } from '../../../constants/providers/llm-registry'

const BodySchema = z.object({
  save: z.boolean().default(false)
})

// ~80K tokens por chunk (320K chars), com margem para system prompt
const MAX_CHUNK_CHARS = 320_000

export default defineEventHandler(async (event) => {
  const sourceId = getRouterParam(event, 'id')

  if (!sourceId) {
    throw createError({
      statusCode: 400,
      message: 'Source ID is required'
    })
  }

  const source = await prisma.dossierSource.findUnique({
    where: { id: sourceId }
  })

  if (!source) {
    throw createError({
      statusCode: 404,
      message: 'Source not found'
    })
  }

  const wordCount = source.content.split(/\s+/).length
  if (wordCount < 500) {
    throw createError({
      statusCode: 422,
      message: `Conteúdo já é curto (${wordCount} palavras). Resumo não necessário.`
    })
  }

  const body = await readBody(event).catch(() => ({}))
  const { save } = BodySchema.parse(body)

  const TASK_ID: LlmTaskId = 'summarize'


  try {
    const llm = await createLlmForTask(TASK_ID, { temperature: 0.3, maxTokens: 8192 })
    const assignment = await getAssignment(TASK_ID)
    const startTime = Date.now()
    let totalInputTokens = 0
    let totalOutputTokens = 0

    // Decidir estratégia: direto ou map-reduce
    const contentLength = source.content.length
    const needsChunking = contentLength > MAX_CHUNK_CHARS

    let summary: string

    if (!needsChunking) {
      // ═══ ESTRATÉGIA DIRETA (cabe no contexto) ═══
      console.log(`[SummarizeSource] 📝 Resumindo fonte "${source.title}" (${wordCount} palavras) — modo direto`)

      const result = await invokeSummarize(llm, source.content, source.title, source.sourceType)
      summary = result.summary
      totalInputTokens += result.inputTokens
      totalOutputTokens += result.outputTokens
    } else {
      // ═══ ESTRATÉGIA MAP-REDUCE (excede o contexto) ═══
      const chunks = splitIntoChunks(source.content, MAX_CHUNK_CHARS)
      console.log(`[SummarizeSource] 📝 Resumindo fonte "${source.title}" (${wordCount} palavras) — modo MAP-REDUCE (${chunks.length} chunks)`)

      // FASE MAP: resumir cada chunk
      const partialSummaries: string[] = []
      let chunkIndex = 0
      for (const chunk of chunks) {
        const chunkWords = chunk.split(/\s+/).length
        console.log(`[SummarizeSource]   📄 Chunk ${chunkIndex + 1}/${chunks.length} (~${chunkWords.toLocaleString()} palavras)...`)

        const result = await invokeSummarize(
          llm,
          chunk,
          `${source.title} (Parte ${chunkIndex + 1}/${chunks.length})`,
          source.sourceType,
          true // isChunk
        )
        partialSummaries.push(result.summary)
        totalInputTokens += result.inputTokens
        totalOutputTokens += result.outputTokens
        chunkIndex++
      }

      // FASE REDUCE: consolidar os resumos parciais
      console.log(`[SummarizeSource]    Consolidando ${partialSummaries.length} resumos parciais...`)
      const combinedText = partialSummaries.map((s, i) => `=== PARTE ${i + 1} ===\n${s}`).join('\n\n')

      const reduceResult = await invokeReduce(llm, combinedText, source.title)
      summary = reduceResult.summary
      totalInputTokens += reduceResult.inputTokens
      totalOutputTokens += reduceResult.outputTokens
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    const summaryWordCount = summary.split(/\s+/).length

    console.log(`[SummarizeSource] ✅ Resumo: ${wordCount.toLocaleString()} → ${summaryWordCount.toLocaleString()} palavras (${elapsed}s)`)
    console.log(`[SummarizeSource] 📊 Tokens totais: ${totalInputTokens.toLocaleString()} in + ${totalOutputTokens.toLocaleString()} out`)

    if (save) {
      await prisma.dossierSource.update({
        where: { id: sourceId },
        data: { content: summary }
      })
      console.log(`[SummarizeSource] 💾 Resumo salvo na fonte ${sourceId}`)
    }

    // Registrar custo
    const modelUsed = assignment.model
    const summaryCost = calculateLLMCost(modelUsed, totalInputTokens, totalOutputTokens)

    costLogService.log({
      dossierId: source.dossierId,
      resource: 'insights',
      action: 'create',
      provider: assignment.provider.toUpperCase(),
      model: modelUsed,
      cost: summaryCost,
      metadata: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens, total_tokens: totalInputTokens + totalOutputTokens },
      detail: `Resumo de fonte: ${source.title}${needsChunking ? ' (map-reduce)' : ''}`
    }).catch((err: any) => console.error('[SummarizeSource] CostLog:', err))

    return {
      success: true,
      summary,
      originalWordCount: wordCount,
      summaryWordCount,
      saved: save,
      chunked: needsChunking,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
    }
  } catch (error: any) {
    console.error('[SummarizeSource] ❌ Erro:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao resumir conteúdo'
    })
  }
})

// =============================================================================
// HELPERS
// =============================================================================

/** Divide texto em chunks respeitando quebras de parágrafos */
function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining)
      break
    }

    // Tentar cortar em quebra de parágrafo (\n\n)
    let cutPoint = remaining.lastIndexOf('\n\n', maxChars)

    // Se não encontrou parágrafo, tentar quebra de linha
    if (cutPoint < maxChars * 0.5) {
      cutPoint = remaining.lastIndexOf('\n', maxChars)
    }

    // Se ainda não encontrou, cortar em espaço
    if (cutPoint < maxChars * 0.5) {
      cutPoint = remaining.lastIndexOf(' ', maxChars)
    }

    // Último recurso: cortar no limite
    if (cutPoint < maxChars * 0.3) {
      cutPoint = maxChars
    }

    chunks.push(remaining.slice(0, cutPoint))
    remaining = remaining.slice(cutPoint).trimStart()
  }

  return chunks
}

/** Fase MAP: resume um chunk individual */
async function invokeSummarize(
  llm: any,
  content: string,
  title: string,
  sourceType: string,
  isChunk: boolean = false
): Promise<{ summary: string; inputTokens: number; outputTokens: number }> {
  const systemPrompt = `Você é um especialista em síntese de informações para produção de conteúdo audiovisual.

Sua tarefa é resumir o texto fornecido, mantendo TODAS as informações essenciais:
- Fatos, datas, nomes e locais específicos
- Dados estatísticos e números
- Citações relevantes
- Relações causais e cronológicas
- Detalhes que gerem engajamento narrativo

REGRAS:
${isChunk
      ? '- Mantenha o resumo entre 1000 e 2000 palavras (este é um trecho parcial do documento)'
      : '- Mantenha o resumo entre 1500 e 2500 palavras'}
- Preserve dados factuais — NUNCA invente informações
- Escreva em português brasileiro
- Use parágrafos curtos e objetivos
- Mantenha a estrutura lógica do material original
- Priorize informações únicas e diferenciadas`

  const userPrompt = `Resuma o seguinte texto de forma concisa mas completa:\n\n---\nTÍTULO: ${title}\nTIPO: ${sourceType}\n---\n\n${content}`

  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ])

  const usage = result.usage_metadata || result.response_metadata?.usage
  return {
    summary: result.content as string,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0
  }
}

/** Fase REDUCE: consolida resumos parciais em um resumo final */
async function invokeReduce(
  llm: any,
  combinedSummaries: string,
  title: string
): Promise<{ summary: string; inputTokens: number; outputTokens: number }> {
  const systemPrompt = `Você é um especialista em síntese editorial. Sua tarefa é consolidar múltiplos resumos parciais de um mesmo documento em um resumo final único, coeso e completo.

REGRAS:
- Mantenha o resumo final entre 2000 e 3000 palavras
- Elimine redundâncias entre as partes
- Mantenha a estrutura cronológica/lógica do material
- Preserve TODOS os dados factuais: datas, nomes, números e estatísticas
- Escreva em português brasileiro
- Produza um texto fluido, como se fosse um resumo único desde o início
- NUNCA invente informações que não estejam nos resumos parciais`

  const userPrompt = `Consolide os seguintes resumos parciais do documento "${title}" em um resumo final único e coeso:\n\n${combinedSummaries}`

  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt)
  ])

  const usage = result.usage_metadata || result.response_metadata?.usage
  return {
    summary: result.content as string,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0
  }
}
