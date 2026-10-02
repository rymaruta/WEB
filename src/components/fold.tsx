"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 見出しを押して閉じたり開いたりできる枠。最初は開いている。
 * 閉じた・開いた状態はその人の端末（localStorage）に覚えておき、次に開いたときも同じにする（id ごと）。
 */
export function Fold({ id, summary, children, className = "" }: { id: string; summary: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const key = `zn:fold:${id}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && ref.current) ref.current.open = saved === "1";
    } catch {
      // 保存できない環境では、いつも開いた状態で出す
    }
  }, [key]);
  return (
    <details
      ref={ref}
      open
      className={`group/fold ${className}`}
      onToggle={(e) => {
        try {
          localStorage.setItem(key, e.currentTarget.open ? "1" : "0");
        } catch {}
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">{summary}</div>
        <span aria-hidden className="shrink-0 text-lg leading-none text-fg-subtle transition-transform group-open/fold:rotate-90">
          ›
        </span>
      </summary>
      {children}
    </details>
  );
}
