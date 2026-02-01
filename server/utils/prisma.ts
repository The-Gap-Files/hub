/**
 * Prisma Client Singleton com PostgreSQL Adapter
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error']
  })
}

// Em desenvolvimento, reutiliza a conexão para evitar problemas com hot reload
export const prisma = globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
}
