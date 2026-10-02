-- YouTube の動画（決めたチャンネルの新着情報から取り込む）
CREATE TABLE "YouTubeVideo" (
    "videoId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "isShort" BOOLEAN NOT NULL DEFAULT false,
    "thumbnail" TEXT NOT NULL,
    "aiSummary" TEXT,
    "aiChecked" BOOLEAN NOT NULL DEFAULT false,
    "aiCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "YouTubeVideo_pkey" PRIMARY KEY ("videoId")
);
CREATE INDEX "YouTubeVideo_channelId_publishedAt_idx" ON "YouTubeVideo"("channelId", "publishedAt" DESC);
CREATE INDEX "YouTubeVideo_publishedAt_idx" ON "YouTubeVideo"("publishedAt" DESC);

-- 動画の日ごとの再生回数（伸びのランキング用）
CREATE TABLE "YouTubeViewDaily" (
    "videoId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    CONSTRAINT "YouTubeViewDaily_pkey" PRIMARY KEY ("videoId","date")
);
CREATE INDEX "YouTubeViewDaily_date_idx" ON "YouTubeViewDaily"("date");
