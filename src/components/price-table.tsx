"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PriceChange } from "@/lib/changes";
import { countdown, isUpcoming } from "@/lib/price-dates";

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const rateOf = (p: PriceChange) => (p.before && p.after ? Math.round(((p.after - p.before) / p.before) * 1000) / 10 : p.rate);

function DateBlock({ date }: { date: string }) {
  const [y, m, d] = date.split("-").map(Number);
  return (
    <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-surface-muted py-1 leading-tight">
      {d ? (
        <>
          <span className="text-[10px] text-fg-subtle">{m}月</span>
          <span className="text-lg font-black tabular-nums">{d}</span>
          <span className="text-[10px] text-fg-subtle">{WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}</span>
        </>
      ) : (
        <>
          <span className="text-lg font-black tabular-nums">{m}</span>
          <span className="text-[10px] text-fg-subtle">月中</span>
        </>
      )}
    </span>
  );
}

function Row({ p, today, upcoming }: { p: PriceChange; today: string; upcoming: boolean }) {
  const r = rateOf(p);
  const up = p.kind === "price_up";
  return (
    <li>
      <Link href={`/topic/${p.topicId}`} prefetch={false} className="group flex items-start gap-3 py-3">
        <DateBlock date={p.date} />
        <span className="min-w-0 flex-1">
          {p.company && <span className="block text-xs font-bold text-fg-muted">{p.company}</span>}
          <span className="block text-[15px] leading-snug font-bold group-hover:text-accent">{p.title}</span>
          {p.before && p.after && (
            <span className="mt-1 block text-sm tabular-nums">
              <span className="text-fg-subtle line-through">{yen(p.before)}</span>
              <span className="mx-1 text-fg-subtle">→</span>
              <span className={`font-bold ${up ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>{yen(p.after)}</span>
            </span>
          )}
          {upcoming && <span className="mt-1 inline-block rounded-full bg-accent-soft px-2 text-[11px] leading-5 font-bold text-accent">{countdown(p.date, today)}</span>}
        </span>
        <span className={`shrink-0 rounded px-1.5 text-[11px] leading-5 font-bold text-white ${up ? "bg-red-500" : "bg-blue-500"}`}>
          {up ? "値上げ" : "値下げ"}
          {r !== null && ` ${r > 0 ? "+" : ""}${r}%`}
        </span>
      </Link>
    </li>
  );
}

/**
 * 値上げ・値下げの一覧。これから始まるもの（近い順、始まるまでの日数つき）と、すでに始まったもの（新しい順）に分ける。
 * 会社名・品目で絞り込める。today は日本時間の今日（YYYY-MM-DD）
 */
export function PriceTable({ items, today }: { items: PriceChange[]; today: string }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "price_up" | "price_down">("all");
  const { upcoming, started } = useMemo(() => {
    const words = q.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
    const hit = items
      .filter((p) => kind === "all" || p.kind === kind)
      .filter((p) => words.every((w) => `${p.title} ${p.company ?? ""}`.normalize("NFKC").toLowerCase().includes(w)));
    return { upcoming: hit.filter((p) => isUpcoming(p.date, today)), started: hit.filter((p) => !isUpcoming(p.date, today)).reverse() };
  }, [items, q, kind, today]);
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-bold ${on ? "border-accent bg-accent text-accent-fg" : "border-border text-fg-muted hover:text-fg"}`;

  return (
    <>
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="会社名・品目で探す（例：たばこ、ドコモ）"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base"
        />
        <div className="flex gap-1.5" role="group" aria-label="種類">
          <button type="button" className={chip(kind === "all")} onClick={() => setKind("all")}>
            すべて
          </button>
          <button type="button" className={chip(kind === "price_up")} onClick={() => setKind("price_up")}>
            値上げ
          </button>
          <button type="button" className={chip(kind === "price_down")} onClick={() => setKind("price_down")}>
            値下げ
          </button>
        </div>
      </div>
      <section aria-labelledby="prices-upcoming" className="card p-4 sm:p-5">
        <h2 id="prices-upcoming" className="text-lg font-black">
          これから変わる<span className="ml-2 text-sm font-bold text-fg-subtle">{upcoming.length}件</span>
        </h2>
        <p className="mt-0.5 text-xs text-fg-subtle">始まる日が近い順。値上げの前に買っておく、値下げを待つ、の目安にどうぞ。</p>
        {upcoming.length ? (
          <ul className="mt-1 divide-y divide-border">
            {upcoming.map((p) => (
              <Row key={p.topicId} p={p} today={today} upcoming />
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-fg-subtle">{q || kind !== "all" ? "条件に合うものはありません。" : "いまのところ、これから始まる値上げ・値下げの報道はありません。"}</p>
        )}
      </section>
      {started.length > 0 && (
        <section aria-labelledby="prices-started" className="card p-4 sm:p-5">
          <h2 id="prices-started" className="text-lg font-black">
            すでに変わった<span className="ml-2 text-sm font-bold text-fg-subtle">{started.length}件</span>
          </h2>
          <ul className="mt-1 divide-y divide-border">
            {started.map((p) => (
              <Row key={p.topicId} p={p} today={today} upcoming={false} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
