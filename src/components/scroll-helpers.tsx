"use client";

import { useSyncExternalStore } from "react";

/** 画面のスクロール量（0〜1 の読み進み具合と、上からの距離） */
function subscribe(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  window.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("scroll", callback);
    window.removeEventListener("resize", callback);
  };
}
const progress = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.round((window.scrollY / max) * 100) / 100) : 0;
};
const farDown = () => window.scrollY > window.innerHeight * 1.5;

/** 記事を読み進めた割合を、画面のいちばん上の細い線で示す（長い記事で、あとどれくらいかが分かる） */
export function ReadingProgress() {
  const p = useSyncExternalStore(subscribe, progress, () => 0);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div className="h-full origin-left bg-accent transition-transform duration-100" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}

/** 下までスクロールしたときに出る「上へ戻る」ボタン（スマホでは下のメニューの上に出す） */
export function BackToTop() {
  const show = useSyncExternalStore(subscribe, farDown, () => false);
  return (
    <button
      type="button"
      aria-label="ページの先頭へ戻る"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/95 text-fg shadow-lg backdrop-blur transition-all sm:bottom-6 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
