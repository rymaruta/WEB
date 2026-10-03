---
name: zn-prod-check
description: ぜんぶナビ本番の様子を少ない出力で確かめる（記録の要約、管理 API、定期実行の失敗）。「壊れてる」「動いてない」と言われたとき、定期点検で使う
---

# 本番の点検

出力が大きい API は直接 curl せず、保存してから要点だけ見る。

- 記録の要約: `python3 scripts/ops/logs-summary.py [時間]`（種類ごとの件数・最新時刻、警告/エラー、定期実行の起動）
- 任意の管理 API（GET）: `scripts/ops/admin-get.sh "<path>"` → 保存先・大きさ・最上位の項目だけ出る。中身は python/jq で必要な所だけ読む
  - 例: `breaking`（速報の候補・本数）、`editions?date=YYYY-MM-DD`、`stories/pending?compact=1`
- 定期実行（Routine）が動かない: `list_triggers` の last_run → `get_session` で status_bucket を見る。
  "Setup script failed" は環境の設定（Setup script）の問題で、利用者が直す（read_documentation の environment.setup_script を案内）
- 解析待ちが増え続ける＝解析の定期実行が止まっている。速報は解析済みの出来事しか自動投稿しない
- 本番の反映: `curl -s $ZN_ORIGIN/ | grep -o 'dpl=[a-z0-9]*'`（`source scripts/ops/env.sh`）
