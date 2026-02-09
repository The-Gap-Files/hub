import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import type { CreateOutputsDTO, CreateOutputsResponse } from '../../../../types/output.types'
import { getClassificationById } from '../../../../constants/intelligence-classifications'
import { getScriptStyleById } from '../../../../constants/script-styles'

// Schema de validação
const OutputTypeEnum = z.enum(['VIDEO_TEASER', 'VIDEO_FULL', 'TWITTER_THREAD', 'LINKEDIN_POST', 'INSTAGRAM_POST', 'PODCAST_EPISODE', 'BLOG_ARTICLE'])

const CreateOutputSchema = z.object({
  outputType: OutputTypeEnum,
  format: z.string().min(1).max(50),
  title: z.string().max(255).optional(),
  duration: z.number().int().min(15).max(3600).optional(),
  aspectRatio: z.string().max(10).optional(),
  platform: z.string().max(50).optional(),
  targetWPM: z.number().int().min(100).max(200).optional().default(150),
  language: z.string().max(10).optional().default('pt-BR'),
  narrationLanguage: z.string().max(10).optional().default('pt-BR'),
  voiceId: z.string().max(100).optional(),
  enableMotion: z.boolean().optional().default(false),
  objective: z.string().max(2000).optional().transform(val => val === '' ? undefined : val),
  mustInclude: z.string().optional(),
  mustExclude: z.string().optional(),
  classificationId: z.string().max(50).optional().transform(val => val === '' ? undefined : val),
  scriptStyleId: z.string().optional().transform(val => val === '' ? undefined : val),
  visualStyleId: z.string().optional().transform(val => val === '' ? undefined : val),
  seedId: z.union([z.string().uuid(), z.literal('')]).optional().transform(val => val === '' ? undefined : val)
})

const CreateOutputsSchema = z.object({
  outputs: z.array(CreateOutputSchema).min(1).max(10) // Máximo 10 outputs por vez
})

export default defineEventHandler(async (event): Promise<CreateOutputsResponse> => {
  const dossierId = getRouterParam(event, 'id')

  if (!dossierId) {
    throw createError({
      statusCode: 400,
      message: 'Dossier ID is required'
    })
  }

  // Verificar se dossier existe (incluir canal para herança de defaults)
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { channel: true }
  })

  if (!dossier) {
    throw createError({
      statusCode: 404,
      message: 'Dossier not found'
    })
  }

  // Validar body
  const body = await readBody(event)
  const data = CreateOutputsSchema.parse(body) as CreateOutputsDTO

  // Resolver seeds, classificação e estilos (hierarquia: classification → script → visual)
  // Fallback 3 níveis: Output → Dossier → Channel → ScriptStyle
  const outputsToCreate: Array<typeof data.outputs[0] & { classificationId?: string; scriptStyleId?: string; visualStyleId?: string; seedId?: string }> = []
  for (const outputData of data.outputs) {
    const classificationId = outputData.classificationId ?? undefined
    const classification = classificationId ? getClassificationById(classificationId) : undefined
    // Pai → Filho → Neto: aplicar defaults quando não informados (com fallback do Channel)
    const scriptStyleId = outputData.scriptStyleId ?? classification?.defaultScriptStyleId ?? dossier.channel?.defaultScriptStyleId ?? undefined
    const scriptStyle = scriptStyleId ? getScriptStyleById(scriptStyleId) : undefined
    const visualStyleId = outputData.visualStyleId ?? dossier.preferredVisualStyleId ?? dossier.channel?.defaultVisualStyleId ?? scriptStyle?.defaultVisualStyleId ?? undefined
    let seedId: string | null | undefined = outputData.seedId || dossier.preferredSeedId || dossier.channel?.defaultSeedId

    // Se não houver seed mas houver estilo, criar/buscar uma seed aleatória
    if (!seedId && visualStyleId) {
      const randomValue = Math.floor(Math.random() * 2147483647)
      const seedRecord = await prisma.seed.upsert({
        where: {
          value: randomValue
        },
        update: {
          usageCount: { increment: 1 }
        },
        create: {
          value: randomValue,
          usageCount: 1
        }
      })
      seedId = seedRecord.id
    }

    outputsToCreate.push({
      ...outputData,
      classificationId: classificationId ?? undefined,
      scriptStyleId: scriptStyleId ?? undefined,
      visualStyleId: visualStyleId ?? undefined,
      seedId: seedId ?? undefined
    })
  }

  // Criar outputs em batch
  const outputs = await prisma.$transaction(
    outputsToCreate.map((outputData) =>
      prisma.output.create({
        data: {
          dossierId,
          outputType: outputData.outputType,
          format: outputData.format,
          title: outputData.title,
          duration: outputData.duration,
          aspectRatio: outputData.aspectRatio,
          platform: outputData.platform,
          targetWPM: outputData.targetWPM,
          language: outputData.language || 'pt-BR',
          narrationLanguage: outputData.narrationLanguage || 'pt-BR',
          voiceId: outputData.voiceId,
          enableMotion: outputData.enableMotion || false,
          objective: outputData.objective,
          mustInclude: outputData.mustInclude,
          mustExclude: outputData.mustExclude,
          classificationId: outputData.classificationId ?? undefined,
          scriptStyleId: outputData.scriptStyleId ?? undefined,
          visualStyleId: outputData.visualStyleId ?? undefined,
          seedId: outputData.seedId,
          status: 'PENDING'
        }
      })
    )
  )

  // Story Architect é etapa isolada: NÃO disparar generateScript aqui.
  // Fluxo: usuário abre o output → Gera plano (generate-outline) → Aprova plano (STORY_OUTLINE) → Gera roteiro (generate-script).

  return {
    outputs: outputs.map((output: any) => ({
      id: output.id,
      dossierId: output.dossierId,
      outputType: output.outputType,
      format: output.format,
      title: output.title || undefined,
      duration: output.duration || undefined,
      aspectRatio: output.aspectRatio || undefined,
      platform: output.platform || undefined,
      enableMotion: output.enableMotion,
      status: output.status,
      scriptApproved: output.scriptApproved,
      imagesApproved: output.imagesApproved,
      bgmApproved: output.bgmApproved,
      audioApproved: output.audioApproved,
      videosApproved: output.videosApproved,
      renderApproved: output.renderApproved,
      hasBgm: false,
      errorMessage: output.errorMessage || undefined,
      createdAt: output.createdAt,
      updatedAt: output.updatedAt,
      completedAt: output.completedAt || undefined
    })),
    total: outputs.length
  }
})
