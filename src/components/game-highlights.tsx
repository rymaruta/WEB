"use client";

import Link from "next/link";
import { GAME_KIND_LABELS, releaseLabel, type GameKind } from "@/lib/game";
import { Expandable } from "./expandable-list";
import { ReadTitle } from "./read-title";

/** 発売日の短い表示（10/2、10月中、2027年） */
function shortRelease(date: string, thisYear: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!m) return `${y}年`;
  const prefix = y === thisYear ? "" : `${y}/`;
  return d ? `${prefix}${m}/${d}` : `${prefix}${m}月中`;
}

/** 機種の短い表示（1つならそのまま、2つ以上は「PS5 他2」） */
function shortPlatforms(p: string[]): string {
  return p.length <= 1 ? (p[0] ?? "") : `${p[0]} 他${p.length - 1}`;
}

export type ReleaseItem = { topicId: number; title: string; release: string; platforms: string[] };
export type NewGameItem = { topicId: number; headline: string; kind: string | null; release: string | null; platforms: string[] };

/**
 * ゲームのジャンルページの一番上。今月・来月の発売（日付順）と新着ゲーム（新作発表・発売日決定）
 */
export function GameHighlights({
  thisMonth,
  nextMonth,
  newGames,
  thisYear,
  monthLabels,
}: {
  thisMonth: ReleaseItem[];
  nextMonth: ReleaseItem[];
  newGames: NewGameItem[];
  thisYear: number;
  monthLabels: [string, string];
}) {
  if (thisMonth.length + nextMonth.length + newGames.length === 0) return null;

  const months = [
    { title: monthLabels[0], items: thisMonth },
    { title: monthLabels[1], items: nextMonth },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-4">
        <h2 className="text-base font-extrabold">発売スケジュール</h2>
        <p className="mb-1 text-[11px] text-fg-subtle">記事に書かれた発売日（延期は新しい日付）</p>
        {/* 月ごとに開け閉めできる。最初は今月だけ開く */}
        {months.map((m, i) =>
          m.items.length === 0 ? null : (
            <details key={m.title} open={i === 0} className="group/month mt-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-xs font-bold text-fg-muted [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block transition-transform group-open/month:rotate-90">›</span>
                {m.title}
                <span className="font-normal text-fg-subtle">{m.items.length}本</span>
              </summary>
              <Expandable
                items={m.items}
                render={(r) => (
                  <Link href={`/topic/${r.topicId}`} data-topic-id={r.topicId} className="group flex items-center gap-2 py-1.5">
                    <span className="w-14 shrink-0 text-xs font-bold text-[var(--g-game)] tabular-nums">{shortRelease(r.release, thisYear)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent" title={`${releaseLabel(r.release, thisYear)} ${r.title}`}>
                      {r.title}
                    </span>
                    {r.platforms.length > 0 && (
                      <span className="shrink-0 text-[11px] text-fg-subtle" title={r.platforms.join("・")}>
                        {shortPlatforms(r.platforms)}
                      </span>
                    )}
                  </Link>
                )}
                keyOf={(r) => `${r.topicId}`}
              />
            </details>
          ),
        )}
        {months.every((m) => m.items.length === 0) && (
          <p className="py-2 text-sm text-fg-subtle">発売日が報じられた作品はまだありません。</p>
        )}
      </section>
      <section className="card p-4">
        <h2 className="text-base font-extrabold">新着ゲーム</h2>
        <p className="mb-1 text-[11px] text-fg-subtle">この1週間の新作発表・発売日決定</p>
        {newGames.length === 0 ? (
          <p className="py-2 text-sm text-fg-subtle">この1週間の発表はまだありません。</p>
        ) : (
          <Expandable
            items={newGames}
            keyOf={(g) => `${g.topicId}`}
            render={(g) => (
              <Link href={`/topic/${g.topicId}`} data-topic-id={g.topicId} className="group flex items-start gap-2 py-1.5">
                <span className="mt-0.5 shrink-0 rounded bg-[var(--g-game)] px-1 text-[10px] leading-4 font-bold text-white">
                  {GAME_KIND_LABELS[(g.kind ?? "other") as GameKind] || "新作"}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-snug font-bold group-hover:text-accent">
                  <span className="line-clamp-2">
                    <ReadTitle id={g.topicId}>{g.headline}</ReadTitle>
                  </span>
                </span>
                {g.release && <span className="mt-0.5 shrink-0 text-[11px] text-fg-subtle tabular-nums">{shortRelease(g.release, thisYear)}</span>}
              </Link>
            )}
          />
        )}
      </section>
    </div>
  );
}
