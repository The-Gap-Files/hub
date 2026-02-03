-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "enableMotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageStyle" VARCHAR(50),
ADD COLUMN     "imagesApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scriptApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "style" VARCHAR(50) NOT NULL DEFAULT 'documentary',
ADD COLUMN     "videosApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voiceId" VARCHAR(100);

-- CreateTable
CREATE TABLE "visual_styles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_styles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visual_styles_isActive_order_idx" ON "visual_styles"("isActive", "order");

-- AddForeignKey
ALTER TABLE "pipeline_executions" ADD CONSTRAINT "pipeline_executions_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
