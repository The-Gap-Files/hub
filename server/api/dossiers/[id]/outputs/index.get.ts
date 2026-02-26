import { prisma } from '../../../../utils/prisma'
import { getVisualStyleById } from '../../../../constants/cinematography/visual-styles'
import { getScriptStyleById } from '../../../../constants/storytelling/script-styles'
import { getClassificationById } from '../../../../constants/content/intelligence-classifications'

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
      enableMotion: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,

      // Campos computados ou relações leves
      scriptStyleId: true,
      visualStyleId: true,
      classificationId: true,
      script: { select: { id: true } },
      costLogs: { select: { cost: true } },
      stageGates: { select: { stage: true, status: true } },
      renderProduct: { select: { mimeType: true, fileSize: true } },
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
    const classification = output.classificationId ? getClassificationById(output.classificationId) : undefined
    const scriptStyle = output.scriptStyleId ? getScriptStyleById(output.scriptStyleId) : undefined
    const visualStyle = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined
    const { script, costLogs, stageGates, renderProduct, relationsFrom, relationsTo, ...rest } = output
    const totalCost = (costLogs || []).reduce((sum: number, log: { cost: number }) => sum + log.cost, 0)

    // Build stageGates map
    const gatesMap: Record<string, string> = {}
    for (const gate of (stageGates || [])) {
      gatesMap[gate.stage] = gate.status
    }

    return {
      ...rest,
      totalCost,
      hasScript: !!script,
      hasVideo: output.status === 'COMPLETED' || output.status === 'RENDERED',
      outputMimeType: renderProduct?.mimeType || null,
      outputSize: renderProduct?.fileSize || null,
      stageGates: gatesMap,
      classification: classification ? { id: classification.id, label: classification.label } : undefined,
      scriptStyle: scriptStyle ? { id: scriptStyle.id, name: scriptStyle.name } : undefined,
      visualStyle: visualStyle ? { id: visualStyle.id, name: visualStyle.name } : undefined,
      relatedOutputs: [
        ...relationsFrom.map((r: any) => ({ ...r.mainOutput, relationType: r.relationType })),
        ...relationsTo.map((r: any) => ({ ...r.relatedOutput, relationType: r.relationType }))
      ]
    }
  })
})
