"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { getSaved, getSavedOnServer, subscribeSaved, toggleSaved } from "@/lib/saved";

/** 「あとで読む」ボタン。保存先はこの端末だけ（ログイン不要） */
export function SaveButton({ id, title }: { id: number; title: string }) {
  const list = useSyncExternalStore(subscribeSaved, getSaved, getSavedOnServer);
  const saved = list.some((t) => t.id === id);
  const [failed, setFailed] = useState(false);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={saved}
        onClick={() => setFailed(!toggleSaved({ id, title }))}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
          saved ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-fg hover:bg-surface-muted"
        }`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M6 3h12v18l-6-4-6 4V3z" strokeLinejoin="round" />
        </svg>
        {saved ? "保存済み" : "あとで読む"}
      </button>
      {saved && (
        <Link href="/saved" prefetch={false} className="text-xs text-accent hover:underline">
          保存した記事
        </Link>
      )}
      {failed && <span className="text-xs text-fg-subtle">この端末では保存できません</span>}
    </span>
  );
}
