import { prisma } from '../../utils/prisma'
import type { ChannelListResponse } from '../../types/channel.types'

export default defineEventHandler(async (event): Promise<ChannelListResponse> => {
  const query = getQuery(event)
  const includeInactive = query.includeInactive === 'true'

  const where = includeInactive ? {} : { isActive: true }

  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { dossiers: true }
        }
      }
    }),
    prisma.channel.count({ where })
  ])

  return {
    channels: channels.map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      handle: ch.handle,
      description: ch.description,
      platform: ch.platform,
      logoBase64: ch.logoBase64,
      logoMimeType: ch.logoMimeType,
      defaultVisualStyleId: ch.defaultVisualStyleId,
      defaultScriptStyleId: ch.defaultScriptStyleId,
      defaultSeedId: ch.defaultSeedId,
      isActive: ch.isActive,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt,
      dossiersCount: ch._count.dossiers
    })),
    total
  }
})
