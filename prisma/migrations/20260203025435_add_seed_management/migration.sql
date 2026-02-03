-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "seedId" TEXT;

-- CreateTable
CREATE TABLE "seeds" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "value" INTEGER NOT NULL,
    "visualStyleId" TEXT NOT NULL,
    "category" VARCHAR(50),
    "tags" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "previewUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seeds_visualStyleId_isActive_idx" ON "seeds"("visualStyleId", "isActive");

-- CreateIndex
CREATE INDEX "seeds_isDefault_idx" ON "seeds"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "seeds_visualStyleId_value_key" ON "seeds"("visualStyleId", "value");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_seedId_fkey" FOREIGN KEY ("seedId") REFERENCES "seeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seeds" ADD CONSTRAINT "seeds_visualStyleId_fkey" FOREIGN KEY ("visualStyleId") REFERENCES "visual_styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
