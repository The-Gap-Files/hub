import { z } from 'zod'
import { prisma } from '../../../utils/prisma'

const CreateRelationSchema = z.object({
  mainOutputId: z.string().uuid(),
  relatedOutputId: z.string().uuid(),
  relationType: z.enum(['teaser_to_full', 'full_to_teaser', 'cross_platform'])
})

export default defineEventHandler(async (event) => {
  // Validar body
  const body = await readBody(event)
  const data = CreateRelationSchema.parse(body)

  // Verificar se outputs existem
  const [mainOutput, relatedOutput] = await Promise.all([
    prisma.output.findUnique({ where: { id: data.mainOutputId } }),
    prisma.output.findUnique({ where: { id: data.relatedOutputId } })
  ])

  if (!mainOutput) {
    throw createError({
      statusCode: 404,
      message: 'Main output not found'
    })
  }

  if (!relatedOutput) {
    throw createError({
      statusCode: 404,
      message: 'Related output not found'
    })
  }

  // Verificar se outputs pertencem ao mesmo dossier
  if (mainOutput.dossierId !== relatedOutput.dossierId) {
    throw createError({
      statusCode: 422,
      message: 'Outputs must belong to the same dossier'
    })
  }

  // Criar relação
  const relation = await prisma.outputRelation.create({
    data: {
      mainOutputId: data.mainOutputId,
      relatedOutputId: data.relatedOutputId,
      relationType: data.relationType
    }
  })

  return relation
})
