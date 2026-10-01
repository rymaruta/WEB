-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('QUEUED', 'PENDING', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'REJECTED_AUTO', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('NORMAL', 'BREAKING', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('X', 'THREADS', 'WEB');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELED');

-- DropIndex
DROP INDEX "Article_title_trgm_idx";

-- DropIndex
DROP INDEX "Topic_title_trgm_idx";

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "topicId" INTEGER NOT NULL,
    "status" "StoryStatus" NOT NULL DEFAULT 'QUEUED',
    "statusNote" TEXT,
    "category" TEXT,
    "cardType" "CardType" NOT NULL DEFAULT 'NORMAL',
    "importance" TEXT,
    "riskFlags" TEXT[],
    "headline" TEXT[],
    "summary" TEXT,
    "points" JSONB,
    "entities" JSONB,
    "eventTime" TEXT,
    "conflicts" JSONB,
    "postText" TEXT[],
    "confidence" DOUBLE PRECISION,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duplicateOf" TEXT,
    "editedAt" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorySource" (
    "storyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "publisher" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StorySource_pkey" PRIMARY KEY ("storyId","position")
);

-- CreateTable
CREATE TABLE "StoryAnalysis" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "checks" JSONB NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "text" TEXT NOT NULL,
    "altText" TEXT,
    "withLink" BOOLEAN NOT NULL DEFAULT false,
    "cardVersion" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "costUsd" DECIMAL(8,4),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAttempt" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "error" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAction" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actor" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" BIGSERIAL NOT NULL,
    "level" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ref" TEXT,
    "data" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Story_topicId_key" ON "Story"("topicId");

-- CreateIndex
CREATE INDEX "Story_status_score_idx" ON "Story"("status", "score" DESC);

-- CreateIndex
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "StoryAnalysis_storyId_createdAt_idx" ON "StoryAnalysis"("storyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Post_externalId_key" ON "Post"("externalId");

-- CreateIndex
CREATE INDEX "Post_status_scheduledAt_idx" ON "Post"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Post_storyId_channel_key" ON "Post"("storyId", "channel");

-- CreateIndex
CREATE INDEX "ReviewAction_storyId_at_idx" ON "ReviewAction"("storyId", "at" DESC);

-- CreateIndex
CREATE INDEX "EventLog_scope_at_idx" ON "EventLog"("scope", "at" DESC);

-- CreateIndex
CREATE INDEX "EventLog_ref_idx" ON "EventLog"("ref");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySource" ADD CONSTRAINT "StorySource_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryAnalysis" ADD CONSTRAINT "StoryAnalysis_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAttempt" ADD CONSTRAINT "PostAttempt_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
