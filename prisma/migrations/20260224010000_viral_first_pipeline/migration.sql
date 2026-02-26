-- Viral-First Pipeline: Scene viral fields, Retention QA, Music Events

-- Scene: add viral-first fields
ALTER TABLE "scenes" ADD COLUMN "onScreenText" VARCHAR(120);
ALTER TABLE "scenes" ADD COLUMN "patternInterruptType" VARCHAR(50);
ALTER TABLE "scenes" ADD COLUMN "curiosityGap" TEXT;
ALTER TABLE "scenes" ADD COLUMN "payoff" TEXT;
ALTER TABLE "scenes" ADD COLUMN "brollPriority" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "scenes" ADD COLUMN "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Output: add Retention QA fields
ALTER TABLE "outputs" ADD COLUMN "retentionQA" JSONB;
ALTER TABLE "outputs" ADD COLUMN "retentionQAApproved" BOOLEAN NOT NULL DEFAULT false;

-- AudioTrack: add offsetMs for positioned music events (stingers)
ALTER TABLE "audio_tracks" ADD COLUMN "offsetMs" INTEGER;
