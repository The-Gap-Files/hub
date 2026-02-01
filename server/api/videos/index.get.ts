/**
 * GET /api/videos
 * 
 * Lista todos os vídeos com paginação e filtros.
 */

import { z } from 'zod'
import { prisma } from '../../utils/prisma'

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum([
    'PENDING', 'SCRIPT_GENERATING', 'SCRIPT_READY',
    'AUDIO_GENERATING', 'AUDIO_READY', 'IMAGES_GENERATING',
    'IMAGES_READY', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED'
  ]).optional(),
  search: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const params = QuerySchema.parse(query)

  const where = {
    ...(params.status && { status: params.status }),
    ...(params.search && {
      OR: [
        { title: { contains: params.search, mode: 'insensitive' as const } },
        { theme: { contains: params.search, mode: 'insensitive' as const } }
      ]
    })
  }

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        theme: true,
        status: true,
        duration: true,
        language: true,
        thumbnailPath: true,
        createdAt: true,
        completedAt: true
      }
    }),
    prisma.video.count({ where })
  ])

  return {
    success: true,
    data: videos,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit)
    }
  }
})
