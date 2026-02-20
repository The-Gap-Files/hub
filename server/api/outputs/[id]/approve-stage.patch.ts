import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const { stage, approved } = body

  if (!stage || typeof approved !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Stage e Approved são obrigatórios' })
  }

  const updateData: any = {}

  switch (stage) {
    case 'STORY_OUTLINE':
      updateData.storyOutlineApproved = approved
      // Salvar o nível tonal do hook selecionado pelo usuário no JSON do outline
      if (approved && body.selectedHookLevel) {
        const currentOutput = await prisma.output.findUnique({
          where: { id },
          select: { storyOutline: true }
        })
        if (currentOutput?.storyOutline && typeof currentOutput.storyOutline === 'object') {
          updateData.storyOutline = {
            ...(currentOutput.storyOutline as any),
            _selectedHookLevel: body.selectedHookLevel,
            ...(body.selectedHookLevel === 'custom' && body.customHook ? { _customHook: body.customHook } : {}),
            // Custom scenes do criador (narração + imagem de referência por cena)
            ...(Array.isArray(body.customScenes) && body.customScenes.length > 0
              ? {
                  _customScenes: body.customScenes.slice(0, 5).map((s: any, i: number) => ({
                    order: s.order || i + 1,
                    narration: String(s.narration || '').trim(),
                    referenceImageId: s.referenceImageId || null,
                    imagePrompt: s.imagePrompt ? String(s.imagePrompt).trim() : null
                  })).filter((s: any) => s.narration)
                }
              : {})
          }
        }
      }
      break
    case 'SCRIPT':
      updateData.scriptApproved = approved
      break
    case 'IMAGES':
      updateData.imagesApproved = approved
      break
    case 'BGM':
      updateData.bgmApproved = approved
      break
    case 'AUDIO':
      updateData.audioApproved = approved
      break
    case 'MOTION':
      updateData.videosApproved = approved // Flag existente no schema é videosApproved
      break
    case 'RENDER':
      updateData.renderApproved = approved
      if (approved) {
        updateData.status = 'COMPLETED'
        updateData.completedAt = new Date()
      }
      break
    default:
      throw createError({ statusCode: 400, message: 'Invalid Stage' })
  }

  // Se não é aprovação de render, resetar status GENERATING residual.
  // O status GENERATING pode ficar "preso" se um processo anterior crashou
  // ou foi interrompido. Aprovações de assets não devem herdar esse status.
  if (stage !== 'RENDER' && approved) {
    const current = await prisma.output.findUnique({ where: { id }, select: { status: true } })
    if (current?.status === 'GENERATING') {
      updateData.status = 'PENDING'
      updateData.errorMessage = null
    }
  }

  const output = await prisma.output.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      status: true,
      storyOutlineApproved: true,
      scriptApproved: true,
      imagesApproved: true,
      audioApproved: true,
      bgmApproved: true,
      videosApproved: true,
      renderApproved: true
    }
  })

  return { success: true, output }
})
