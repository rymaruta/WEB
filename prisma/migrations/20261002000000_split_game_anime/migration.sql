-- ジャンル「ゲーム・アニメ」を「ゲーム」と「アニメ・漫画」に分ける
UPDATE "Genre" SET "name" = 'ゲーム' WHERE "slug" = 'game';

-- 「アニメ・漫画」をゲームのすぐ後ろに入れる（後ろのジャンルの並び順を1つずらす）
UPDATE "Genre" SET "sortOrder" = "sortOrder" + 1
WHERE "sortOrder" > (SELECT "sortOrder" FROM "Genre" WHERE "slug" = 'game')
  AND NOT EXISTS (SELECT 1 FROM "Genre" WHERE "slug" = 'anime');
INSERT INTO "Genre" ("slug", "name", "sortOrder")
SELECT 'anime', 'アニメ・漫画', "sortOrder" + 1 FROM "Genre" WHERE "slug" = 'game'
ON CONFLICT ("slug") DO NOTHING;

-- アニメ・漫画の媒体と、その記事を移す
UPDATE "Source" SET "genreId" = (SELECT "id" FROM "Genre" WHERE "slug" = 'anime')
WHERE "feedUrl" IN ('https://animeanime.jp/rss/index.rdf', 'https://natalie.mu/comic/feed/news');
UPDATE "Article" a SET "genreId" = s."genreId"
FROM "Source" s
WHERE a."sourceId" = s."id" AND s."feedUrl" IN ('https://animeanime.jp/rss/index.rdf', 'https://natalie.mu/comic/feed/news');

-- ゲームに入っていた話題のうち、記事の過半がアニメ・漫画の媒体のものを移す
UPDATE "Topic" t
SET "genreId" = g."id", "aiGenreId" = CASE WHEN t."aiGenreId" IS NULL THEN NULL ELSE g."id" END
FROM "Genre" g
WHERE g."slug" = 'anime'
  AND t."genreId" = (SELECT "id" FROM "Genre" WHERE "slug" = 'game')
  AND (
    SELECT COUNT(*) FILTER (WHERE a."genreId" = g."id") * 2 > COUNT(*)
    FROM "Article" a WHERE a."topicId" = t."id"
  );
