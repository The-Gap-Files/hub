import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import type { CreateOutputsDTO, CreateOutputsResponse } from '~/server/types/output.types'

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
  mustInclude: z.string().optional(),
  mustExclude: z.string().optional(),
  scriptStyleId: z.string().uuid().optional(),
  visualStyleId: z.string().uuid().optional(),
  seedId: z.string().uuid().optional()
})

const CreateOutputsSchema = z.object({
  outputs: z.array(CreateOutputSchema).min(1).max(10) // Máximo 10 outputs por vez
})

export default defineEventHandler(async (event): Promise<CreateOutputsResponse> => {
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
  const data = CreateOutputsSchema.parse(body) as CreateOutputsDTO

  // Criar outputs em batch
  const outputs = await prisma.$transaction(
    data.outputs.map((outputData) =>
      prisma.output.create({
        data: {
          documentId,
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

  return {
    outputs: outputs.map((output) => ({
      id: output.id,
      documentId: output.documentId,
      outputType: output.outputType,
      format: output.format,
      title: output.title || undefined,
      duration: output.duration || undefined,
      aspectRatio: output.aspectRatio || undefined,
      platform: output.platform || undefined,
      status: output.status,
      scriptApproved: output.scriptApproved,
      imagesApproved: output.imagesApproved,
      videosApproved: output.videosApproved,
      errorMessage: output.errorMessage || undefined,
      createdAt: output.createdAt,
      updatedAt: output.updatedAt,
      completedAt: output.completedAt || undefined
    })),
    total: outputs.length
  }
})
