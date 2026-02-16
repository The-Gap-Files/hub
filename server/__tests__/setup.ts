
import { beforeAll, afterAll, beforeEach } from 'vitest'
import dotenv from 'dotenv'
import path from 'path'
import pg from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Carregar .env explicitamente para o ambiente de teste
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ⚠️ PROTEÇÃO: Usar DATABASE_URL_TEST se disponível, senão usar DATABASE_URL
// mas SEMPRE verificar que o banco tem sufixo _test para evitar apagar dados reais
const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL

if (!testDbUrl) {
  console.error('❌ FATAL: Nenhuma DATABASE_URL encontrada. Configure DATABASE_URL_TEST no .env')
  process.exit(1)
}

// Garantir que TODO o código do app (incluindo `server/utils/prisma.ts`) use o mesmo banco de teste.
process.env.DATABASE_URL = testDbUrl
process.env.NODE_ENV = 'test'

// Guard: Se não é DATABASE_URL_TEST explícita, verificar que o banco tem nome seguro
if (!process.env.DATABASE_URL_TEST) {
  const dbMatch = testDbUrl.match(/\/([^/?]+)(\?|$)/)
  const dbName = dbMatch?.[1] || ''
  if (!dbName.includes('test')) {
    console.error(`\n❌ FATAL: Tentando rodar testes no banco "${dbName}" que NÃO é um banco de teste!`)
    console.error(`   Os testes fazem TRUNCATE em todas as tabelas, o que APAGA todos os dados.`)
    console.error(`\n   Para resolver, adicione no .env:`)
    console.error(`   DATABASE_URL_TEST="postgresql://.../${dbName}_test?schema=public"\n`)
    console.error(`   Ou use um banco com "_test" no nome.\n`)
    process.exit(1)
  }
}

// Criar cliente Prisma específico para testes com pool manual
const pool = new pg.Pool({ connectionString: testDbUrl })
const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })

beforeAll(async () => {
  // ─── Auto-sync: prisma db push (equivalente ao DDL auto do H2/Hibernate) ───
  // Sincroniza o schema.prisma com o banco de teste automaticamente.
  // Se o schema já está em sync, o comando é ~200ms (idempotente).
  try {
    const { execSync } = await import('child_process')
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma')
    console.log('🔄 Sincronizando schema no banco de teste...')
    execSync(
      `npx prisma db push --url "${testDbUrl}" --schema "${schemaPath}" --accept-data-loss`,
      { cwd: path.resolve(__dirname, '../..'), stdio: 'pipe' }
    )
    console.log('✅ Schema sincronizado')
  } catch (e: any) {
    console.error('❌ Falha ao sincronizar schema:', e.stderr?.toString() || e.message)
    process.exit(1)
  }

  // ─── Conectar ───
  try {
    console.log(`🔍 Test DB: ${testDbUrl.replace(/:([^:@]+)@/, ':***@')}`)
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
  await deleteTable('dossier_persons')
  await deleteTable('dossier_images')
  await deleteTable('dossier_sources')
  await deleteTable('cost_logs')
  await deleteTable('seed_samples')
  await deleteTable('monetization_plans')
  await deleteTable('dossiers')
  await deleteTable('seeds')
  await deleteTable('channels')
})
