---
name: zn-release
description: ぜんぶナビの変更を出す手順（確認→コミット→PR→マージ→本番反映の確認）。コードを変えて本番に出すときに使う
---

# 変更を出す

1. `git fetch -q origin main && git checkout -b <type>/<topic> origin/main`（古い土台から切らない）
2. 確認（すべて通るまでコミットしない）:
   `npx tsc --noEmit && npm run lint && npx vitest run`、画面や API を変えたら `scripts/ops/local-preview.sh` で動かして確かめる
3. コミット: 日本語の要約1行＋箇条書き。末尾に
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01RvpbnzHpua24Fz4uNbv4e7
   ```
   スクリーンショット・.env はコミットしない。モデル名は書かない
4. `git push -u origin <branch>` → PR（本文の最後に `🤖 Generated with [Claude Code](https://claude.com/claude-code)`、空行、セッション URL）
5. squash マージ（`expectedHeadSha` を付ける）→ `scripts/ops/deploy-verify.sh <マージのsha> [確かめるパス]` を background で走らせる
   （反映待ち→CloudFront の無効化→主なページと管理 API の応答。マイグレーションはデプロイで自動適用）

## 守ること
- journey-photo.com（Route 53 Z01808162ZBG16NIINHQO、CloudFront EYRLTGCPOS9E4）には触れない
- 秘密の値は表示しない（`zn_secret` で変数に読む）。有料サービスの新規契約・取り返しのつかない操作は事前に確認
- Next.js のコードを書く前に `node_modules/next/dist/docs/` の該当ガイドを読む
