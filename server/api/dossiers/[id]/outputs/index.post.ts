import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import type { CreateOutputsDTO, CreateOutputsResponse } from '../../../../types/output.types'
import { outputPipelineService } from '../../../../services/pipeline/output-pipeline.service'

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
  const data = CreateOutputsSchema.parse(body) as CreateOutputsDTO

  // Resolver seeds e estilos antes de criar (para garantir relacionamento fixo)
  const outputsToCreate = []
  for (const outputData of data.outputs) {
    const visualStyleId = outputData.visualStyleId || dossier.preferredVisualStyleId
    let seedId = outputData.seedId || dossier.preferredSeedId

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
      visualStyleId,
      seedId
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
          scriptStyleId: outputData.scriptStyleId,
          visualStyleId: outputData.visualStyleId,
          seedId: outputData.seedId,
          status: 'PENDING'
        }
      })
    )
  )

  // Disparar pipeline de geração em background (Fire-and-Forget)
  // Iniciamos apenas a geração de roteiro (primeira etapa)
  outputs.forEach((output) => {
    console.log(`[API] Triggering background SCRIPT GENERATION for output ${output.id}`)
    outputPipelineService.generateScript(output.id).catch(async (err) => {
      console.error(`[API] Script generation failed for output ${output.id}:`, err)
      // Atualizar status para FAILED se der erro no script inicial
      await prisma.output.update({
        where: { id: output.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Unknown error during script generation'
        }
      })
    })
  })

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
      hasBgm: false,
      errorMessage: output.errorMessage || undefined,
      createdAt: output.createdAt,
      updatedAt: output.updatedAt,
      completedAt: output.completedAt || undefined
    })),
    total: outputs.length
  }
})
