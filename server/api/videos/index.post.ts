/**
 * POST /api/videos
 * 
 * Inicia a criação de um novo vídeo no pipeline.
 */

import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { VideoPipelineService } from '../../services/pipeline/video-pipeline.service'

const CreateVideoSchema = z.object({
  theme: z.string().min(10, 'O tema deve ter pelo menos 10 caracteres'),
  language: z.string().default('pt-BR'),
  targetDuration: z.number().min(60).max(1800).default(300),
  style: z.string().default('documentary'), // Agora aceita ID do estilo de roteiro
  voiceId: z.string().optional(),
  imageStyle: z.enum(['cinematic', 'photorealistic', 'artistic', 'documentary']).default('cinematic'),
  visualStyle: z.string().optional().default('epictok'),
  seedId: z.string().uuid().optional(), // ID da seed a usar
  aspectRatio: z.enum(['9:16', '16:9']).optional().default('16:9'),
  enableMotion: z.boolean().default(false),
  mustInclude: z.string().optional(),
  mustExclude: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validar input
  const validation = CreateVideoSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Dados inválidos',
      data: validation.error.flatten()
    })
  }

  const options = validation.data

  // Criar serviço
  const pipeline = new VideoPipelineService()

  // 1. Criar o registro do vídeo primeiro para ter o ID
  // Nota: Refatoremos o Pipeline para aceitar um pré-processamento ou apenas execute
  // Por enquanto, vamos deixar o pipeline criar, mas precisamos retornar o ID.
  // Vou modificar o pipeline.execute para ser separado em 'init' e 'run' facilitaria,
  // mas vamos apenas chamar e deixar que ele crie.

  // Para retornar o ID síncronamente, precisamos que o registro seja criado AGORA.
  const video = await prisma.video.create({
    data: {
      title: `Novo vídeo: ${options.theme.substring(0, 50)}...`,
      theme: options.theme,
      language: options.language,
      style: options.style,
      duration: options.targetDuration,
      voiceId: options.voiceId,
      imageStyle: options.imageStyle,
      visualStyle: options.visualStyle,
      seedId: options.seedId, // Seed selecionada
      aspectRatio: options.aspectRatio,
      enableMotion: options.enableMotion,
      mustInclude: options.mustInclude,
      mustExclude: options.mustExclude,
      status: 'PENDING'
    }
  })

  // Iniciar pipeline em background, passando o ID do vídeo já criado
  // Vou precisar ajustar o pipeline.execute para aceitar um ID opcional
  setTimeout(async () => {
    try {
      await pipeline.execute(options, video.id)
    } catch (error) {
      console.error('Pipeline error:', error)
    }
  })

  return {
    success: true,
    data: {
      id: video.id,
      status: video.status,
      message: 'Vídeo criado e pipeline iniciado'
    }
  }
})
