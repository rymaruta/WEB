---
name: zn-local-preview
description: ぜんぶナビを手元で動かして確かめる（DB・standalone サーバー・管理 API・X 用カードの描画）。画面や API の変更を確かめるときに使う
---

# 手元で確かめる

- 起動: `scripts/ops/local-preview.sh`（Postgres 55432 を起こし、移行、ビルド、3102 番で起動）。
  コードを変えていなければ `--no-build`。ビルドの記録は `$ZN_SCRATCH/build.log`（失敗時は末尾だけ出る）
- DB: `postgresql://postgres@localhost:55432/zn?host=/tmp`、管理 API は `Authorization: Bearer localtest`
- X 用カードの見た目: tsx の使い捨てスクリプトで
  `renderCard(buildBreakingCard(entry, at, false, "BREAKING"|"PICKUP"))`（`src/lib/digest/cards.tsx`, `compose.ts`）を PNG に書き、Read で見る。
  管理画面と同じものは `/api/admin/breaking/<storyId>/card?kind=pickup&headline=...&layout=headline`
- 画面の確認は Playwright（Chromium は導入済み。`playwright install` はしない）。スクリーンショットはスクラッチに置き、コミットしない
- `pkill` は自分のコマンド行に一致させない（`standalone/server.js` を引数に含むシェルから打たない）
