"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** 広い画面（サイドバーがある幅）。これより狭いと、サイドバーはページの一番下に来る */
const WIDE = "(min-width: 1024px)";

/**
 * トップのサイドバーの枠。スマホでは一番下に来るため最初は閉じ、見出しを押すと開く（ページが縦に長くなりすぎないように）。
 * 広い画面では開いたまま。開け閉めはその人の端末（localStorage）に覚えておく
 */
export function SideFold({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const key = `zn:fold:${id}`;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      if (window.matchMedia(WIDE).matches) return;
      el.open = localStorage.getItem(key) === "1";
    } catch {
      el.open = false;
    }
  }, [key]);
  return (
    <details
      ref={ref}
      open
      className="group/side card p-4"
      onToggle={(e) => {
        try {
          if (!window.matchMedia(WIDE).matches) localStorage.setItem(key, e.currentTarget.open ? "1" : "0");
        } catch {}
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="h-5 w-1.5 shrink-0 rounded-full bg-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-base leading-tight font-black sm:text-lg">{title}</span>
          {note && <span className="block truncate text-[11px] text-fg-subtle">{note}</span>}
        </span>
        <span aria-hidden className="shrink-0 text-lg leading-none text-fg-subtle transition-transform group-open/side:rotate-90">
          ›
        </span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
