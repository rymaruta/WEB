"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CALENDAR_CATEGORIES, CALENDAR_COLORS, CALENDAR_LABELS, type CalendarCategory, type CalendarItem } from "@/lib/calendar-kinds";

/** 選んだ分野は、その人の端末（localStorage）に覚えておく */
const KEY = "zn:calendar";
const listeners = new Set<() => void>();
let memory: string | null = null;
const read = () => {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    memory = v;
  }
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** 日付の見出し（10月3日（土）） */
function dayLabel(date: string): { label: string; weekend: "sat" | "sun" | null } {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { label: `${m}月${d}日（${"日月火水木金土"[dow]}）`, weekend: dow === 0 ? "sun" : dow === 6 ? "sat" : null };
}

/** 最初に出す日数。続きは「もっと見る」で（閉じた日は1行なので、多めに出す） */
const FIRST_DAYS = 21;

export function CalendarView({ items, counts }: { items: CalendarItem[]; counts: Record<string, number> }) {
  const saved = useSyncExternalStore(subscribe, read, () => "");
  const selected = useMemo(() => new Set(saved.split(",").filter((c): c is CalendarCategory => (CALENDAR_CATEGORIES as readonly string[]).includes(c))), [saved]);
  const [showAll, setShowAll] = useState(false);
  const shown = selected.size ? items.filter((it) => selected.has(it.category)) : items;
  const days = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of shown) m.set(it.date, [...(m.get(it.date) ?? []), it]);
    return [...m];
  }, [shown]);
  const visible = showAll ? days : days.slice(0, FIRST_DAYS);
  const toggle = (c: CalendarCategory) => {
    const next = new Set(selected);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    write([...next].join(","));
  };
  const icsPath = `/calendar.ics${selected.size ? `?c=${[...selected].join(",")}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" role="group" aria-label="分野で絞り込む">
          {CALENDAR_CATEGORIES.filter((c) => counts[c] > 0).map((c) => {
            const on = selected.has(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${on ? "text-white" : "border-border bg-surface text-fg-muted hover:text-fg"}`}
                style={on ? { backgroundColor: CALENDAR_COLORS[c], borderColor: CALENDAR_COLORS[c] } : undefined}
              >
                {CALENDAR_LABELS[c]}
                <span className="ml-1 font-normal opacity-80">{counts[c]}</span>
              </button>
            );
          })}
          {selected.size > 0 && (
            <button type="button" onClick={() => write("")} className="shrink-0 px-2 text-xs text-fg-subtle underline">
              すべて表示
            </button>
          )}
        </div>
        <p className="text-xs text-fg-muted">
          <a href={icsPath} className="font-bold text-accent hover:underline">
            スマホのカレンダーに追加
          </a>
          <span className="ml-1 text-fg-subtle">（{selected.size ? "選んだ分野だけ。" : ""}予定は自動で増えます）</span>
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="card p-6 text-sm text-fg-subtle">この期間の予定はまだありません。</p>
      ) : (
        <ol className="card divide-y divide-border px-4 sm:px-5">
          {visible.map(([date, list], dayIndex) => {
            const { label, weekend } = dayLabel(date);
            // 分野ごとにまとめる（分野の名前は1回だけ出し、1件は1行にする）
            const byCat = CALENDAR_CATEGORIES.map((c) => [c, list.filter((it) => it.category === c)] as const).filter(([, l]) => l.length > 0);
            return (
              <li key={date}>
                {/* 日付ごとに開け閉めできる。最初は今日と明日だけ開き、ほかの日は分野ごとの件数だけを見せる */}
                <details open={dayIndex < 2} className="group/day py-2.5">
                  <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden className="inline-block text-fg-subtle transition-transform group-open/day:rotate-90">
                      ›
                    </span>
                    <h2
                      className={`shrink-0 text-sm font-black ${weekend === "sun" ? "text-red-600 dark:text-red-400" : weekend === "sat" ? "text-blue-600 dark:text-blue-400" : ""}`}
                    >
                      {label}
                    </h2>
                    <span className="flex min-w-0 flex-wrap gap-1">
                      {byCat.map(([c, l]) => (
                        <span key={c} className="rounded px-1.5 text-[10px] leading-4 font-bold text-white" style={{ backgroundColor: CALENDAR_COLORS[c] }}>
                          {CALENDAR_LABELS[c]} {l.length}
                        </span>
                      ))}
                    </span>
                  </summary>
                  <div className="mt-1.5 space-y-2 pl-4">
                    {byCat.map(([c, l]) => (
                      <section key={c} aria-label={CALENDAR_LABELS[c]}>
                        <h3 className="text-[11px] font-bold" style={{ color: CALENDAR_COLORS[c] }}>
                          {CALENDAR_LABELS[c]}
                        </h3>
                        <ul>
                          {l.map((it, i) => {
                            const body = (
                              <>
                                <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent" title={it.title}>
                                  {it.title}
                                  {it.external && <span className="ml-1 text-[10px] font-normal text-fg-subtle">↗</span>}
                                </span>
                                {it.note && (
                                  <span className="max-w-[38%] shrink-0 truncate text-[11px] text-fg-subtle" title={it.note}>
                                    {it.note}
                                  </span>
                                )}
                              </>
                            );
                            const cls = "group flex items-center gap-2 py-1";
                            return (
                              <li key={`${it.title}-${i}`}>
                                {it.href && !it.external ? (
                                  <Link href={it.href} prefetch={false} className={cls}>
                                    {body}
                                  </Link>
                                ) : it.href ? (
                                  <a href={it.href} target="_blank" rel="noopener nofollow" className={cls}>
                                    {body}
                                  </a>
                                ) : (
                                  <div className={cls}>{body}</div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      {!showAll && days.length > FIRST_DAYS && (
        <button type="button" onClick={() => setShowAll(true)} className="w-full rounded-lg border border-border bg-surface py-2 text-sm font-bold text-accent hover:border-accent">
          この先の予定も見る（あと{days.length - FIRST_DAYS}日分）
        </button>
      )}
    </div>
  );
}
