-- Add thumbnail fields for bonus thumbnail creation feature (Option A)
-- thumbnailCandidates: Json array of { base64, prompt } before user selects
-- thumbnailData: Bytes for chosen thumbnail after selection
ALTER TABLE "outputs" ADD COLUMN "thumbnailData" BYTEA;
ALTER TABLE "outputs" ADD COLUMN "thumbnailCandidates" JSONB;
