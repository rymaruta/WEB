-- 話題のジャンルを AI が内容から判定し直した記録と、読み物でない告知（占い・求人・IR 説明会など）の印
ALTER TABLE "Topic" ADD COLUMN "aiGenreChecked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Topic" ADD COLUMN "aiNotNews" BOOLEAN NOT NULL DEFAULT false;
