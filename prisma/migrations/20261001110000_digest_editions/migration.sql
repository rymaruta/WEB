-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('QUEUED', 'DELTA_QUEUED', 'PENDING', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'REJECTED_AUTO', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "StoryKind" AS ENUM ('NEW', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('NORMAL', 'BREAKING', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('X', 'THREADS', 'WEB');

-- CreateEnum
CREATE TYPE "EditionSlot" AS ENUM ('MORNING', 'LUNCH', 'EVENING', 'BREAKING');

-- CreateEnum
CREATE TYPE "EditionStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "ItemRole" AS ENUM ('MAIN', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "EventThread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lastPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "topicId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "kind" "StoryKind" NOT NULL DEFAULT 'NEW',
    "followupOf" TEXT,
    "eventThreadId" TEXT,
    "status" "StoryStatus" NOT NULL DEFAULT 'QUEUED',
    "statusNote" TEXT,
    "category" TEXT,
    "cardType" "CardType" NOT NULL DEFAULT 'NORMAL',
    "importance" TEXT,
    "riskFlags" TEXT[],
    "headline" TEXT[],
    "shortTitle" TEXT,
    "keyword" TEXT,
    "summary" TEXT,
    "points" JSONB,
    "why" JSONB,
    "assessment" JSONB,
    "delta" JSONB,
    "entities" JSONB,
    "eventTime" TEXT,
    "conflicts" JSONB,
    "confidence" DOUBLE PRECISION,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duplicateOf" TEXT,
    "editedAt" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
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
    "task" TEXT NOT NULL DEFAULT 'story',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "checks" JSONB NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "slot" "EditionSlot" NOT NULL,
    "date" TEXT NOT NULL,
    "status" "EditionStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "postText" TEXT[],
    "notes" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionItem" (
    "editionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "storyId" TEXT NOT NULL,
    "role" "ItemRole" NOT NULL DEFAULT 'MAIN',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "override" JSONB,

    CONSTRAINT "EditionItem_pkey" PRIMARY KEY ("editionId","position")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "costUsd" DECIMAL(8,4),
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationPart" (
    "publicationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "cards" INTEGER[],
    "altTexts" TEXT[],
    "mediaIds" TEXT[],
    "externalId" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "PublicationPart_pkey" PRIMARY KEY ("publicationId","position")
);

-- CreateTable
CREATE TABLE "ReviewAction" (
    "id" TEXT NOT NULL,
    "storyId" TEXT,
    "editionId" TEXT,
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
CREATE INDEX "EventThread_lastPublishedAt_idx" ON "EventThread"("lastPublishedAt" DESC);

-- CreateIndex
CREATE INDEX "Story_status_createdAt_idx" ON "Story"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Story_eventThreadId_idx" ON "Story"("eventThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "Story_topicId_revision_key" ON "Story"("topicId", "revision");

-- CreateIndex
CREATE INDEX "StoryAnalysis_storyId_createdAt_idx" ON "StoryAnalysis"("storyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Edition_key_key" ON "Edition"("key");

-- CreateIndex
CREATE INDEX "Edition_date_slot_idx" ON "Edition"("date", "slot");

-- CreateIndex
CREATE INDEX "Edition_status_scheduledAt_idx" ON "Edition"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "EditionItem_editionId_storyId_key" ON "EditionItem"("editionId", "storyId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_editionId_channel_key" ON "Publication"("editionId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationPart_externalId_key" ON "PublicationPart"("externalId");

-- CreateIndex
CREATE INDEX "ReviewAction_storyId_at_idx" ON "ReviewAction"("storyId", "at" DESC);

-- CreateIndex
CREATE INDEX "ReviewAction_editionId_at_idx" ON "ReviewAction"("editionId", "at" DESC);

-- CreateIndex
CREATE INDEX "EventLog_scope_at_idx" ON "EventLog"("scope", "at" DESC);

-- CreateIndex
CREATE INDEX "EventLog_ref_idx" ON "EventLog"("ref");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_eventThreadId_fkey" FOREIGN KEY ("eventThreadId") REFERENCES "EventThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySource" ADD CONSTRAINT "StorySource_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryAnalysis" ADD CONSTRAINT "StoryAnalysis_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionItem" ADD CONSTRAINT "EditionItem_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionItem" ADD CONSTRAINT "EditionItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationPart" ADD CONSTRAINT "PublicationPart_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

