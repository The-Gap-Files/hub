-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VideoStatus" ADD VALUE 'MOTION_GENERATING';
ALTER TYPE "VideoStatus" ADD VALUE 'MOTION_READY';

-- CreateTable
CREATE TABLE "scene_videos" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "promptUsed" TEXT,
    "filePath" VARCHAR(500) NOT NULL,
    "fileSize" INTEGER,
    "duration" DOUBLE PRECISION,
    "sourceImageId" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "variantIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scene_videos_sceneId_idx" ON "scene_videos"("sceneId");

-- AddForeignKey
ALTER TABLE "scene_videos" ADD CONSTRAINT "scene_videos_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
