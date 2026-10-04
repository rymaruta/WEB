-- 編集部の点検の記録（項目を足すだけ。今あるデータは変えない）
-- 戻すとき: prisma/migrations/20261004120000_topic_review/down.sql
ALTER TABLE "Topic" ADD COLUMN "reviewStatus" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3), ADD COLUMN "reviewNote" TEXT;
