-- CreateTable
CREATE TABLE "TopicArticleVersion" (
    "id" SERIAL NOT NULL,
    "topicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "sources" INTEGER[],
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicArticleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicArticleVersion_topicId_createdAt_idx" ON "TopicArticleVersion"("topicId", "createdAt");

