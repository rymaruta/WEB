-- 予定の情報源・最終確認日と、予定の変更の記録（項目と表を足すだけ。今あるデータは変えない）
-- 戻すとき: prisma/migrations/20261004090000_schedule_history/down.sql
ALTER TABLE "GameListing" ADD COLUMN "checkedAt" TIMESTAMP(3);
ALTER TABLE "MovieListing" ADD COLUMN "sourceUrl" TEXT, ADD COLUMN "checkedAt" TIMESTAMP(3);
ALTER TABLE "AnimeListing" ADD COLUMN "sourceUrl" TEXT, ADD COLUMN "checkedAt" TIMESTAMP(3);

CREATE TABLE "ScheduleChange" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "oldDate" TEXT NOT NULL,
    "newDate" TEXT,
    "sourceUrl" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScheduleChange_detectedAt_idx" ON "ScheduleChange"("detectedAt");
