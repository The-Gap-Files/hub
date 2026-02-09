-- Democratização de Fontes: Remove sourceText do Dossier, migra dados para DossierSource
-- PRESERVA todas as DossierSource existentes (fontes secundárias)

-- 1. Adicionar coluna weight à tabela dossier_sources
ALTER TABLE "dossier_sources" ADD COLUMN "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- 2. Migrar sourceText de cada Dossier para uma nova DossierSource (tipo 'document', order 0)
-- Isso empurra as fontes existentes para ordem > 0
INSERT INTO "dossier_sources" ("id", "dossierId", "title", "content", "sourceType", "weight", "order", "createdAt")
SELECT
  gen_random_uuid(),
  d."id",
  'Documento Principal',
  d."sourceText",
  'document',
  1.0,
  0,
  d."createdAt"
FROM "dossiers" d
WHERE d."sourceText" IS NOT NULL AND d."sourceText" != '';

-- 3. Reordenar fontes existentes para ficarem após o documento migrado
-- (incrementar order de todas as fontes secundárias que já existiam)
UPDATE "dossier_sources" ds
SET "order" = ds."order" + 1
WHERE ds."sourceType" != 'document'
  AND EXISTS (
    SELECT 1 FROM "dossier_sources" doc
    WHERE doc."dossierId" = ds."dossierId"
      AND doc."sourceType" = 'document'
  );

-- 4. Remover a coluna sourceText do Dossier
ALTER TABLE "dossiers" DROP COLUMN "sourceText";
