---
name: zn-quality-audit
description: ぜんぶナビの中身の質の点検（定時配信の偏り・載らなかった理由、ジャンル分けの誤り、媒体数の数え方）。定期の品質点検で使う
---

# 質の点検

- 定時配信: `python3 scripts/ops/digest-audit.py [日数]` → 各回の見出しと、載らなかった候補の理由の内訳。
  各回は必ず3本（`REQUIRED_ITEMS`）。足りない回は理由（要確認・確からしさ・同じ分野の重なり）を見て、
  人の確認の関門（REVIEW_REQUIRED）は緩めない
- ジャンル分け: 各ジャンルの `/genre/<slug>/more` から10件ずつ見て、誤りは `src/lib/topics/genre-rules.ts` の
  規則（RULES / BOOSTS）で直す。直したら `tests/genre-rules.test.ts` に例を足す
- 媒体数: 同じ記事の配信（ライブドア等の転載）は `src/lib/coverage.ts` の `syndicationKey` / `AGGREGATORS` で1つに数える
- 定型の見出し（占い・予告先発など）は `src/lib/topics/routine.ts` で一覧から外す
- 結果は数字と具体例で短く報告する（全件を貼らない）
