import { prisma } from '../../utils/prisma'
import type { ChannelResponse } from '../../types/channel.types'

export default defineEventHandler(async (event): Promise<ChannelResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Channel ID is required'
    })
  }

  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      _count: {
        select: { dossiers: true }
      }
    }
  })

  if (!channel) {
    throw createError({
      statusCode: 404,
      message: 'Canal não encontrado'
    })
  }

  return {
    id: channel.id,
    name: channel.name,
    handle: channel.handle,
    description: channel.description,
    platform: channel.platform,
    logoBase64: channel.logoBase64,
    logoMimeType: channel.logoMimeType,
    defaultVisualStyleId: channel.defaultVisualStyleId,
    defaultScriptStyleId: channel.defaultScriptStyleId,
    defaultSeedId: channel.defaultSeedId,
    isActive: channel.isActive,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    dossiersCount: channel._count.dossiers
  }
})
