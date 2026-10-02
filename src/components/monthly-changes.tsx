"use client";

import Link from "next/link";
import { CHANGE_KIND_LABELS, type ChangeItem } from "@/lib/change-kinds";
import { Expandable } from "./expandable-list";
import { Fold } from "./fold";

/** 「◯月から変わること」。月ごとに開け閉めでき、最初は今月だけ開く */
export function MonthlyChanges({ months, thisYear }: { months: { month: number; items: ChangeItem[] }[]; thisYear: number }) {
  if (months.every((m) => m.items.length === 0)) return null;
  const day = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    const prefix = y === thisYear ? "" : `${y}/`;
    return d ? `${prefix}${m}/${d}` : `${prefix}${m}月中`;
  };
  return (
    <section className="card p-4">
      <Fold
        id="changes"
        summary={
          <>
            <h2 className="text-base font-extrabold">暮らしに関わる変更</h2>
            <p className="mb-1 text-[11px] text-fg-subtle">値上げ・制度・サービスの開始や終了など。記事に書かれた開始日です</p>
          </>
        }
      >
        {months.map((m, i) =>
          m.items.length === 0 ? null : (
            <details key={m.month} open={i === 0} className="group/month mt-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-xs font-bold text-fg-muted [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block transition-transform group-open/month:rotate-90">›</span>
                {m.month}月から変わること
                <span className="font-normal text-fg-subtle">{m.items.length}件</span>
              </summary>
              <Expandable
                items={m.items}
                keyOf={(c) => `${c.topicId}`}
                render={(c) => (
                  <Link href={`/topic/${c.topicId}`} data-topic-id={c.topicId} prefetch={false} className="group flex items-center gap-2 py-1.5">
                    <span className="w-12 shrink-0 text-xs font-bold text-accent tabular-nums">{day(c.date)}</span>
                    <span className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 font-bold text-fg-muted">{CHANGE_KIND_LABELS[c.kind]}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent" title={c.title}>
                      {c.title}
                    </span>
                  </Link>
                )}
              />
            </details>
          ),
        )}
      </Fold>
    </section>
  );
}
