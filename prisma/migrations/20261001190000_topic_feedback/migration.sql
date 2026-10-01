-- まとめ記事への読者の評価（件数だけ）
CREATE TABLE "TopicFeedback" (
    "topicId" INTEGER NOT NULL,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "unclear" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TopicFeedback_pkey" PRIMARY KEY ("topicId")
);
CREATE INDEX "TopicFeedback_unclear_idx" ON "TopicFeedback"("unclear" DESC);
