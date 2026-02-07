import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID é obrigatório'
      })
    }

    // Buscar a seed e suas imagens de exemplo
    const seed = await prisma.seed.findUnique({
      where: { id },
      include: {
        outputs: {
          where: {
            // Incluir outputs COMPLETED ou CANCELLED (que podem ter imagens geradas)
            status: {
              in: ['COMPLETED', 'CANCELLED']
            }
          },
          include: {
            scenes: {
              include: {
                images: {
                  where: {
                    isSelected: true
                  },
                  select: {
                    id: true,
                    fileData: true,
                    mimeType: true,
                    width: true,
                    height: true,
                    createdAt: true,
                    promptUsed: true
                  },
                  take: 1
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5 // Pegar os 5 vídeos mais recentes
        }
      }
    })

    if (!seed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'DNA não encontrado'
      })
    }

    // Extrair e formatar as imagens
    const samples: Array<{
      id: string
      dataUrl: string
      width: number | null
      height: number | null
      createdAt: string
      promptUsed: string
      outputTitle: string | null
    }> = []

    for (const output of seed.outputs) {
      for (const scene of output.scenes) {
        const image = scene.images[0]
        if (image && samples.length < 12) {
          // Converter Buffer para base64 data URL
          if (image.fileData) {
            const base64 = Buffer.from(image.fileData).toString('base64')
            const dataUrl = `data:${image.mimeType || 'image/png'};base64,${base64}`

            samples.push({
              id: image.id,
              dataUrl,
              width: image.width,
              height: image.height,
              createdAt: image.createdAt.toISOString(),
              promptUsed: image.promptUsed,
              outputTitle: output.title
            })
          }
        }
      }
    }

    return {
      success: true,
      data: {
        seed: {
          id: seed.id,
          value: seed.value,
          usageCount: seed.usageCount
        },
        samples
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erro ao buscar amostras do DNA',
      data: { error: error.message }
    })
  }
})
