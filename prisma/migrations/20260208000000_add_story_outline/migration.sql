-- AlterTable: Adiciona campo storyOutline ao Output
-- Story Architect: plano narrativo estruturado gerado por Sonnet antes do roteiro
ALTER TABLE "outputs" ADD COLUMN "storyOutline" JSONB;
