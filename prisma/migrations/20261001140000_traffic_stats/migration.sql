-- 日ごと・流入元ごとの閲覧数
CREATE TABLE "TrafficDaily" (
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TrafficDaily_pkey" PRIMARY KEY ("date","source")
);

-- 日ごと・ページごとの閲覧数
CREATE TABLE "PageDaily" (
    "date" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PageDaily_pkey" PRIMARY KEY ("date","path")
);

CREATE INDEX "PageDaily_date_views_idx" ON "PageDaily"("date", "views" DESC);
