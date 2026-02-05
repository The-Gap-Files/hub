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
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      message: 'Document ID is required'
    })
  }

  // Verificar se document existe
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      message: 'Document not found'
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
  const image = await prisma.documentImage.create({
    data: {
      documentId,
      description: data.description,
      imageData: imageBuffer,
      mimeType: data.mimeType,
      url: data.url,
      tags: data.tags,
      order: data.order
    }
  })

  return {
    id: image.id,
    documentId: image.documentId,
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
