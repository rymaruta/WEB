-- 「今週の新発売」（新商品の発売）
ALTER TABLE "Topic" ADD COLUMN "aiProductName" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiProductMaker" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiProductDate" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiProductKind" TEXT;
ALTER TABLE "Topic" ADD COLUMN "aiProductChecked" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Topic_aiProductDate_idx" ON "Topic"("aiProductDate");
