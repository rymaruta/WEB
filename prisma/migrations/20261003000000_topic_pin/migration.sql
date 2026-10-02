-- 大きな出来事をトップの一番上に固定する
ALTER TABLE "Topic" ADD COLUMN "pinnedUntil" TIMESTAMP(3);
