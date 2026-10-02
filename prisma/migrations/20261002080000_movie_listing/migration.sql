-- 映画の公開予定（Wikipedia「◯年の日本公開映画」から毎日取り込む）
CREATE TABLE "MovieListing" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "release" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MovieListing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MovieListing_title_release_key" ON "MovieListing"("title", "release");
CREATE INDEX "MovieListing_release_idx" ON "MovieListing"("release");
