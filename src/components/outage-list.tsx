"use client";

import Link from "next/link";
import { OUTAGE_STATUS_LABELS, type OutageItem } from "@/lib/outages";
import { Expandable } from "./expandable-list";
import { Fold } from "./fold";
import { KindBadge } from "./kind-badge";

/** IT のページの「障害・不具合情報」。発生中は目立つ色、復旧済みは控えめに出す。5件を超える分は開いて見る */
export function OutageList({ items }: { items: OutageItem[] }) {
  if (items.length === 0) return null;
  const when = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };
  return (
    <section className="card p-4">
      <Fold
        id="outages"
        summary={
          <>
            <h2 className="text-base font-extrabold">障害・不具合情報</h2>
            <p className="mb-1 text-[11px] text-fg-subtle">この3日間に報じられた、通信・アプリ・ネットのサービスの障害（新しい順）</p>
          </>
        }
      >
        <Expandable
          items={items}
          keyOf={(o) => `${o.topicId}`}
          render={(o) => (
            <Link href={`/topic/${o.topicId}`} data-topic-id={o.topicId} prefetch={false} className="group flex items-center gap-2 py-1.5">
              {o.status === "ongoing" ? (
                <span className="shrink-0 rounded bg-[var(--g-tech)] px-1 text-[10px] leading-4 font-bold text-white">{OUTAGE_STATUS_LABELS[o.status]}</span>
              ) : (
                <KindBadge label={OUTAGE_STATUS_LABELS[o.status]} />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent" title={o.title}>
                {o.title}
              </span>
              <span className="shrink-0 text-[11px] text-fg-subtle tabular-nums">{when(o.at)}</span>
            </Link>
          )}
        />
      </Fold>
    </section>
  );
}
