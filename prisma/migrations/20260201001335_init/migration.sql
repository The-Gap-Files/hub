-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'SCRIPT_GENERATING', 'SCRIPT_READY', 'AUDIO_GENERATING', 'AUDIO_READY', 'IMAGES_GENERATING', 'IMAGES_READY', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'ELEVENLABS', 'MIDJOURNEY', 'STABLE_DIFFUSION', 'RUNWAY', 'REPLICATE');

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "theme" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "duration" INTEGER,
    "language" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "outputPath" VARCHAR(500),
    "thumbnailPath" VARCHAR(500),
    "errorMessage" TEXT,
    "pipelineLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripts" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "provider" "AIProvider" NOT NULL,
    "modelUsed" VARCHAR(100),
    "promptUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "visualDescription" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_images" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "promptUsed" TEXT NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "variantIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_tracks" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "voiceId" VARCHAR(100),
    "filePath" VARCHAR(500) NOT NULL,
    "fileSize" INTEGER,
    "duration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "apiKey" VARCHAR(500) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "requestsPerMinute" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_executions" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "step" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "videos_createdAt_idx" ON "videos"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scripts_videoId_key" ON "scripts"("videoId");

-- CreateIndex
CREATE INDEX "scenes_videoId_idx" ON "scenes"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_videoId_order_key" ON "scenes"("videoId", "order");

-- CreateIndex
CREATE INDEX "scene_images_sceneId_idx" ON "scene_images"("sceneId");

-- CreateIndex
CREATE INDEX "audio_tracks_videoId_idx" ON "audio_tracks"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_provider_key" ON "provider_configs"("provider");

-- CreateIndex
CREATE INDEX "pipeline_executions_videoId_idx" ON "pipeline_executions"("videoId");

-- CreateIndex
CREATE INDEX "pipeline_executions_createdAt_idx" ON "pipeline_executions"("createdAt");

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_images" ADD CONSTRAINT "scene_images_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_tracks" ADD CONSTRAINT "audio_tracks_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
