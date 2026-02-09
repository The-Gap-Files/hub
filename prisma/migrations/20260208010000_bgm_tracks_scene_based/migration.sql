-- AlterTable: Troca startTime/endTime por startScene/endScene no BackgroundMusicTrack
-- As tracks agora referenciam cenas em vez de timestamps, permitindo cálculo de duração real

-- Adicionar novas colunas
ALTER TABLE "background_music_tracks" ADD COLUMN "startScene" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "background_music_tracks" ADD COLUMN "endScene" INTEGER;

-- Remover colunas antigas
ALTER TABLE "background_music_tracks" DROP COLUMN IF EXISTS "startTime";
ALTER TABLE "background_music_tracks" DROP COLUMN IF EXISTS "endTime";
