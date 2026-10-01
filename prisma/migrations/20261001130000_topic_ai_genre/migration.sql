-- AI がまとめ記事を書くときに判定したジャンル。媒体の欄から決めたジャンルより優先する
ALTER TABLE "Topic" ADD COLUMN "aiGenreId" INTEGER;
