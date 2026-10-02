-- 公式ストアの発売予定（任天堂・Steam）。発売スケジュールの網羅性を上げるために毎日取り込む
CREATE TABLE "GameListing" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "release" TEXT NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maker" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameListing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GameListing_source_externalId_key" ON "GameListing"("source", "externalId");
CREATE INDEX "GameListing_release_idx" ON "GameListing"("release");
