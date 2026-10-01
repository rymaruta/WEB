"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { previousVisit, subscribe } from "./new-badge";

/** 前回の訪問と、そこからの経過時間（分）。ページを開いた時点で一度だけ求める */
let info: { last: number; minutes: number } | null | undefined;
function visitInfo() {
  if (info !== undefined) return info;
  const last = previousVisit();
  info = last ? { last, minutes: Math.floor((Date.now() - last) / 60_000) } : null;
  return info;
}

/** 前回の訪問からの新着への入口。前回が分からない（初めて・保存できない）ときと、直前に見ていたときは出さない */
export function SinceLastVisit() {
  const v = useSyncExternalStore(subscribe, visitInfo, () => null);
  if (!v) return null;
  const { last, minutes } = v;
  if (minutes < 30) return null;
  const ago = minutes < 60 * 24 ? `${Math.max(1, Math.floor(minutes / 60))}時間前` : `${Math.floor(minutes / 1440)}日前`;
  return (
    <Link
      href={`/new?since=${last}`}
      prefetch={false}
      className="flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft/50 px-4 py-3 text-sm font-bold hover:bg-accent-soft"
    >
      <span>
        <span className="mr-1.5 rounded bg-accent px-1.5 py-px text-[10px] font-black text-accent-fg">NEW</span>
        前回の訪問（{minutes < 60 ? "1時間以内" : ago}）からの新しい話題を見る
      </span>
      <span aria-hidden className="text-accent">→</span>
    </Link>
  );
}
