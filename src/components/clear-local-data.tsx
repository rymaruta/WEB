"use client";

import { useState } from "react";

/** このサイトが端末に保存した項目の名前の頭（src/lib/saved.ts・read-topics.ts・follows.ts など） */
const PREFIX = "zn:";

/** 端末に保存した記録（既読・前回の訪問・あとで読む・フォロー・表示の設定）をまとめて消す */
export function ClearLocalData() {
  const [done, setDone] = useState<null | number>(null);
  const clear = () => {
    if (!window.confirm("この端末に保存した、既読・前回の訪問日時・あとで読む・フォロー・表示の設定をすべて消します。よろしいですか？")) return;
    let removed = 0;
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(PREFIX)) continue;
        localStorage.removeItem(key);
        removed++;
      }
    } catch {
      // 保存領域が使えない端末（プライベートブラウズなど）は、消すものがない
    }
    setDone(removed);
  };
  return (
    <div className="mt-3">
      <button type="button" onClick={clear} className="rounded-lg border border-border px-3 py-2 text-sm font-bold hover:border-accent hover:text-accent">
        この端末の記録をすべて消す
      </button>
      <p className="mt-1 text-xs text-fg-muted" role="status">
        {done !== null && (done > 0 ? `${done}件の記録を消しました。` : "消す記録はありませんでした。")}
      </p>
    </div>
  );
}
