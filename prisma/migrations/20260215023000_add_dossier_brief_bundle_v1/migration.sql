-- AlterTable
ALTER TABLE "dossiers" ADD COLUMN     "briefBundleV1" JSONB;
ALTER TABLE "dossiers" ADD COLUMN     "briefBundleV1Hash" VARCHAR(64);
ALTER TABLE "dossiers" ADD COLUMN     "briefBundleV1UpdatedAt" TIMESTAMP(3);

