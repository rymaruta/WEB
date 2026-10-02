"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** 横に動かせる部品（ボタンの列など）の上で始まった操作は、その部品の操作として扱う */
function insideHorizontalScroller(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches("input, textarea, select, [data-no-swipe]")) return true;
    const style = getComputedStyle(n);
    if ((style.overflowX === "auto" || style.overflowX === "scroll") && n.scrollWidth > n.clientWidth) return true;
  }
  return false;
}

/**
 * スマホで、画面を左右になぞるとジャンルのタブを切り替える（左へ→次のタブ、右へ→前のタブ）。
 * 並びは上のタブと同じ。タブのページ（トップ・各ジャンル・企業別）でだけ動く
 */
export function SwipeTabs({ hrefs }: { hrefs: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const index = hrefs.indexOf(pathname);

  // 隣のタブを先に読み込んでおき、切り替えを速くする
  useEffect(() => {
    if (index < 0) return;
    for (const i of [index - 1, index + 1]) if (hrefs[i]) router.prefetch(hrefs[i]);
  }, [index, hrefs, router]);

  useEffect(() => {
    if (index < 0) return;
    let start: { x: number; y: number; t: number; ignore: boolean } | null = null;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: Date.now(), ignore: insideHorizontalScroller(e.target as Element) };
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || s.ignore) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      // はっきり横に、ある程度の速さでなぞったときだけ（縦のスクロールや、ゆっくりした操作では切り替えない）
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - s.t > 600) return;
      const next = hrefs[index + (dx < 0 ? 1 : -1)];
      if (next) router.push(next);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [index, hrefs, router]);

  return null;
}
