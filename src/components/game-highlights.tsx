"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { GAME_KIND_LABELS, GAME_PLATFORMS, releaseLabel, type GameKind } from "@/lib/game";
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

/**
 * 選んだ機種は、その人の端末（localStorage）に覚えておき、次に開いたときも同じ機種で絞り込む。
 * 自分の持っているゲーム機の作品だけを見たい人が多いため
 */
const PLATFORM_KEY = "zn:gamePlatform";
const listeners = new Set<() => void>();
/** 保存できない環境で選んだ機種 */
let memory: string | null = null;

function readPlatform(): string {
  try {
    return localStorage.getItem(PLATFORM_KEY) ?? "";
  } catch {
    return "";
  }
}

function writePlatform(value: string) {
  try {
    if (value) localStorage.setItem(PLATFORM_KEY, value);
    else localStorage.removeItem(PLATFORM_KEY);
  } catch {
    // 保存できない環境（プライベートブラウズなど）でも、表示の切り替えはできるようにする
    memory = value;
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => memory ?? readPlatform();

/** topicId がなければ公式ストアだけの作品（storeUrl はストアのページ） */
export type ReleaseItem = { topicId: number | null; title: string; release: string; platforms: string[]; storeUrl: string | null };
export type NewGameItem = { topicId: number; headline: string; kind: string | null; release: string | null; platforms: string[] };

/**
 * ゲームのジャンルページの一番上。今月・来月の発売（日付順）と新着ゲーム（新作発表・発売日決定）。
 * 機種のボタンで、その機種の作品だけに絞れる（もう一度押すと絞り込みを外す。選んだ機種は次回も使う）
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
  const saved = useSyncExternalStore(subscribe, snapshot, () => "");
  if (thisMonth.length + nextMonth.length + newGames.length === 0) return null;

  // 覚えている機種の作品が今は1本もなければ、絞り込まずに出す
  const used = new Set([...thisMonth, ...nextMonth, ...newGames].flatMap((x) => x.platforms));
  const platform = used.has(saved) ? saved : "";
  const match = (p: string[]) => !platform || p.includes(platform);
  const months = [
    { title: monthLabels[0], items: thisMonth.filter((r) => match(r.platforms)) },
    { title: monthLabels[1], items: nextMonth.filter((r) => match(r.platforms)) },
  ];
  const fresh = newGames.filter((g) => match(g.platforms));
  // 実際に出てくる機種だけをボタンにする
  const platforms = GAME_PLATFORMS.filter((p) => used.has(p));
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${active ? "border-[var(--g-game)] bg-[var(--g-game)] text-white" : "border-border bg-surface text-fg-muted hover:text-fg"}`;

  return (
    <div className="space-y-3">
      {platforms.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" role="group" aria-label="ゲーム機で絞り込む">
          {platforms.map((p) => (
            <button key={p} type="button" className={chip(platform === p)} aria-pressed={platform === p} onClick={() => writePlatform(platform === p ? "" : p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-base font-extrabold">発売スケジュール</h2>
          <p className="mb-1 text-[11px] text-fg-subtle">記事に書かれた発売日と、任天堂・Steam の公式ストアの発売予定日（↗ は公式ストアのページ）</p>
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
                  render={(r) => {
                    const row = (
                      <>
                        <span className="w-14 shrink-0 text-xs font-bold text-[var(--g-game)] tabular-nums">{shortRelease(r.release, thisYear)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent" title={`${releaseLabel(r.release, thisYear)} ${r.title}`}>
                          {r.title}
                          {!r.topicId && (
                            <span aria-label="公式ストアのページ" className="ml-1 text-[10px] font-normal text-fg-subtle">
                              ↗
                            </span>
                          )}
                        </span>
                        {r.platforms.length > 0 && (
                          <span className="shrink-0 text-[11px] text-fg-subtle" title={r.platforms.join("・")}>
                            {shortPlatforms(r.platforms)}
                          </span>
                        )}
                      </>
                    );
                    const cls = "group flex items-center gap-2 py-1.5";
                    return r.topicId ? (
                      <Link href={`/topic/${r.topicId}`} data-topic-id={r.topicId} className={cls}>
                        {row}
                      </Link>
                    ) : (
                      <a href={r.storeUrl ?? "#"} target="_blank" rel="noopener nofollow" className={cls}>
                        {row}
                      </a>
                    );
                  }}
                  keyOf={(r) => r.storeUrl ?? `${r.topicId}`}
                />
              </details>
            ),
          )}
          {months.every((m) => m.items.length === 0) && (
            <p className="py-2 text-sm text-fg-subtle">{platform ? `${platform}で` : ""}発売日が報じられた作品はまだありません。</p>
          )}
        </section>
        <section className="card p-4">
          <h2 className="text-base font-extrabold">新着ゲーム</h2>
          <p className="mb-1 text-[11px] text-fg-subtle">この1週間の新作発表・発売日決定</p>
          {fresh.length === 0 ? (
            <p className="py-2 text-sm text-fg-subtle">この1週間の発表はまだありません。</p>
          ) : (
            <Expandable
              items={fresh}
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
    </div>
  );
}
