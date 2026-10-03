#!/usr/bin/env bash
# 本番の管理用 API を読む（GET のみ）。結果はファイルに保存し、画面には大きさと最上位の項目だけ出す
# 使い方: scripts/ops/admin-get.sh "logs?hours=24&limit=500" [保存先]
set -euo pipefail
source "$(dirname "$0")/env.sh"
path=${1:?パスを指定してください（/api/admin/ より後ろ）}
out=${2:-$ZN_SCRATCH/$(echo "$path" | tr -c 'a-zA-Z0-9' _ | cut -c1-60).json}
S=$(zn_secret)
code=$(curl -s -o "$out" -w '%{http_code}' -H "Authorization: Bearer $S" "$ZN_ORIGIN/api/admin/$path")
echo "$code $out $(wc -c <"$out") bytes"
python3 - "$out" <<'PY'
import json,sys
try: d=json.load(open(sys.argv[1]))
except Exception: sys.exit()
print("keys:", list(d.keys())[:12] if isinstance(d,dict) else f"list[{len(d)}]")
PY
