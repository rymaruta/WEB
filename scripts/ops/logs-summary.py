#!/usr/bin/env python3
"""本番の記録（EventLog）を要約する。種類ごとの件数と最新の時刻、警告・エラー、定期実行の起動を短く出す。
使い方: python3 scripts/ops/logs-summary.py [時間=12]"""
import collections, json, subprocess, sys, os
hours = sys.argv[1] if len(sys.argv) > 1 else "12"
here = os.path.dirname(__file__)
out = subprocess.run([f"{here}/admin-get.sh", f"logs?hours={hours}&limit=1000"], capture_output=True, text=True).stdout.split()[1]
rows = json.load(open(out))
by = collections.defaultdict(list)
for r in rows: by[r["scope"]].append(r["at"])
print(f"== {len(rows)} 件（{hours}時間）")
for k, v in sorted(by.items(), key=lambda x: max(x[1]), reverse=True): print(f"{k:28} {len(v):4}  最新 {max(v)[:16]}")
print("== 警告・エラー（新しい順・最大15）")
for r in [r for r in rows if r["level"] in ("warn", "error") and r["scope"] != "story.analyze"][:15]: print(r["at"][:16], r["level"], r["scope"], r["message"][:100])
print("== 定期実行の起動（最大8。失敗はセッションの状態で確かめる）")
for r in [r for r in rows if r["scope"] == "routine.fire"][:8]: print(r["at"][:16], r["message"][:40], (r.get("data") or {}).get("sessionUrl", "")[-28:])
