// Script temporário para resetar status travado em GENERATING
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const outputId = process.argv[2]
  if (!outputId) {
    console.error('Uso: npx tsx scripts/reset-generating.ts <outputId>')
    process.exit(1)
  }

  const output = await prisma.output.findUnique({
    where: { id: outputId },
    select: { id: true, status: true }
  })

  if (!output) {
    console.error('Output não encontrado:', outputId)
    process.exit(1)
  }

  console.log('Status atual:', output.status)

  if (output.status !== 'GENERATING') {
    console.log('Status não é GENERATING, nada a fazer.')
    process.exit(0)
  }

  await prisma.output.update({
    where: { id: outputId },
    data: { status: 'PENDING' }
  })

  console.log('✅ Status resetado para PENDING')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
