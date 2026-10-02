-- 値上げ・値下げデータベース：会社・変更前後の値段・率（資料に書かれているものだけ）
ALTER TABLE "Topic" ADD COLUMN "aiChangeCompany" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiChangeBefore" INTEGER;
ALTER TABLE "Topic" ADD COLUMN "aiChangeAfter" INTEGER;
ALTER TABLE "Topic" ADD COLUMN "aiChangeRate" DOUBLE PRECISION;
ALTER TABLE "Topic" ADD COLUMN "aiChangePriceChecked" BOOLEAN NOT NULL DEFAULT false;
