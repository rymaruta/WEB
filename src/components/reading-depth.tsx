"use client";

import { useSyncExternalStore } from "react";
import { READING_DEPTH_KEY } from "@/lib/reading-depth";

/**
 * 話題ページの読み分け（30秒・3分・10分）。同じページの中で、表示する情報の量を段階的に変える。
 * - 30秒: 3行でわかる＋ポイント（出典の種類の印つき）
 * - 3分: ＋本文・経緯・その後の動き
 * - 10分: ＋報道くらべ・出来事の流れ・元の記事のすべて（初期値。何も隠さない）
 * 隠す部分には data-min-depth（"3m" か "10m"）を付け、CSS で消す（src/app/globals.css）。中身は HTML に残るので、検索エンジン・読み上げにはすべて届く。
 * 選んだ長さはこの端末にだけ保存し、表示の前に反映する（src/lib/reading-depth.ts の READING_DEPTH_SCRIPT。ちらつきを防ぐ）
 */
const KEY = READING_DEPTH_KEY;
export const DEPTHS = [
  { key: "30s", label: "30秒", note: "要点だけ" },
  { key: "3m", label: "3分", note: "概要と背景" },
  { key: "10m", label: "10分", note: "報道比較まですべて" },
] as const;
export type Depth = (typeof DEPTHS)[number]["key"];
const DEFAULT: Depth = "10m";

const listeners = new Set<() => void>();
const current = (): Depth => {
  const d = document.documentElement.dataset.depth;
  return DEPTHS.some((x) => x.key === d) ? (d as Depth) : DEFAULT;
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** 読む長さを変えて、端末に保存する */
function choose(next: Depth) {
  const root = document.documentElement;
  if (next === DEFAULT) delete root.dataset.depth;
  else root.dataset.depth = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  listeners.forEach((l) => l());
}

export function ReadingDepth() {
  const depth = useSyncExternalStore(subscribe, current, () => DEFAULT);
  return (
    <div className="mb-4 flex items-center gap-2" role="radiogroup" aria-label="読む長さ">
      <span className="shrink-0 text-xs font-bold text-fg-muted">読む長さ</span>
      <div className="grid flex-1 grid-cols-3 rounded-full border border-border bg-surface-muted p-0.5 sm:max-w-sm">
        {DEPTHS.map((d) => (
          <button
            key={d.key}
            type="button"
            role="radio"
            aria-checked={depth === d.key}
            onClick={() => choose(d.key)}
            title={d.note}
            className={`min-h-9 rounded-full px-2 text-sm font-bold transition-colors ${depth === d.key ? "bg-accent text-accent-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
