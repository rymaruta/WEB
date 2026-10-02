-- 「アニメの放送・配信スケジュール」
ALTER TABLE "Topic" ADD COLUMN "aiAnimeTitle" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiAnimeDate" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiAnimeKind" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiAnimeChannel" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiAnimeChecked" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Topic_aiAnimeDate_idx" ON "Topic"("aiAnimeDate");
