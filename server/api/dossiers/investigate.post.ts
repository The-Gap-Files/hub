import { z } from 'zod'
import { investigateSeed } from '../../services/dossier-investigator.service'

/**
 * POST /api/dossiers/investigate
 * 
 * Recebe uma "semente" (palavra, pessoa, tema) e usa IA + busca web
 * para gerar automaticamente todos os metadados de um dossiê.
 * 
 * Body: { query: string }
 * Response: InvestigateResult (título, tema, classificação, tags, estilo, warning, prompt)
 */

const InvestigateSchema = z.object({
  query: z.string().min(2, 'A semente deve ter pelo menos 2 caracteres').max(500, 'A semente deve ter no máximo 500 caracteres')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = InvestigateSchema.parse(body)

  console.log(`[API] 🕵️ POST /api/dossiers/investigate — query: "${data.query}"`)

  const result = await investigateSeed({ query: data.query })

  return result
})
