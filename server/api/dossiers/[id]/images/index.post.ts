import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'

const CreateImageSchema = z.object({
  description: z.string().min(1),
  imageData: z.string().optional(), // Base64 encoded
  mimeType: z.string().optional(),
  url: z.string().url().optional(),
  tags: z.string().optional(),
  order: z.number().int().min(0).optional().default(0)
})

export default defineEventHandler(async (event) => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Verificar se dossier existe
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId }
  })

  if (!dossier) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  // Validar body
  const body = await readBody(event)
  const data = CreateImageSchema.parse(body)

  // Converter base64 para buffer se necessário
  let imageBuffer: Buffer | undefined
  if (data.imageData) {
    imageBuffer = Buffer.from(data.imageData, 'base64')
  }

  // Criar image
  const image = await prisma.dossierImage.create({
    data: {
      dossierId,
      description: data.description,
      imageData: imageBuffer as any,
      mimeType: data.mimeType,
      url: data.url,
      tags: data.tags,
      order: data.order
    }
  })

  return {
    id: image.id,
    dossierId: image.dossierId,
    description: image.description,
    mimeType: image.mimeType,
    url: image.url,
    tags: image.tags,
    order: image.order,
    createdAt: image.createdAt,
    // Não retornar imageData (muito grande)
    hasImageData: !!image.imageData
  }
})
