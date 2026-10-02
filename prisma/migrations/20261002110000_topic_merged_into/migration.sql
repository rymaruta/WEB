-- 同じ出来事の別の話題にまとめた場合の、まとめた先の話題
ALTER TABLE "Topic" ADD COLUMN "mergedIntoId" INTEGER;
