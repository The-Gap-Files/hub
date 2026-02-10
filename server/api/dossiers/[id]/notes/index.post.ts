import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'

const CreateNoteSchema = z.object({
  content: z.string().min(1),
  noteType: z.enum(['insight', 'curiosity', 'data', 'research', 'todo']).optional(),
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
  const data = CreateNoteSchema.parse(body)

  // Criar note
  const note = await prisma.dossierNote.create({
    data: {
      dossierId,
      ...data
    }
  })

  return note
})
