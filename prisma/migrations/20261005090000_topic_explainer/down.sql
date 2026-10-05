-- 20261005090000_topic_explainer を戻す（手で実行する。実行後に _prisma_migrations からこの移行の行を消す）
ALTER TABLE "Topic" DROP COLUMN IF EXISTS "aiExplainer", DROP COLUMN IF EXISTS "aiExplainedAt", DROP COLUMN IF EXISTS "aiExplainAttemptedAt";
