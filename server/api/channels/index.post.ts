import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import type { CreateChannelDTO, ChannelResponse } from '../../types/channel.types'
import { getVisualStyleById } from '../../constants/visual-styles'
import { getScriptStyleById } from '../../constants/script-styles'

const CreateChannelSchema = z.object({
  name: z.string().min(2).max(100),
  handle: z.string().min(2).max(50).regex(/^@?[a-zA-Z0-9_-]+$/, 'Handle deve conter apenas letras, números, _ ou -'),
  description: z.string().optional(),
  platform: z.string().max(50).optional(),
  logoBase64: z.string().optional(),
  logoMimeType: z.string().max(50).optional(),
  defaultVisualStyleId: z.string().max(50).optional().transform(val => val === '' ? undefined : val),
  defaultScriptStyleId: z.string().max(50).optional().transform(val => val === '' ? undefined : val),
  defaultSeedId: z.union([z.string().uuid(), z.literal('')]).optional().transform(val => val === '' ? undefined : val)
})

export default defineEventHandler(async (event): Promise<ChannelResponse> => {
  const body = await readBody(event)
  const data = CreateChannelSchema.parse(body) as CreateChannelDTO

  // Normalizar handle: garantir que começa com @
  const handle = data.handle.startsWith('@') ? data.handle : `@${data.handle}`

  // Validar visual style se informado
  if (data.defaultVisualStyleId && !getVisualStyleById(data.defaultVisualStyleId)) {
    throw createError({
      statusCode: 422,
      message: `Visual style '${data.defaultVisualStyleId}' não encontrado no registro de estilos.`
    })
  }

  // Validar script style se informado
  if (data.defaultScriptStyleId && !getScriptStyleById(data.defaultScriptStyleId)) {
    throw createError({
      statusCode: 422,
      message: `Script style '${data.defaultScriptStyleId}' não encontrado no registro de estilos.`
    })
  }

  // Verificar handle único
  const existing = await prisma.channel.findUnique({ where: { handle } })
  if (existing) {
    throw createError({
      statusCode: 409,
      message: `Handle '${handle}' já está em uso por outro canal.`
    })
  }

  // Resolver seed se informado
  let defaultSeedId = data.defaultSeedId
  if (data.defaultVisualStyleId && !defaultSeedId) {
    const randomValue = Math.floor(Math.random() * 2147483647)
    const seedRecord = await prisma.seed.upsert({
      where: { value: randomValue },
      update: { usageCount: { increment: 1 } },
      create: { value: randomValue, usageCount: 1 }
    })
    defaultSeedId = seedRecord.id
  }

  const channel = await prisma.channel.create({
    data: {
      name: data.name,
      handle,
      description: data.description,
      platform: data.platform,
      logoBase64: data.logoBase64,
      logoMimeType: data.logoMimeType,
      defaultVisualStyleId: data.defaultVisualStyleId,
      defaultScriptStyleId: data.defaultScriptStyleId,
      defaultSeedId
    }
  })

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
    updatedAt: channel.updatedAt
  }
})
