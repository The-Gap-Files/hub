import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import type { UpdateChannelDTO, ChannelResponse } from '../../types/channel.types'
import { getVisualStyleById } from '../../constants/cinematography/visual-styles'
import { getScriptStyleById } from '../../constants/storytelling/script-styles'

const UpdateChannelSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  handle: z.string().min(2).max(50).regex(/^@?[a-zA-Z0-9_-]+$/, 'Handle deve conter apenas letras, números, _ ou -').optional(),
  description: z.string().nullable().optional(),
  platform: z.string().max(50).nullable().optional(),
  logoBase64: z.string().nullable().optional(),
  logoMimeType: z.string().max(50).nullable().optional(),
  defaultVisualStyleId: z.string().max(50).nullable().optional().transform(val => val === '' ? null : val),
  defaultScriptStyleId: z.string().max(50).nullable().optional().transform(val => val === '' ? null : val),
  defaultSeedId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(val => val === '' ? null : val),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event): Promise<ChannelResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Channel ID is required'
    })
  }

  const body = await readBody(event)
  const data = UpdateChannelSchema.parse(body) as UpdateChannelDTO

  // Verificar se canal existe
  const existing = await prisma.channel.findUnique({ where: { id } })
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Canal não encontrado'
    })
  }

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

  // Verificar handle único se estiver sendo alterado
  if (data.handle && data.handle !== existing.handle) {
    const handle = data.handle.startsWith('@') ? data.handle : `@${data.handle}`
    const conflict = await prisma.channel.findUnique({ where: { handle } })
    if (conflict) {
      throw createError({
        statusCode: 409,
        message: `Handle '${handle}' já está em uso por outro canal.`
      })
    }
    data.handle = handle
  }

  const updateData: any = { ...data }

  const channel = await prisma.channel.update({
    where: { id },
    data: updateData
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
