-- Classificação (intelligence) move do dossier para o output.
-- 1) Adicionar coluna em outputs
ALTER TABLE "outputs" ADD COLUMN "classificationId" VARCHAR(50);

-- 2) Copiar dossier.category para cada output do dossier
UPDATE "outputs" o
SET "classificationId" = d."category"
FROM "dossiers" d
WHERE o."dossierId" = d.id
  AND d."category" IS NOT NULL;

-- 3) Remover índice e coluna category do dossier
DROP INDEX IF EXISTS "dossiers_category_idx";
ALTER TABLE "dossiers" DROP COLUMN IF EXISTS "category";

-- 4) Índice na nova coluna para filtros por classificação
CREATE INDEX "outputs_classificationId_idx" ON "outputs"("classificationId");
