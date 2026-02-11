/**
 * POST /api/scenes/:id/sanitize-prompt
 * 
 * Reescreve o visualDescription de uma cena bloqueada pelo filtro de conteúdo
 * em um nível de segurança escolhido pelo usuário.
 * 
 * Níveis:
 * - 'intense'  → Prompt original (sem alteração)
 * - 'moderate' → Evita termos explícitos, usa metáforas visuais
 * - 'safe'     → Linguagem totalmente abstrata e atmosférica
 */

import { prisma } from '../../../utils/prisma'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createLlmForTask } from '../../../services/llm/llm-factory'

const SAFETY_INSTRUCTIONS: Record<string, string> = {
  moderate: `Você é um especialista em prompt engineering para modelos de geração de imagem.

TAREFA: Reescrever o prompt visual abaixo para que seja aceito por filtros de conteúdo de modelos de imagem (Luma, DALL-E, Stable Diffusion).

REGRAS:
- Manter o MESMO significado narrativo e atmosfera cinematográfica
- Substituir termos explícitos de violência (blood, gore, wound, murder, corpse, dead body, weapon aimed at someone) por equivalentes visuais indiretos (shadows, silhouettes, dramatic tension, ominous atmosphere)
- Substituir referências sexuais por linguagem artística (elegance, poise, classical beauty)
- Manter a composição visual (ângulos, iluminação, atmosfera)
- Manter SEMPRE em INGLÊS
- NÃO adicionar explicações — retornar APENAS o prompt reescrito
- Manter o comprimento similar ao original`,

  safe: `Você é um especialista em prompt engineering para modelos de geração de imagem.

TAREFA: Reescrever o prompt visual abaixo em linguagem TOTALMENTE SEGURA para modelos de imagem com filtros rigorosos.

REGRAS:
- Transformar a cena em uma versão completamente abstrata e atmosférica
- ZERO termos de violência, armas, sangue, morte, nudez ou qualquer conteúdo potencialmente sensível
- Focar em: atmosfera, iluminação, composição, texturas, cores, sombras, arquitetura, paisagens
- Usar linguagem puramente artística e cinematográfica
- Se a cena original envolvia uma pessoa em perigo, transformar em "figura solitária em ambiente dramático"
- Se envolvia crime, transformar em "ambiente tenso com sombras profundas"
- Manter SEMPRE em INGLÊS
- NÃO adicionar explicações — retornar APENAS o prompt reescrito
- Manter o comprimento similar ao original`
}

export default defineEventHandler(async (event) => {
  const sceneId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!sceneId) throw createError({ statusCode: 400, message: 'Scene ID required' })

  const level = body.level as string
  if (!level || !['intense', 'moderate', 'safe'].includes(level)) {
    throw createError({ statusCode: 400, message: 'Level must be: intense, moderate, or safe' })
  }

  // Buscar cena
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { id: true, visualDescription: true, imageStatus: true }
  })

  if (!scene) throw createError({ statusCode: 404, message: 'Scene not found' })

  // Se 'intense', retorna o prompt original sem passar pela LLM
  if (level === 'intense') {
    return { sanitizedPrompt: scene.visualDescription, level: 'intense' }
  }

  // Chamar LLM via Factory (provider/modelo controlados pela UI)
  const model = await createLlmForTask('sanitize', { temperature: 0.3, maxTokens: 1024 })

  const systemPrompt = SAFETY_INSTRUCTIONS[level]!

  console.log(`[SanitizePrompt] Rewriting scene ${sceneId} at level '${level}'`)
  console.log(`[SanitizePrompt] Original: ${scene.visualDescription.substring(0, 80)}...`)

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(scene.visualDescription)
  ])

  const sanitizedPrompt = (response.content as string).trim()

  console.log(`[SanitizePrompt] Sanitized (${level}): ${sanitizedPrompt.substring(0, 80)}...`)

  return {
    sanitizedPrompt,
    level,
    originalPrompt: scene.visualDescription
  }
})
