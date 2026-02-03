import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const scriptStyles = [
  {
    id: 'documentary',
    name: 'Documentário',
    description: 'Estilo documental sério e investigativo, focado em fatos e evidências.',
    instructions: 'Adote um tom documental sério e investigativo.',
    order: 1,
    isActive: true
  },
  {
    id: 'mystery',
    name: 'Mistério',
    description: 'Estilo misterioso com tensão crescente e revelações graduais.',
    instructions: 'Crie tensão e mistério, com revelações graduais.',
    order: 2,
    isActive: true
  },
  {
    id: 'narrative',
    name: 'Narrativo',
    description: 'Estilo de narrativa envolvente com arco dramático claro.',
    instructions: 'Conte uma história envolvente com arco narrativo claro.',
    order: 3,
    isActive: true
  },
  {
    id: 'educational',
    name: 'Educacional',
    description: 'Estilo educativo e acessível, explicando conceitos complexos de forma simples.',
    instructions: 'Seja informativo mas acessível, explicando conceitos complexos.',
    order: 4,
    isActive: true
  }
]

async function main() {
  console.log('🌱 Seeding script styles...')

  await prisma.scriptStyle.createMany({
    data: scriptStyles,
    skipDuplicates: true
  })

  console.log(`✅ Created ${scriptStyles.length} script styles`)
  console.log('✨ Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
