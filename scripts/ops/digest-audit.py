#!/usr/bin/env python3
"""定時配信の偏りの点検。直近の日の各回の見出しと、載らなかった候補の理由の内訳を出す。
使い方: python3 scripts/ops/digest-audit.py [日数=3]"""
import collections, datetime, json, os, re, subprocess, sys
days = int(sys.argv[1]) if len(sys.argv) > 1 else 3
here = os.path.dirname(__file__)
jst = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
reasons = collections.Counter()
for i in range(days - 1, -1, -1):
    d = (jst - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
    out = subprocess.run([f"{here}/admin-get.sh", f"editions?date={d}"], capture_output=True, text=True).stdout.split()[1]
    eds = json.load(open(out)); eds = eds if isinstance(eds, list) else eds.get("editions", [])
    for e in eds:
        if e["slot"] in ("BREAKING", "PICKUP"): continue
        print(e["key"], e["status"], " / ".join(l for l in (e.get("postText") or []) if l.startswith("・")))
        for r in (e.get("notes") or {}).get("rejected", []): reasons[re.sub(r"（.*", "", r["reason"])] += 1
print("== 載らなかった理由", reasons.most_common())
