import { prisma } from '../../../utils/prisma'
import { outputPipelineService } from '../../../services/pipeline/output-pipeline.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID do Output é obrigatório' })
  }

  // Verificar existência
  const output = await prisma.output.findUnique({ where: { id } })
  if (!output) {
    throw createError({ statusCode: 404, message: 'Output não encontrado' })
  }

  console.log(`[API] 🎬 Forçando re-renderização para Output: ${id}`)

  // Resetar status para garantir que o pipeline entenda que precisa rodar
  await prisma.output.update({
    where: { id },
    data: {
      status: 'GENERATING'
    }
  })

  // Disparar o pipeline de forma assíncrona
  // O execute() internamente vai pular o que já está pronto e cair direto na renderização
  outputPipelineService.execute(id).catch((err: Error) => {
    console.error(`[API] Erro ao disparar re-renderização para ${id}:`, err)
  })

  return {
    success: true,
    message: 'Renderização iniciada em segundo plano'
  }
})
