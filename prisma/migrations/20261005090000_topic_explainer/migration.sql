-- 「◯◯とは」（編集部が調べた解説）を保存する項目（項目を足すだけ。今あるデータは変えない）
-- 戻すとき: prisma/migrations/20261005090000_topic_explainer/down.sql
ALTER TABLE "Topic" ADD COLUMN "aiExplainer" JSONB, ADD COLUMN "aiExplainedAt" TIMESTAMP(3), ADD COLUMN "aiExplainAttemptedAt" TIMESTAMP(3);
