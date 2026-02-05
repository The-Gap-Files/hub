-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "narrationLanguage" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
ADD COLUMN     "sourceDocument" TEXT,
ALTER COLUMN "duration" SET DEFAULT 185;
