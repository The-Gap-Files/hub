import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import type { UpdateDossierDTO, DossierResponse } from '../../types/dossier.types'

// Schema de validação
const UpdateDossierSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  sourceText: z.string().min(10).optional(),
  theme: z.string().min(3).optional(),
  tags: z.array(z.string()).optional(),
  researchData: z.any().optional(),
  isProcessed: z.boolean().optional(),
  visualIdentityContext: z.string().max(500).optional(),
  preferredVisualStyleId: z.string().optional().transform(val => val === '' ? undefined : val),
  preferredSeedId: z.union([z.string().uuid(), z.literal('')]).optional().transform(val => val === '' ? undefined : val),
  channelId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(val => val === '' ? null : val)
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

  // Preparar dados de atualização resolvendo seed automática se necessário
  const updateData: any = { ...data }

  if (data.preferredVisualStyleId && !data.preferredSeedId) {
    const randomValue = Math.floor(Math.random() * 2147483647)
    const seedRecord = await prisma.seed.upsert({
      where: {
        value: randomValue
      },
      update: { usageCount: { increment: 1 } },
      create: {
        value: randomValue,
        usageCount: 1
      }
    })
    updateData.preferredSeedId = seedRecord.id
  }

  // Atualizar dossier
  const dossier = await prisma.dossier.update({
    where: { id },
    data: updateData
  })

  return {
    id: dossier.id,
    title: dossier.title,
    sourceText: dossier.sourceText,
    theme: dossier.theme,
    researchData: dossier.researchData,
    tags: dossier.tags,
    visualIdentityContext: dossier.visualIdentityContext,
    preferredVisualStyleId: dossier.preferredVisualStyleId,
    preferredSeedId: dossier.preferredSeedId,
    isProcessed: dossier.isProcessed,
    createdAt: dossier.createdAt,
    updatedAt: dossier.updatedAt
  }
})
