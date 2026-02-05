-- CreateEnum
CREATE TYPE "OutputType" AS ENUM ('VIDEO_TEASER', 'VIDEO_FULL', 'TWITTER_THREAD', 'LINKEDIN_POST', 'INSTAGRAM_POST', 'PODCAST_EPISODE', 'BLOG_ARTICLE');

-- CreateEnum
CREATE TYPE "OutputStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- DropIndex
DROP INDEX "scenes_videoId_order_key";

-- AlterTable
ALTER TABLE "audio_tracks" ADD COLUMN     "outputId" TEXT,
ALTER COLUMN "videoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pipeline_executions" ADD COLUMN     "outputId" TEXT,
ALTER COLUMN "videoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "outputId" TEXT,
ALTER COLUMN "videoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "scripts" ADD COLUMN     "outputId" TEXT,
ALTER COLUMN "videoId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "sourceText" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "researchData" JSONB,
    "tags" TEXT[],
    "category" VARCHAR(50),
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sources" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "sourceType" VARCHAR(50) NOT NULL,
    "url" VARCHAR(500),
    "author" VARCHAR(255),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_images" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageData" BYTEA,
    "mimeType" VARCHAR(50),
    "url" VARCHAR(500),
    "tags" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_notes" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "noteType" VARCHAR(50),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outputs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "outputType" "OutputType" NOT NULL,
    "format" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255),
    "duration" INTEGER,
    "aspectRatio" VARCHAR(10),
    "platform" VARCHAR(50),
    "targetWPM" INTEGER DEFAULT 150,
    "language" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "narrationLanguage" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "voiceId" VARCHAR(100),
    "enableMotion" BOOLEAN NOT NULL DEFAULT false,
    "mustInclude" TEXT,
    "mustExclude" TEXT,
    "scriptStyleId" TEXT,
    "visualStyleId" TEXT,
    "seedId" TEXT,
    "status" "OutputStatus" NOT NULL DEFAULT 'PENDING',
    "scriptApproved" BOOLEAN NOT NULL DEFAULT false,
    "imagesApproved" BOOLEAN NOT NULL DEFAULT false,
    "videosApproved" BOOLEAN NOT NULL DEFAULT false,
    "outputData" BYTEA,
    "outputMimeType" VARCHAR(50),
    "outputSize" INTEGER,
    "thumbnailPath" VARCHAR(500),
    "errorMessage" TEXT,
    "pipelineLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "output_relations" (
    "id" TEXT NOT NULL,
    "mainOutputId" TEXT NOT NULL,
    "relatedOutputId" TEXT NOT NULL,
    "relationType" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "output_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");

-- CreateIndex
CREATE INDEX "documents_isProcessed_idx" ON "documents"("isProcessed");

-- CreateIndex
CREATE INDEX "document_sources_documentId_idx" ON "document_sources"("documentId");

-- CreateIndex
CREATE INDEX "document_sources_sourceType_idx" ON "document_sources"("sourceType");

-- CreateIndex
CREATE INDEX "document_images_documentId_idx" ON "document_images"("documentId");

-- CreateIndex
CREATE INDEX "document_notes_documentId_idx" ON "document_notes"("documentId");

-- CreateIndex
CREATE INDEX "document_notes_noteType_idx" ON "document_notes"("noteType");

-- CreateIndex
CREATE INDEX "outputs_documentId_idx" ON "outputs"("documentId");

-- CreateIndex
CREATE INDEX "outputs_outputType_idx" ON "outputs"("outputType");

-- CreateIndex
CREATE INDEX "outputs_platform_idx" ON "outputs"("platform");

-- CreateIndex
CREATE INDEX "outputs_status_idx" ON "outputs"("status");

-- CreateIndex
CREATE INDEX "outputs_createdAt_idx" ON "outputs"("createdAt");

-- CreateIndex
CREATE INDEX "output_relations_relationType_idx" ON "output_relations"("relationType");

-- CreateIndex
CREATE UNIQUE INDEX "output_relations_mainOutputId_relatedOutputId_key" ON "output_relations"("mainOutputId", "relatedOutputId");

-- CreateIndex
CREATE INDEX "audio_tracks_outputId_idx" ON "audio_tracks"("outputId");

-- CreateIndex
CREATE INDEX "pipeline_executions_outputId_idx" ON "pipeline_executions"("outputId");

-- CreateIndex
CREATE INDEX "scenes_outputId_idx" ON "scenes"("outputId");

-- CreateIndex
CREATE INDEX "scenes_outputId_order_idx" ON "scenes"("outputId", "order");

-- CreateIndex
CREATE INDEX "scenes_videoId_order_idx" ON "scenes"("videoId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "scripts_outputId_key" ON "scripts"("outputId");

-- AddForeignKey
ALTER TABLE "document_sources" ADD CONSTRAINT "document_sources_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_images" ADD CONSTRAINT "document_images_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_notes" ADD CONSTRAINT "document_notes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outputs" ADD CONSTRAINT "outputs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outputs" ADD CONSTRAINT "outputs_scriptStyleId_fkey" FOREIGN KEY ("scriptStyleId") REFERENCES "script_styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outputs" ADD CONSTRAINT "outputs_visualStyleId_fkey" FOREIGN KEY ("visualStyleId") REFERENCES "visual_styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outputs" ADD CONSTRAINT "outputs_seedId_fkey" FOREIGN KEY ("seedId") REFERENCES "seeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_relations" ADD CONSTRAINT "output_relations_mainOutputId_fkey" FOREIGN KEY ("mainOutputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_relations" ADD CONSTRAINT "output_relations_relatedOutputId_fkey" FOREIGN KEY ("relatedOutputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_tracks" ADD CONSTRAINT "audio_tracks_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_executions" ADD CONSTRAINT "pipeline_executions_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
