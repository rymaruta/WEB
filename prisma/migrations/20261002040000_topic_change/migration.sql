-- 「◯月から変わること」（暮らしに関わる変更）
ALTER TABLE "Topic" ADD COLUMN "aiChangeTitle" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiChangeDate" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiChangeKind" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiChangeChecked" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Topic_aiChangeDate_idx" ON "Topic"("aiChangeDate");
