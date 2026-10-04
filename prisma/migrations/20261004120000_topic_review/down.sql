-- 20261004120000_topic_review を戻す（手で実行する。実行後に _prisma_migrations からこの移行の行を消す）
ALTER TABLE "Topic" DROP COLUMN IF EXISTS "reviewStatus", DROP COLUMN IF EXISTS "reviewedAt", DROP COLUMN IF EXISTS "reviewNote";
