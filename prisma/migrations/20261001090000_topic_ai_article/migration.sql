-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "aiAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "aiBody" TEXT,
ADD COLUMN     "aiGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "aiLead" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiPoints" JSONB,
ADD COLUMN     "aiSourceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiSources" JSONB,
ADD COLUMN     "aiTitle" TEXT;

-- CreateIndex
CREATE INDEX "Topic_aiGeneratedAt_idx" ON "Topic"("aiGeneratedAt" DESC);
