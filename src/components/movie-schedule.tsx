"use client";

import Link from "next/link";
import type { MovieItem } from "@/lib/movie-listings";
import { Expandable } from "./expandable-list";

/** エンタメのページの「映画の公開スケジュール」。月ごとに開け閉めでき、最初は今月だけ開く。作品名を押すとサイト内の関連ニュースを探す */
export function MovieSchedule({ months, sourceUrl }: { months: { month: number; items: MovieItem[] }[]; sourceUrl: string }) {
  if (months.every((m) => m.items.length === 0)) return null;
  const day = (date: string) => {
    const [, m, d] = date.split("-").map(Number);
    return `${m}/${d}`;
  };
  return (
    <section className="card p-4">
      <h2 className="text-base font-extrabold">映画の公開スケジュール</h2>
      <p className="mb-1 text-[11px] text-fg-subtle">
        日本での公開日（出典：
        <a href={sourceUrl} target="_blank" rel="noopener nofollow" className="underline hover:text-fg">
          Wikipedia
        </a>
        、CC BY-SA）
      </p>
      {months.map((m, i) =>
        m.items.length === 0 ? null : (
          <details key={m.month} open={i === 0} className="group/month mt-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-xs font-bold text-fg-muted [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-block transition-transform group-open/month:rotate-90">›</span>
              {m.month}月の公開
              <span className="font-normal text-fg-subtle">{m.items.length}本</span>
            </summary>
            <Expandable
              items={m.items}
              keyOf={(f) => `${f.release}-${f.title}`}
              render={(f) => (
                <Link href={`/search?q=${encodeURIComponent(f.title)}`} prefetch={false} className="group flex items-center gap-2 py-1.5">
                  <span className="w-10 shrink-0 text-xs font-bold text-[var(--g-entertainment)] tabular-nums">{day(f.release)}</span>
                  <span className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 font-bold text-fg-muted">
                    {f.country === "日本" ? "邦画" : "洋画"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent" title={f.country ? `${f.title}（${f.country}）` : f.title}>
                    {f.title}
                  </span>
                </Link>
              )}
            />
          </details>
        ),
      )}
    </section>
  );
}
