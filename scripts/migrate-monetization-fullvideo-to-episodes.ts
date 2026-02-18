#!/usr/bin/env tsx
import 'dotenv/config'
import { prisma } from '../server/utils/prisma'
import { migrateFullVideoToEpisodesV1 } from '../server/services/monetization-plan-migrations'

async function main() {
  const BATCH_SIZE = 200
  let migratedCount = 0
  let scannedCount = 0
  let cursor: string | undefined

  console.log('🚀 Migrating MonetizationPlan.planData: fullVideo -> fullVideos[3]')

  while (true) {
    const batch = await prisma.monetizationPlan.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, planData: true }
    })

    if (batch.length === 0) break

    for (const row of batch) {
      scannedCount++
      cursor = row.id

      const nextPlanData = migrateFullVideoToEpisodesV1(row.planData as any)
      if (!nextPlanData) continue

      await prisma.monetizationPlan.update({
        where: { id: row.id },
        data: { planData: nextPlanData as any }
      })
      migratedCount++
    }
  }

  console.log(`✅ Done. Scanned=${scannedCount} Migrated=${migratedCount}`)
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

