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

    // Buscar a seed com outputs (cenas) E seed samples (previews, thumbnails, etc.)
    const seed = await prisma.seed.findUnique({
      where: { id },
      include: {
        outputs: {
          where: {
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
          take: 5
        },
        samples: {
          select: {
            id: true,
            source: true,
            prompt: true,
            base64: true,
            mimeType: true,
            aspectRatio: true,
            provider: true,
            model: true,
            metadata: true,
            createdAt: true,
            dossier: {
              select: { id: true, title: true }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 20
        }
      }
    })

    if (!seed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'DNA não encontrado'
      })
    }

    // Extrair e formatar as imagens de cenas (pipeline clássico)
    const samples: Array<{
      id: string
      dataUrl: string
      width: number | null
      height: number | null
      createdAt: string
      promptUsed: string
      outputTitle: string | null
      source: string
    }> = []

    for (const output of seed.outputs) {
      for (const scene of output.scenes) {
        const image = scene.images[0]
        if (image && samples.length < 12) {
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
              outputTitle: output.title,
              source: 'scene-image'
            })
          }
        }
      }
    }

    // Formatar SeedSamples (style previews, thumbnails, etc.)
    const seedSamples = seed.samples.map(s => ({
      id: s.id,
      dataUrl: `data:${s.mimeType};base64,${s.base64}`,
      width: null,
      height: null,
      createdAt: s.createdAt.toISOString(),
      promptUsed: s.prompt,
      outputTitle: s.dossier?.title || null,
      source: s.source,
      aspectRatio: s.aspectRatio,
      provider: s.provider,
      model: s.model,
      metadata: s.metadata
    }))

    return {
      success: true,
      data: {
        seed: {
          id: seed.id,
          value: seed.value,
          usageCount: seed.usageCount
        },
        samples,        // Imagens do pipeline (cenas de vídeo)
        seedSamples     // Imagens universais (style previews, thumbnails, etc.)
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
