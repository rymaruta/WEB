-- ゲームの話題の情報（ゲームタブの発売スケジュール・新着ゲーム用）
ALTER TABLE "Topic" ADD COLUMN "aiGameTitle" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiGameRelease" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiGameKind" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiGamePlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Topic" ADD COLUMN "aiGameChecked" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Topic_aiGameRelease_idx" ON "Topic"("aiGameRelease");
