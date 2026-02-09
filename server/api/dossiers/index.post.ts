import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import type { CreateDossierDTO, DossierResponse } from '../../types/dossier.types'

// Schema de validação
const CreateDossierSchema = z.object({
  title: z.string().min(3).max(255),
  sourceText: z.string().min(10),
  theme: z.string().min(3),
  tags: z.array(z.string()).optional().default([]),
  visualIdentityContext: z.string().max(500).optional(),
  preferredVisualStyleId: z.string().optional().transform(val => val === '' ? undefined : val),
  preferredSeedId: z.union([z.string().uuid(), z.literal('')]).optional().transform(val => val === '' ? undefined : val),
  channelId: z.string().uuid().optional().transform(val => val === '' ? undefined : val)
})

export default defineEventHandler(async (event): Promise<DossierResponse> => {
  // Validar request body
  const body = await readBody(event)
  console.log('DEBUG DOSSIER PAYLOAD:', JSON.stringify(body, null, 2))
  const data = CreateDossierSchema.parse(body) as CreateDossierDTO

  let preferredSeedId = data.preferredSeedId

  // Se escolheu estilo mas não escolheu seed, gerar uma fixa agora
  if (data.preferredVisualStyleId && !preferredSeedId) {
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
    preferredSeedId = seedRecord.id
  }

  // Criar dossier
  const dossier = await prisma.dossier.create({
    data: {
      title: data.title,
      sourceText: data.sourceText,
      theme: data.theme,
      tags: data.tags || [],
      visualIdentityContext: data.visualIdentityContext,
      preferredVisualStyleId: data.preferredVisualStyleId,
      preferredSeedId: preferredSeedId,
      channelId: data.channelId,
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
    visualIdentityContext: dossier.visualIdentityContext,
    preferredVisualStyleId: dossier.preferredVisualStyleId,
    preferredSeedId: dossier.preferredSeedId,
    isProcessed: dossier.isProcessed,
    createdAt: dossier.createdAt,
    updatedAt: dossier.updatedAt
  }
})
