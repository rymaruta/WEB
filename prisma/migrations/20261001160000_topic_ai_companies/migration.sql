-- AI まとめ記事で取り上げた企業名（企業ページ用）
ALTER TABLE "Topic" ADD COLUMN "aiCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Topic_aiCompanies_idx" ON "Topic" USING GIN ("aiCompanies");
