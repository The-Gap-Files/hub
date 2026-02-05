import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import type { UpdateDossierDTO, DossierResponse } from '../../types/dossier.types'

// Schema de validação
const UpdateDossierSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  sourceText: z.string().min(10).optional(),
  theme: z.string().min(3).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().max(50).optional(),
  researchData: z.any().optional(),
  isProcessed: z.boolean().optional()
})

export default defineEventHandler(async (event): Promise<DossierResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Validar request body
  const body = await readBody(event)
  const data = UpdateDossierSchema.parse(body) as UpdateDossierDTO

  // Verificar se dossier existe
  const existing = await prisma.dossier.findUnique({
    where: { id }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  // Atualizar dossier
  const dossier = await prisma.dossier.update({
    where: { id },
    data
  })

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
