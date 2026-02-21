/**
 * POST /api/persons/:id/generate-image
 *
 * Gera uma imagem de referência para o personagem usando Luma Photon Flash.
 * A imagem é armazenada como Buffer no campo referenceImage do DossierPerson.
 * Substitui qualquer imagem anterior (regeneração).
 */

import { prisma } from '../../../utils/prisma'
import { ReplicateImageProvider } from '../../../services/providers'
import { z } from 'zod'

const requestSchema = z.object({
  visualPrompt: z.string().min(10).optional()
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Person ID is required' })
  }

  const person = await prisma.dossierPerson.findUnique({
    where: { id },
    select: { id: true, name: true, visualDescription: true }
  })

  if (!person) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }

  const body = await readBody(event)
  const data = requestSchema.parse(body || {})

  const prompt = data.visualPrompt || person.visualDescription
  if (!prompt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nenhuma descrição visual disponível. Preencha o campo visualDescription ou envie visualPrompt.'
    })
  }

  // Enriquecer prompt para portrait/busto de personagem
  const enrichedPrompt = `Portrait photograph, upper body shot, centered subject. ${prompt}. Professional studio lighting, clean background, high detail face features, sharp focus on face.`

  const config = useRuntimeConfig()
  const imageConfig = config.providers?.image as any

  if (!imageConfig?.apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'Provider de imagem não configurado' })
  }

  const provider = new ReplicateImageProvider({
    apiKey: imageConfig.apiKey,
    model: 'luma/photon-flash'
  })

  console.log(`[GeneratePersonImage] 👤 Gerando referência para "${person.name}" | Prompt: ${enrichedPrompt.slice(0, 80)}...`)

  const startTime = Date.now()

  const result = await provider.generate({
    prompt: enrichedPrompt,
    width: 768,
    height: 768,
    aspectRatio: '1:1',
    numVariants: 1
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  if (!result.images?.length) {
    throw createError({ statusCode: 500, statusMessage: 'Nenhuma imagem retornada pelo modelo' })
  }

  const image = result.images[0]!
  const imageBuffer = Buffer.from(image.buffer)

  await prisma.dossierPerson.update({
    where: { id },
    data: { referenceImage: imageBuffer }
  })

  console.log(`[GeneratePersonImage] ✅ Referência gerada para "${person.name}" em ${elapsed}s | ${(imageBuffer.length / 1024).toFixed(0)}KB`)

  return {
    success: true,
    imageSize: imageBuffer.length,
    predictTime: result.predictTime
  }
})
