"use client";

import Link from "next/link";
import { useState } from "react";
import { GAME_KIND_LABELS, GAME_PLATFORMS, releaseLabel, type GameKind } from "@/lib/game";
import { ReadTitle } from "./read-title";

export type ReleaseItem = { topicId: number; title: string; release: string; platforms: string[] };
export type NewGameItem = { topicId: number; headline: string; kind: string | null; release: string | null; platforms: string[] };

/**
 * ゲームのジャンルページの一番上。今月・来月の発売（日付順）と新着ゲーム（新作発表・発売日決定）。
 * 機種のボタンで、その機種の作品だけに絞れる
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
  const [platform, setPlatform] = useState<string>("");
  if (thisMonth.length + nextMonth.length + newGames.length === 0) return null;

  const match = (p: string[]) => !platform || p.includes(platform);
  const months = [
    { title: monthLabels[0], items: thisMonth.filter((r) => match(r.platforms)) },
    { title: monthLabels[1], items: nextMonth.filter((r) => match(r.platforms)) },
  ];
  const fresh = newGames.filter((g) => match(g.platforms));
  // 実際に出てくる機種だけをボタンにする
  const used = new Set([...thisMonth, ...nextMonth, ...newGames].flatMap((x) => x.platforms));
  const platforms = GAME_PLATFORMS.filter((p) => used.has(p));
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${active ? "border-[var(--g-game)] bg-[var(--g-game)] text-white" : "border-border bg-surface text-fg-muted hover:text-fg"}`;

  return (
    <div className="space-y-3">
      {platforms.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" role="group" aria-label="ゲーム機で絞り込む">
          <button type="button" className={chip(!platform)} aria-pressed={!platform} onClick={() => setPlatform("")}>
            すべての機種
          </button>
          {platforms.map((p) => (
            <button key={p} type="button" className={chip(platform === p)} aria-pressed={platform === p} onClick={() => setPlatform(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-1 text-base font-extrabold">発売スケジュール</h2>
          <p className="mb-2 text-xs text-fg-subtle">記事に書かれた発売日です。延期などで変わったときは、新しい報道の日付にしています</p>
          {months.map((m) =>
            m.items.length === 0 ? null : (
              <div key={m.title} className="mt-2">
                <h3 className="mb-1 text-xs font-bold text-fg-muted">{m.title}</h3>
                <ul className="divide-y divide-border">
                  {m.items.map((r) => (
                    <li key={r.title}>
                      <Link href={`/topic/${r.topicId}`} data-topic-id={r.topicId} className="group flex items-baseline gap-3 py-2">
                        <span className="w-20 shrink-0 text-xs font-bold text-[var(--g-game)] tabular-nums">{releaseLabel(r.release, thisYear)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug font-bold group-hover:text-accent">{r.title}</span>
                          {r.platforms.length > 0 && <span className="text-xs text-fg-subtle">{r.platforms.join("・")}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
          {months.every((m) => m.items.length === 0) && (
            <p className="py-2 text-sm text-fg-subtle">{platform ? `${platform}で` : ""}発売日が報じられた作品はまだありません。</p>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-1 text-base font-extrabold">新着ゲーム</h2>
          <p className="mb-2 text-xs text-fg-subtle">直近1週間に新作の発表・発売日の決定が報じられた作品</p>
          {fresh.length === 0 ? (
            <p className="py-2 text-sm text-fg-subtle">この1週間の発表はまだありません。</p>
          ) : (
            <ul className="divide-y divide-border">
              {fresh.map((g) => (
                <li key={g.topicId}>
                  <Link href={`/topic/${g.topicId}`} data-topic-id={g.topicId} className="group block py-2.5">
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-[var(--g-game)] px-1.5 py-px font-bold text-white">
                        {GAME_KIND_LABELS[(g.kind ?? "other") as GameKind] || "新作"}
                      </span>
                      {g.release && <span className="text-fg-subtle">発売 {releaseLabel(g.release, thisYear)}</span>}
                      {g.platforms.length > 0 && <span className="text-fg-subtle">{g.platforms.join("・")}</span>}
                    </span>
                    <span className="mt-1 block text-sm leading-snug font-bold group-hover:text-accent">
                      <ReadTitle id={g.topicId}>{g.headline}</ReadTitle>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
