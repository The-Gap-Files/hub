
import 'dotenv/config' // Carregar .env
import { prisma } from './server/utils/prisma'

async function main() {
  try {
    const video = await prisma.video.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        theme: true,
        status: true,
        errorMessage: true,
        pipelineLog: true
      }
    })
    console.log('--- DIAGNOSTICO DE ERRO ---')
    console.log(JSON.stringify(video, null, 2))
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
