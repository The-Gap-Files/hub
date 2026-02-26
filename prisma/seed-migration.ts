/**
 * Data Migration Script — Output God Object → Product Tables
 *
 * This script migrates data from the old inline Output fields to the new
 * dedicated product tables (StageGate, StoryOutlineProduct, RetentionQAProduct,
 * MonetizationProduct, SocialKitProduct, ThumbnailProduct, RenderProduct).
 *
 * IMPORTANT: Run this BEFORE `prisma db push` or `prisma migrate` so that
 * old columns still exist in the database.
 *
 * Usage:
 *   npx tsx prisma/seed-migration.ts
 *
 * The script is idempotent — running it multiple times is safe.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    ) as exists
  `, table, column)
  return result[0]?.exists ?? false
}

async function tableHasRows(table: string): Promise<boolean> {
  const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "${table}" LIMIT 1`
  )
  return (result[0]?.count ?? 0n) > 0n
}

function log(msg: string) {
  console.log(`[Migration] ${msg}`)
}

function warn(msg: string) {
  console.warn(`[Migration] ⚠️ ${msg}`)
}

// ─── Stage Gate Mapping ─────────────────────────────────────────────────────

const APPROVAL_TO_STAGE: Array<{ column: string; stage: string }> = [
  { column: 'storyOutlineApproved', stage: 'STORY_OUTLINE' },
  { column: 'writerApproved', stage: 'WRITER' },
  { column: 'scriptApproved', stage: 'SCRIPT' },
  { column: 'retentionQAApproved', stage: 'RETENTION_QA' },
  { column: 'imagesApproved', stage: 'IMAGES' },
  { column: 'bgmApproved', stage: 'BGM' },
  { column: 'audioApproved', stage: 'AUDIO' },
  { column: 'videosApproved', stage: 'MOTION' },
  { column: 'renderApproved', stage: 'RENDER' },
]

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  log('Starting data migration: Output → Product Tables')

  // ── 0. Pre-flight checks ────────────────────────────────────────────────

  // Check if old columns still exist
  const hasStoryOutlineApproved = await columnExists('outputs', 'storyOutlineApproved')
  if (!hasStoryOutlineApproved) {
    warn('Old columns already removed. Nothing to migrate (fresh install or migration already done).')
    return
  }

  // ── 0b. Create enums & tables if they don't exist yet ───────────────────

  log('Step 0: Ensuring new enums and tables exist (DDL)')

  // Create PipelineStage enum
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PipelineStage') THEN
        CREATE TYPE "PipelineStage" AS ENUM (
          'STORY_OUTLINE', 'WRITER', 'SCRIPT', 'RETENTION_QA',
          'IMAGES', 'BGM', 'SFX', 'AUDIO', 'MUSIC_EVENTS', 'MOTION', 'RENDER'
        );
      END IF;
    END $$;
  `)

  // Create StageStatus enum
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StageStatus') THEN
        CREATE TYPE "StageStatus" AS ENUM (
          'NOT_STARTED', 'GENERATING', 'PENDING_REVIEW',
          'APPROVED', 'REJECTED', 'SKIPPED', 'FAILED'
        );
      END IF;
    END $$;
  `)

  // Add new OutputStatus values (DRAFT, IN_PROGRESS, CANCELLED)
  await prisma.$executeRawUnsafe(`ALTER TYPE "OutputStatus" ADD VALUE IF NOT EXISTS 'DRAFT'`)
  await prisma.$executeRawUnsafe(`ALTER TYPE "OutputStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS'`)
  await prisma.$executeRawUnsafe(`ALTER TYPE "OutputStatus" ADD VALUE IF NOT EXISTS 'CANCELLED'`)

  // Create stage_gates table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "stage_gates" (
      "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
      "outputId"   TEXT NOT NULL,
      "stage"      "PipelineStage" NOT NULL,
      "status"     "StageStatus" NOT NULL DEFAULT 'NOT_STARTED',
      "feedback"   TEXT,
      "executedAt"  TIMESTAMP(3),
      "reviewedAt"  TIMESTAMP(3),
      CONSTRAINT "stage_gates_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "stage_gates_outputId_stage_key" UNIQUE ("outputId", "stage"),
      CONSTRAINT "stage_gates_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "stage_gates_outputId_idx" ON "stage_gates"("outputId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "stage_gates_stage_status_idx" ON "stage_gates"("stage", "status")`)

  // Create story_outline_products table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "story_outline_products" (
      "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
      "outputId"    TEXT NOT NULL,
      "outlineData" JSONB NOT NULL,
      "provider"    VARCHAR(30) NOT NULL,
      "model"       VARCHAR(100),
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "story_outline_products_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "story_outline_products_outputId_key" UNIQUE ("outputId"),
      CONSTRAINT "story_outline_products_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  // Create retention_qa_products table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "retention_qa_products" (
      "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
      "outputId"      TEXT NOT NULL,
      "overallScore"  DOUBLE PRECISION NOT NULL,
      "summary"       TEXT NOT NULL,
      "analysisData"  JSONB NOT NULL,
      "provider"      VARCHAR(30) NOT NULL,
      "model"         VARCHAR(100),
      "analyzedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "retention_qa_products_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "retention_qa_products_outputId_key" UNIQUE ("outputId"),
      CONSTRAINT "retention_qa_products_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  // Create monetization_products table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "monetization_products" (
      "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
      "outputId"    TEXT NOT NULL,
      "contextData" JSONB NOT NULL,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "monetization_products_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "monetization_products_outputId_key" UNIQUE ("outputId"),
      CONSTRAINT "monetization_products_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  // Create social_kit_products table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "social_kit_products" (
      "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
      "outputId"    TEXT NOT NULL,
      "kitData"     JSONB NOT NULL,
      "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "social_kit_products_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "social_kit_products_outputId_key" UNIQUE ("outputId"),
      CONSTRAINT "social_kit_products_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  // Create thumbnail_products table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "thumbnail_products" (
      "id"                   TEXT NOT NULL DEFAULT gen_random_uuid(),
      "outputId"             TEXT NOT NULL,
      "candidates"           JSONB,
      "selectedData"         BYTEA,
      "selectedStoragePath"  VARCHAR(500),
      "selectedAt"           TIMESTAMP(3),
      "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "thumbnail_products_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "thumbnail_products_outputId_key" UNIQUE ("outputId"),
      CONSTRAINT "thumbnail_products_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  // Create render_products table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "render_products" (
      "id"                    TEXT NOT NULL DEFAULT gen_random_uuid(),
      "outputId"              TEXT NOT NULL,
      "videoData"             BYTEA,
      "videoStoragePath"      VARCHAR(500),
      "mimeType"              VARCHAR(50),
      "fileSize"              INTEGER,
      "captionedVideoData"    BYTEA,
      "captionedStoragePath"  VARCHAR(500),
      "captionedFileSize"     INTEGER,
      "renderOptions"         JSONB,
      "renderedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "render_products_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "render_products_outputId_key" UNIQUE ("outputId"),
      CONSTRAINT "render_products_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  log('  DDL complete — all enums and tables created')

  // ── 0c. Idempotency check ─────────────────────────────────────────────

  // Check if new tables already have data (idempotency)
  const gatesHaveData = await tableHasRows('stage_gates')
  if (gatesHaveData) {
    warn('stage_gates already has rows. Skipping migration to avoid duplicates.')
    return
  }

  // ── 1. Map status values ─────────────────────────────────────────────────

  log('Step 1/7: Mapping old status values (PENDING→DRAFT, GENERATING→IN_PROGRESS)')

  const hasStatusColumn = await columnExists('outputs', 'status')
  if (hasStatusColumn) {
    // Map old enum values to new ones. Each is wrapped in try/catch because
    // the old value may not exist in the database enum.
    for (const [oldVal, newVal] of [['PENDING', 'DRAFT'], ['GENERATING', 'IN_PROGRESS'], ['PROCESSING', 'IN_PROGRESS']] as const) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE "outputs" SET "status" = '${newVal}' WHERE "status" = '${oldVal}'`)
        log(`  Mapped ${oldVal} → ${newVal}`)
      } catch {
        log(`  Skipped ${oldVal} → ${newVal} (value not in enum)`)
      }
    }
  }

  // ── 2. Create StageGate rows from approval booleans ──────────────────

  log('Step 2/7: Creating StageGate rows from approval booleans')

  for (const { column, stage } of APPROVAL_TO_STAGE) {
    const exists = await columnExists('outputs', column)
    if (!exists) {
      warn(`Column ${column} not found, skipping ${stage}`)
      continue
    }

    // Insert approved gates
    const approvedCount = await prisma.$executeRawUnsafe(`
      INSERT INTO "stage_gates" ("id", "outputId", "stage", "status", "reviewedAt")
      SELECT gen_random_uuid(), "id", '${stage}'::"PipelineStage", 'APPROVED'::"StageStatus", NOW()
      FROM "outputs"
      WHERE "${column}" = true
      ON CONFLICT ("outputId", "stage") DO NOTHING
    `)
    log(`  ${stage}: ${approvedCount} approved gates created`)
  }

  // ── 3. Migrate storyOutline → StoryOutlineProduct ────────────────────

  log('Step 3/7: Migrating storyOutline → StoryOutlineProduct')

  const hasStoryOutline = await columnExists('outputs', 'storyOutline')
  if (hasStoryOutline) {
    const count = await prisma.$executeRawUnsafe(`
      INSERT INTO "story_outline_products" ("id", "outputId", "outlineData", "provider", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", "storyOutline", 'migrated', "createdAt", NOW()
      FROM "outputs"
      WHERE "storyOutline" IS NOT NULL
      ON CONFLICT ("outputId") DO NOTHING
    `)
    log(`  ${count} story outlines migrated`)
  } else {
    warn('  storyOutline column not found')
  }

  // ── 4. Migrate retentionQA → RetentionQAProduct ──────────────────────

  log('Step 4/7: Migrating retentionQA → RetentionQAProduct')

  const hasRetentionQA = await columnExists('outputs', 'retentionQA')
  if (hasRetentionQA) {
    const count = await prisma.$executeRawUnsafe(`
      INSERT INTO "retention_qa_products" ("id", "outputId", "overallScore", "summary", "analysisData", "provider", "analyzedAt")
      SELECT
        gen_random_uuid(),
        "id",
        COALESCE(("retentionQA"->>'overallScore')::float, 0),
        COALESCE("retentionQA"->>'summary', 'Migrated'),
        "retentionQA",
        'migrated',
        "createdAt"
      FROM "outputs"
      WHERE "retentionQA" IS NOT NULL
      ON CONFLICT ("outputId") DO NOTHING
    `)
    log(`  ${count} retention QA records migrated`)
  } else {
    warn('  retentionQA column not found')
  }

  // ── 5. Migrate monetizationContext → MonetizationProduct ──────────────

  log('Step 5/7: Migrating monetizationContext → MonetizationProduct')

  const hasMonetization = await columnExists('outputs', 'monetizationContext')
  if (hasMonetization) {
    const count = await prisma.$executeRawUnsafe(`
      INSERT INTO "monetization_products" ("id", "outputId", "contextData", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", "monetizationContext", "createdAt", NOW()
      FROM "outputs"
      WHERE "monetizationContext" IS NOT NULL
      ON CONFLICT ("outputId") DO NOTHING
    `)
    log(`  ${count} monetization records migrated`)
  } else {
    warn('  monetizationContext column not found')
  }

  // ── 5b. Migrate socialKit → SocialKitProduct ──────────────────────────

  const hasSocialKit = await columnExists('outputs', 'socialKit')
  if (hasSocialKit) {
    const count = await prisma.$executeRawUnsafe(`
      INSERT INTO "social_kit_products" ("id", "outputId", "kitData", "generatedAt")
      SELECT gen_random_uuid(), "id", "socialKit", "createdAt"
      FROM "outputs"
      WHERE "socialKit" IS NOT NULL
      ON CONFLICT ("outputId") DO NOTHING
    `)
    log(`  ${count} social kit records migrated`)
  }

  // ── 6. Migrate thumbnails → ThumbnailProduct ──────────────────────────

  log('Step 6/7: Migrating thumbnails → ThumbnailProduct')

  const hasThumbnailCandidates = await columnExists('outputs', 'thumbnailCandidates')
  const hasThumbnailData = await columnExists('outputs', 'thumbnailData')

  if (hasThumbnailCandidates || hasThumbnailData) {
    const candidatesCol = hasThumbnailCandidates ? '"thumbnailCandidates"' : 'NULL'
    const dataCol = hasThumbnailData ? '"thumbnailData"' : 'NULL'
    const pathCol = await columnExists('outputs', 'thumbnailPath') ? '"thumbnailPath"' : 'NULL'

    const count = await prisma.$executeRawUnsafe(`
      INSERT INTO "thumbnail_products" ("id", "outputId", "candidates", "selectedData", "selectedStoragePath", "createdAt")
      SELECT gen_random_uuid(), "id", ${candidatesCol}, ${dataCol}, ${pathCol}, "createdAt"
      FROM "outputs"
      WHERE ${hasThumbnailCandidates ? '"thumbnailCandidates" IS NOT NULL OR' : ''} ${hasThumbnailData ? '"thumbnailData" IS NOT NULL' : 'FALSE'}
      ON CONFLICT ("outputId") DO NOTHING
    `)
    log(`  ${count} thumbnail records migrated`)
  } else {
    warn('  thumbnail columns not found')
  }

  // ── 7. Migrate render data → RenderProduct ───────────────────────────

  log('Step 7/7: Migrating render data → RenderProduct')

  const hasOutputData = await columnExists('outputs', 'outputData')
  const hasOutputPath = await columnExists('outputs', 'outputPath')

  if (hasOutputData || hasOutputPath) {
    const videoDataCol = hasOutputData ? '"outputData"' : 'NULL'
    const videoPathCol = hasOutputPath ? '"outputPath"' : 'NULL'
    const mimeCol = await columnExists('outputs', 'outputMimeType') ? '"outputMimeType"' : 'NULL'
    const sizeCol = await columnExists('outputs', 'outputSize') ? '"outputSize"' : 'NULL'
    const captionedDataCol = await columnExists('outputs', 'captionedVideoData') ? '"captionedVideoData"' : 'NULL'
    const captionedSizeCol = await columnExists('outputs', 'captionedVideoSize') ? '"captionedVideoSize"' : 'NULL'
    const renderOptionsCol = await columnExists('outputs', 'renderOptions') ? '"renderOptions"' : 'NULL'

    const count = await prisma.$executeRawUnsafe(`
      INSERT INTO "render_products" (
        "id", "outputId",
        "videoData", "videoStoragePath", "mimeType", "fileSize",
        "captionedVideoData", "captionedFileSize",
        "renderOptions", "renderedAt"
      )
      SELECT
        gen_random_uuid(), "id",
        ${videoDataCol}, ${videoPathCol}, ${mimeCol}, ${sizeCol},
        ${captionedDataCol}, ${captionedSizeCol},
        ${renderOptionsCol}, COALESCE("completedAt", "createdAt")
      FROM "outputs"
      WHERE ${hasOutputData ? '"outputData" IS NOT NULL OR' : ''} ${hasOutputPath ? '"outputPath" IS NOT NULL' : 'FALSE'}
      ON CONFLICT ("outputId") DO NOTHING
    `)
    log(`  ${count} render records migrated`)
  } else {
    warn('  output data columns not found')
  }

  log('Migration complete!')
  log('')
  log('Next steps:')
  log('  1. Verify data: SELECT COUNT(*) FROM stage_gates;')
  log('  2. Run: npx prisma db push (to drop old columns)')
  log('  3. Run: npx prisma generate (to regenerate client)')
}

main()
  .catch((err) => {
    console.error('[Migration] FATAL:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
