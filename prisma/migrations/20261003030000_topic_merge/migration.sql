-- CreateTable
CREATE TABLE "TopicMerge" (
    "id" SERIAL NOT NULL,
    "keepId" INTEGER NOT NULL,
    "dropId" INTEGER NOT NULL,
    "articleIds" INTEGER[],
    "dropWasNotNews" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "TopicMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicMerge_keepId_idx" ON "TopicMerge"("keepId");

-- CreateIndex
CREATE INDEX "TopicMerge_dropId_idx" ON "TopicMerge"("dropId");

-- CreateIndex
CREATE INDEX "TopicMerge_createdAt_idx" ON "TopicMerge"("createdAt");

