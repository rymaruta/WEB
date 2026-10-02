"use client";

import Link from "next/link";
import { ANIME_KIND_LABELS, type AnimeItem } from "@/lib/anime-kinds";
import { Expandable } from "./expandable-list";
import { Fold } from "./fold";

/** アニメの「放送・配信スケジュール」。月ごとに開け閉めでき、最初は今月だけ開く */
export function AnimeSchedule({ months, thisYear }: { months: { month: number; items: AnimeItem[] }[]; thisYear: number }) {
  if (months.every((m) => m.items.length === 0)) return null;
  const day = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    const prefix = y === thisYear ? "" : `${y}/`;
    return d ? `${prefix}${m}/${d}` : `${prefix}${m}月中`;
  };
  return (
    <section className="card p-4">
      <Fold
        id="anime-schedule"
        summary={
          <>
            <h2 className="text-base font-extrabold">放送・配信スケジュール</h2>
            <p className="mb-1 text-[11px] text-fg-subtle">テレビ放送・配信・劇場公開の始まる日です（記事に書かれた日付）</p>
          </>
        }
      >
        {months.map((m, i) =>
          m.items.length === 0 ? null : (
            <details key={m.month} open={i === 0} className="group/month mt-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-xs font-bold text-fg-muted [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block transition-transform group-open/month:rotate-90">›</span>
                {m.month}月に始まる作品
                <span className="font-normal text-fg-subtle">{m.items.length}件</span>
              </summary>
              <Expandable
                items={m.items}
                keyOf={(a) => `${a.topicId}-${a.kind}`}
                render={(a) => (
                  <Link href={`/topic/${a.topicId}`} data-topic-id={a.topicId} prefetch={false} className="group flex items-center gap-2 py-1.5">
                    <span className="w-12 shrink-0 text-xs font-bold text-[var(--g-anime)] tabular-nums">{day(a.date)}</span>
                    <span className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 font-bold text-fg-muted">{ANIME_KIND_LABELS[a.kind]}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent" title={a.channel ? `${a.title}（${a.channel}）` : a.title}>
                      {a.title}
                    </span>
                    {a.channel && <span className="max-w-[30%] shrink-0 truncate text-[11px] text-fg-subtle">{a.channel}</span>}
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
