-- テレビアニメの放送開始予定（Wikipedia「日本のテレビアニメ作品一覧」から毎日取り込む）
CREATE TABLE "AnimeListing" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnimeListing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnimeListing_title_start_key" ON "AnimeListing"("title", "start");
CREATE INDEX "AnimeListing_start_idx" ON "AnimeListing"("start");
