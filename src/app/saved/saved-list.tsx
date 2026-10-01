"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { formatDateTime } from "@/lib/format";
import { getSaved, getSavedOnServer, removeSaved, subscribeSaved } from "@/lib/saved";

export function SavedList() {
  const list = useSyncExternalStore(subscribeSaved, getSaved, getSavedOnServer);
  if (list.length === 0) {
    return (
      <p className="rounded-lg bg-surface-muted p-4 text-sm text-fg-muted">
        まだ保存した記事はありません。記事のページにある「あとで読む」を押すと、ここに並びます。
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {list.map((t) => (
        <li key={t.id} className="flex items-start gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`/topic/${t.id}`} prefetch={false} className="leading-snug font-bold hover:text-accent hover:underline">
              {t.title}
            </Link>
            <p className="mt-0.5 text-xs text-fg-subtle">{formatDateTime(new Date(t.savedAt))}に保存</p>
          </div>
          <button
            type="button"
            onClick={() => removeSaved(t.id)}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:bg-surface-muted"
            aria-label={`「${t.title}」を一覧から外す`}
          >
            外す
          </button>
        </li>
      ))}
    </ul>
  );
}
