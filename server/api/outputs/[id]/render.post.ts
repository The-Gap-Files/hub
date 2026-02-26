import { prisma } from '../../../utils/prisma'
import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'
import { createPipelineLogger } from '../../../utils/pipeline-logger'
import { CAPTION_STYLES } from '../../../constants/cinematography/caption-styles'

type RenderOptionsBody = {
  includeLogo?: boolean
  includeCaptions?: boolean
  includeStingers?: boolean
  captionStyleId?: string | null
  volumeOverride?: {
    global?: number
    perTrack?: Record<number, number>
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID do Output é obrigatório' })
  }

  const output = await prisma.output.findUnique({ where: { id } })
  if (!output) {
    throw createError({ statusCode: 404, message: 'Output não encontrado' })
  }

  const body = (await readBody(event).catch(() => ({}))) as RenderOptionsBody
  const includeLogo = !!body?.includeLogo
  const includeCaptions = !!body?.includeCaptions
  const captionStyleId = body?.captionStyleId ?? null
  const includeStingers = body?.includeStingers !== false
  const volumeOverride = body?.volumeOverride ?? null

  if (includeCaptions && (!captionStyleId || !(captionStyleId in CAPTION_STYLES))) {
    throw createError({
      statusCode: 400,
      message: 'captionStyleId é obrigatório e deve ser um estilo válido quando includeCaptions é true'
    })
  }

  const hasAnyOption = includeLogo || includeCaptions || volumeOverride || !includeStingers
  const renderOptions = hasAnyOption
    ? { includeLogo, includeCaptions, includeStingers, captionStyleId: includeCaptions ? captionStyleId : null, volumeOverride }
    : null

  const log = createPipelineLogger({ stage: 'API', outputId: id })
  log.info('Render solicitado.', renderOptions ? { renderOptions } : {})

  // Store render options in RenderProduct
  await prisma.renderProduct.upsert({
    where: { outputId: id },
    create: { outputId: id, renderOptions: renderOptions ?? undefined },
    update: { renderOptions: renderOptions ?? undefined },
  })

  // Set StageGate for RENDER to GENERATING
  await prisma.stageGate.upsert({
    where: { outputId_stage: { outputId: id, stage: 'RENDER' } },
    create: { outputId: id, stage: 'RENDER', status: 'GENERATING', executedAt: new Date() },
    update: { status: 'GENERATING', executedAt: new Date(), feedback: null },
  })

  await prisma.output.update({
    where: { id },
    data: { status: 'IN_PROGRESS', completedAt: null }
  })

  outputPipelineService.execute(id).catch((err: Error) => {
    log.error('Erro ao disparar pipeline.', err)
  })

  return {
    success: true,
    message: 'Renderização iniciada em segundo plano'
  }
})
