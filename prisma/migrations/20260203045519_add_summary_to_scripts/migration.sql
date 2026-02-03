/*
  Warnings:

  - Added the required column `summary` to the `scripts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Adiciona coluna com valor padrão temporário
ALTER TABLE "scripts" ADD COLUMN "summary" TEXT NOT NULL DEFAULT 'Resumo não disponível para roteiros antigos.';

-- Remove o valor padrão (os novos registros virão com summary do GPT)
ALTER TABLE "scripts" ALTER COLUMN "summary" DROP DEFAULT;
