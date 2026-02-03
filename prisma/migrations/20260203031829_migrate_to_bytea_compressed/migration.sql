/*
  Warnings:

  - You are about to drop the column `filePath` on the `audio_tracks` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `audio_tracks` table. All the data in the column will be lost.
  - You are about to drop the column `filePath` on the `scene_images` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `scene_images` table. All the data in the column will be lost.
  - You are about to drop the column `filePath` on the `scene_videos` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `scene_videos` table. All the data in the column will be lost.
  - You are about to drop the column `outputPath` on the `videos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "audio_tracks" DROP COLUMN "filePath",
DROP COLUMN "fileSize",
ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "mimeType" VARCHAR(50),
ADD COLUMN     "originalSize" INTEGER;

-- AlterTable
ALTER TABLE "scene_images" DROP COLUMN "filePath",
DROP COLUMN "fileSize",
ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "mimeType" VARCHAR(50),
ADD COLUMN     "originalSize" INTEGER;

-- AlterTable
ALTER TABLE "scene_videos" DROP COLUMN "filePath",
DROP COLUMN "fileSize",
ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "mimeType" VARCHAR(50),
ADD COLUMN     "originalSize" INTEGER;

-- AlterTable
ALTER TABLE "videos" DROP COLUMN "outputPath",
ADD COLUMN     "outputData" BYTEA,
ADD COLUMN     "outputMimeType" VARCHAR(50),
ADD COLUMN     "outputSize" INTEGER;
