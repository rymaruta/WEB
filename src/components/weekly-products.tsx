"use client";

import Link from "next/link";
import { PRODUCT_KIND_LABELS, type ProductItem } from "@/lib/product-kinds";
import { Expandable } from "./expandable-list";

/** 「今週の新発売」。今週・来週を開け閉めでき、最初は今週だけ開く。各週は話題の大きい順 */
export function WeeklyProducts({ weeks }: { weeks: { label: string; items: ProductItem[] }[] }) {
  if (weeks.every((w) => w.items.length === 0)) return null;
  const day = (date: string) => {
    const [, m, d] = date.split("-").map(Number);
    return `${m}/${d}`;
  };
  return (
    <section className="card p-4">
      <h2 className="text-base font-extrabold">新発売</h2>
      <p className="mb-1 text-[11px] text-fg-subtle">記事に書かれた発売日です（話題の大きい順）</p>
      {weeks.map((w, i) =>
        w.items.length === 0 ? null : (
          <details key={w.label} open={i === 0} className="group/week mt-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-xs font-bold text-fg-muted [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-block transition-transform group-open/week:rotate-90">›</span>
              {w.label}
              <span className="font-normal text-fg-subtle">{w.items.length}件</span>
            </summary>
            <Expandable
              items={w.items}
              keyOf={(p) => `${p.topicId}`}
              render={(p) => (
                <Link href={`/topic/${p.topicId}`} data-topic-id={p.topicId} prefetch={false} className="group flex items-center gap-2 py-1.5">
                  <span className="w-10 shrink-0 text-xs font-bold text-[var(--g-products)] tabular-nums">{day(p.date)}</span>
                  <span className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 font-bold text-fg-muted">{PRODUCT_KIND_LABELS[p.kind]}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent" title={p.maker ? `${p.name}（${p.maker}）` : p.name}>
                    {p.name}
                  </span>
                  {p.maker && <span className="max-w-[30%] shrink-0 truncate text-[11px] text-fg-subtle">{p.maker}</span>}
                </Link>
              )}
            />
          </details>
        ),
      )}
    </section>
  );
}
