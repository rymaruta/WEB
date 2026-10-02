-- 日付の照合をゆるめた（資料に月までしかないときも残す）ため、直近3週間で変更と認められなかった話題を読み取り直す
UPDATE "Topic" SET "aiChangeChecked" = false
WHERE "aiChangeChecked" = true AND "aiChangeTitle" IS NULL AND "firstSeenAt" >= NOW() - INTERVAL '21 days';
