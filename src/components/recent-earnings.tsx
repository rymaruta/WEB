"use client";

import Link from "next/link";
import type { EarningsItem } from "@/lib/queries";
import { Expandable } from "./expandable-list";

const LABELS: Record<string, string> = { earnings: "決算", forecast: "業績予想" };

/** 経済のページの「今週の決算・業績予想」。企業ごとに最新の1件。5件を超える分は開いて見る */
export function RecentEarnings({ items }: { items: EarningsItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card p-4">
      <h2 className="text-base font-extrabold">今週の決算・業績予想</h2>
      <p className="mb-1 text-[11px] text-fg-subtle">この1週間に決算や業績予想の修正が報じられた企業（新しい順）</p>
      <Expandable
        items={items}
        keyOf={(e) => `${e.topicId}`}
        render={(e) => (
          <Link href={`/topic/${e.topicId}`} data-topic-id={e.topicId} prefetch={false} className="group flex items-center gap-2 py-1.5">
            <span className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 font-bold text-fg-muted">{LABELS[e.event] ?? "決算"}</span>
            <span className="max-w-[35%] shrink-0 truncate text-sm font-extrabold">{e.company}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-fg-muted group-hover:text-accent" title={e.title}>
              {e.title}
            </span>
          </Link>
        )}
      />
    </section>
  );
}
