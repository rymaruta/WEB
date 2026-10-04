-- 20261004090000_schedule_history を戻す（手で実行する。実行後に _prisma_migrations からこの移行の行を消す）
DROP TABLE IF EXISTS "ScheduleChange";
ALTER TABLE "AnimeListing" DROP COLUMN IF EXISTS "sourceUrl", DROP COLUMN IF EXISTS "checkedAt";
ALTER TABLE "MovieListing" DROP COLUMN IF EXISTS "sourceUrl", DROP COLUMN IF EXISTS "checkedAt";
ALTER TABLE "GameListing" DROP COLUMN IF EXISTS "checkedAt";
