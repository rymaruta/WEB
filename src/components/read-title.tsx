"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { getRead, getReadOnServer, subscribeRead } from "@/lib/read-topics";

/** 読んだ話題の見出しを薄くする（サーバー描画では通常の色。ブラウザで記録と照らしてから変える） */
export function ReadTitle({ id, children }: { id: number; children: ReactNode }) {
  const isRead = useSyncExternalStore(subscribeRead, () => getRead().has(id), () => getReadOnServer().has(id));
  if (!isRead) return <>{children}</>;
  return (
    <span className="text-fg-subtle">
      <span className="sr-only">既読：</span>
      {children}
    </span>
  );
}
