-- Threads・Bluesky への同時投稿
ALTER TYPE "Channel" ADD VALUE 'BLUESKY';
ALTER TABLE "Publication" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
