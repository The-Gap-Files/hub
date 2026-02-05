import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'

const CreateNoteSchema = z.object({
  content: z.string().min(1),
  noteType: z.enum(['insight', 'connection', 'question', 'idea']).optional(),
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
  const data = CreateNoteSchema.parse(body)

  // Criar note
  const note = await prisma.documentNote.create({
    data: {
      documentId,
      ...data
    }
  })

  return note
})
