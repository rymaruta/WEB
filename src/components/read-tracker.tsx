"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { markRead } from "@/lib/read-topics";

/**
 * 読んだ話題を記録する（画面には何も出さない）。
 * - 話題のページを開いたとき
 * - 一覧から元記事へ直接移動したとき（data-topic-id の付いたリンク）
 */
export function ReadTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const m = /^\/topic\/(\d+)$/.exec(pathname);
    if (m) markRead(Number(m[1]));
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-topic-id]");
      if (el) markRead(Number(el.getAttribute("data-topic-id")));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
