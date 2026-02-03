/*
  Warnings:

  - Added the required column `atmosphereTags` to the `visual_styles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseStyle` to the `visual_styles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `compositionTags` to the `visual_styles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lightingTags` to the `visual_styles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Adicionar colunas com valores temporários
ALTER TABLE "visual_styles" 
ADD COLUMN "baseStyle" TEXT NOT NULL DEFAULT '',
ADD COLUMN "lightingTags" TEXT NOT NULL DEFAULT '',
ADD COLUMN "atmosphereTags" TEXT NOT NULL DEFAULT '',
ADD COLUMN "compositionTags" TEXT NOT NULL DEFAULT '';

-- Remover defaults (agora que as colunas existem)
ALTER TABLE "visual_styles" 
ALTER COLUMN "baseStyle" DROP DEFAULT,
ALTER COLUMN "lightingTags" DROP DEFAULT,
ALTER COLUMN "atmosphereTags" DROP DEFAULT,
ALTER COLUMN "compositionTags" DROP DEFAULT;
