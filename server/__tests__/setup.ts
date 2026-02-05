
import { beforeAll, afterAll, beforeEach } from 'vitest'
import dotenv from 'dotenv'
import path from 'path'
import pg from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Carregar .env explicitamente para o ambiente de teste
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Criar cliente Prisma específico para testes com pool manual
const connectionString = process.env.DATABASE_URL
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })

beforeAll(async () => {
  // Garantir conexão com o banco de teste
  try {
    const dbUrl = process.env.DATABASE_URL
    console.log(`🔍 Testing Database URL: ${dbUrl?.replace(/:([^:@]+)@/, ':***@')}`)

    // Teste de conexão manual caso o Prisma falhe silenciosamente no setup
    if (!dbUrl) throw new Error('DATABASE_URL not found in env')

    await prisma.$connect()
    console.log('✅ Database connected for tests')
  } catch (e) {
    console.error('❌ Database connection failed', e)
    process.exit(1)
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Limpar tabelas em ordem de dependência
  // Em um ambiente de teste real, usaríamos transações ou um banco limpo
  // Aqui vamos limpar as principais tabelas do Dossier
  const deleteTable = async (name: string) => {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${name}" CASCADE;`)
    } catch (e) {
      // Ignorar se a tabela não existir
    }
  }

  await deleteTable('pipeline_executions')
  await deleteTable('output_relations')
  await deleteTable('audio_tracks')
  await deleteTable('scene_videos')
  await deleteTable('scene_images')
  await deleteTable('scenes')
  await deleteTable('scripts')
  await deleteTable('outputs')
  await deleteTable('dossier_notes')
  await deleteTable('dossier_images')
  await deleteTable('dossier_sources')
  await deleteTable('dossiers')
})
