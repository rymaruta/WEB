"use client";

import { useSyncExternalStore } from "react";

/**
 * 文字サイズの切り替え（標準・大）。選んだ大きさはこの端末にだけ保存する。
 * 表示の前に反映する処理は layout の FONT_SIZE_SCRIPT（ちらつきを防ぐ）。
 */
const KEY = "zn:font";
const listeners = new Set<() => void>();

const current = () => (document.documentElement.dataset.font === "large" ? "large" : "normal");
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function FontSizeToggle({ className = "" }: { className?: string }) {
  const size = useSyncExternalStore(subscribe, current, () => "normal");
  const toggle = () => {
    const next = size === "large" ? "normal" : "large";
    if (next === "large") document.documentElement.dataset.font = "large";
    else delete document.documentElement.dataset.font;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    listeners.forEach((l) => l());
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={size === "large"}
      className={`inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-bold text-fg hover:bg-surface-muted ${className}`}
    >
      <span aria-hidden className="text-[13px]">あ</span>
      <span aria-hidden className="text-[17px] leading-none">あ</span>
      {size === "large" ? "標準の文字に戻す" : "文字を大きく"}
    </button>
  );
}

/** 最初の描画の前に、保存された文字サイズを反映する（<head> に置く） */
export const FONT_SIZE_SCRIPT = `try{if(localStorage.getItem("${KEY}")==="large")document.documentElement.dataset.font="large"}catch(e){}`;
