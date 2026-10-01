"use client";

import { useSyncExternalStore } from "react";

/**
 * 前回の訪問のあとに出たニュースに付ける「NEW」の印。
 * 訪問の時刻はその人の端末（localStorage）にだけ保存し、サーバーには送らない。
 * 同じ訪問（タブを開いている間）は「前回」を固定して、読み進めても印が消えないようにする（sessionStorage）。
 */
const KEY_LAST = "zn:lastVisit";
const KEY_PREV = "zn:prevVisit";

let prev: number | null | undefined;

export function previousVisit(): number | null {
  if (prev !== undefined) return prev;
  try {
    const fixed = sessionStorage.getItem(KEY_PREV);
    if (fixed !== null) {
      prev = fixed ? Number(fixed) : null;
    } else {
      const last = localStorage.getItem(KEY_LAST);
      prev = last ? Number(last) : null;
      sessionStorage.setItem(KEY_PREV, last ?? "");
      localStorage.setItem(KEY_LAST, String(Date.now()));
    }
  } catch {
    // 保存できない環境（プライベートブラウズなど）では印を出さない
    prev = null;
  }
  return prev;
}

export const subscribe = () => () => {};

export function NewBadge({ since }: { since: Date | string }) {
  // サーバー描画では出さず、ブラウザで前回の訪問と比べてから出す
  const last = useSyncExternalStore(subscribe, previousVisit, () => null);
  if (!last || new Date(since).getTime() <= last) return null;
  return (
    <span className="rounded bg-accent px-1.5 py-px text-[10px] leading-4 font-black tracking-wide text-accent-fg" aria-label="前回の訪問後の新着">
      NEW
    </span>
  );
}
