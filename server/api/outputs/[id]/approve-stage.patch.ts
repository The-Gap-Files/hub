import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const { stage, approved } = body

  if (!stage || typeof approved !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Stage e Approved são obrigatórios' })
  }

  const updateData: any = {}

  switch (stage) {
    case 'SCRIPT':
      updateData.scriptApproved = approved
      break
    case 'IMAGES':
      updateData.imagesApproved = approved
      break
    case 'BGM':
      updateData.bgmApproved = approved
      break
    case 'AUDIO':
      updateData.audioApproved = approved
      break
    case 'MOTION':
      updateData.videosApproved = approved // Flag existente no schema é videosApproved
      break
    default:
      throw createError({ statusCode: 400, message: 'Invalid Stage' })
  }

  const output = await prisma.output.update({
    where: { id },
    data: updateData
  })

  return { success: true, output }
})
