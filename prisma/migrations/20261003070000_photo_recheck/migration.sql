-- 人物写真の検索が通信の設定の誤りで失敗し、「写真なし」と記録された分を消して探し直す
DELETE FROM "EntityPhoto" WHERE "url" IS NULL;
UPDATE "Topic" SET "photoCheckedAt" = NULL WHERE "photo" IS NULL AND "photoCheckedAt" IS NOT NULL;
