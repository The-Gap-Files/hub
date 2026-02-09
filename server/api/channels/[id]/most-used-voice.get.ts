import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')

  if (!channelId) {
    throw createError({
      statusCode: 400,
      message: 'Channel ID is required'
    })
  }

  // Verificar se canal existe
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel) {
    throw createError({
      statusCode: 404,
      message: 'Canal não encontrado'
    })
  }

  // Top 3 narradores mais usados neste canal
  const mostUsed = await prisma.output.groupBy({
    by: ['ttsProvider', 'voiceId'],
    where: {
      dossier: { channelId },
      ttsProvider: { not: null },
      voiceId: { not: null }
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 3
  })

  return {
    channelId,
    channelName: channel.name,
    voices: mostUsed.map(v => ({
      ttsProvider: v.ttsProvider,
      voiceId: v.voiceId,
      usageCount: v._count.id
    }))
  }
})
