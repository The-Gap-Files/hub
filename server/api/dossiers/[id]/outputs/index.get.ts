import { prisma } from '../../../../utils/prisma'
import { getVisualStyleById } from '../../../../constants/visual-styles'
import { getScriptStyleById } from '../../../../constants/script-styles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  const outputs = await prisma.output.findMany({
    where: { dossierId: id },
    select: {
      id: true,
      dossierId: true,
      outputType: true,
      format: true,
      title: true,
      duration: true,
      aspectRatio: true,
      platform: true,
      status: true,
      scriptApproved: true,
      imagesApproved: true,
      audioApproved: true,
      videosApproved: true,
      enableMotion: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,

      // Campos computados ou relações leves
      outputMimeType: true,
      outputSize: true,
      scriptStyleId: true,
      visualStyleId: true,
      relationsTo: {
        select: {
          id: true,
          relationType: true,
          relatedOutput: {
            select: { id: true, outputType: true, status: true }
          }
        }
      },
      relationsFrom: {
        select: {
          id: true,
          relationType: true,
          mainOutput: {
            select: { id: true, outputType: true, status: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return outputs.map((output: any) => {
    const scriptStyle = output.scriptStyleId ? getScriptStyleById(output.scriptStyleId) : undefined
    const visualStyle = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined
    return {
      ...output,
      hasVideo: output.status === 'COMPLETED',
      scriptStyle: scriptStyle ? { id: scriptStyle.id, name: scriptStyle.name } : undefined,
      visualStyle: visualStyle ? { id: visualStyle.id, name: visualStyle.name } : undefined,
      relatedOutputs: [
        ...output.relationsFrom.map((r: any) => ({ ...r.mainOutput, relationType: r.relationType })),
        ...output.relationsTo.map((r: any) => ({ ...r.relatedOutput, relationType: r.relationType }))
      ]
    }
  })
})
