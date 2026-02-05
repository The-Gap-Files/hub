import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import type { CreateDossierDTO, DossierResponse } from '../../types/dossier.types'

// Schema de validação
const CreateDossierSchema = z.object({
  title: z.string().min(3).max(255),
  sourceText: z.string().min(10),
  theme: z.string().min(3),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().max(50).optional()
})

export default defineEventHandler(async (event): Promise<DossierResponse> => {
  // Validar request body
  const body = await readBody(event)
  const data = CreateDossierSchema.parse(body) as CreateDossierDTO

  // Criar dossier
  const dossier = await prisma.dossier.create({
    data: {
      title: data.title,
      sourceText: data.sourceText,
      theme: data.theme,
      tags: data.tags || [],
      category: data.category,
      isProcessed: false
    }
  })

  // Retornar response
  return {
    id: dossier.id,
    title: dossier.title,
    sourceText: dossier.sourceText,
    theme: dossier.theme,
    researchData: dossier.researchData,
    tags: dossier.tags,
    category: dossier.category || undefined,
    isProcessed: dossier.isProcessed,
    createdAt: dossier.createdAt,
    updatedAt: dossier.updatedAt
  }
})

