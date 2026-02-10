-- CreateTable: seed_samples (rastreabilidade universal de imagens geradas com seeds)
CREATE TABLE "seed_samples" (
    "id" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "dossierId" TEXT,
    "source" VARCHAR(50) NOT NULL,
    "prompt" TEXT NOT NULL,
    "base64" TEXT NOT NULL,
    "mimeType" VARCHAR(30) NOT NULL DEFAULT 'image/png',
    "provider" VARCHAR(30) NOT NULL,
    "model" VARCHAR(100),
    "aspectRatio" VARCHAR(10),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seed_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seed_samples_seedId_idx" ON "seed_samples"("seedId");
CREATE INDEX "seed_samples_dossierId_idx" ON "seed_samples"("dossierId");
CREATE INDEX "seed_samples_source_idx" ON "seed_samples"("source");
CREATE INDEX "seed_samples_createdAt_idx" ON "seed_samples"("createdAt");

-- AddForeignKey
ALTER TABLE "seed_samples" ADD CONSTRAINT "seed_samples_seedId_fkey" FOREIGN KEY ("seedId") REFERENCES "seeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seed_samples" ADD CONSTRAINT "seed_samples_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
