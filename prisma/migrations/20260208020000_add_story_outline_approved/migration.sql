-- AlterTable: Aprovação do plano narrativo (Story Architect) antes de gerar roteiro
ALTER TABLE "outputs" ADD COLUMN "storyOutlineApproved" BOOLEAN NOT NULL DEFAULT false;
