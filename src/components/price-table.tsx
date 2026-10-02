"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PriceChange } from "@/lib/changes";

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const dateLabel = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return day ? `${y}/${m}/${day}` : `${y}/${m}月中`;
};
const rateOf = (p: PriceChange) => (p.before && p.after ? Math.round(((p.after - p.before) / p.before) * 1000) / 10 : p.rate);

/** 値上げ・値下げの一覧。会社名・品目で絞り込める */
export function PriceTable({ items }: { items: PriceChange[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "price_up" | "price_down">("all");
  const shown = useMemo(() => {
    const words = q.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
    return items
      .filter((p) => kind === "all" || p.kind === kind)
      .filter((p) => words.every((w) => `${p.title} ${p.company ?? ""}`.normalize("NFKC").toLowerCase().includes(w)))
      .slice()
      .reverse();
  }, [items, q, kind]);
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-bold ${on ? "border-accent bg-accent text-accent-fg" : "border-border text-fg-muted hover:text-fg"}`;

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
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
      <p className="mt-2 text-xs text-fg-subtle">{shown.length}件（始まる日が新しい順）</p>
      <ul className="mt-1 divide-y divide-border">
        {shown.map((p) => {
          const r = rateOf(p);
          return (
            <li key={p.topicId}>
              <Link href={`/topic/${p.topicId}`} prefetch={false} className="group flex items-start gap-3 py-2.5">
                <span className="w-20 shrink-0 text-xs text-fg-muted tabular-nums">{dateLabel(p.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug font-bold group-hover:text-accent">{p.title}</span>
                  <span className="mt-0.5 block text-xs text-fg-subtle">
                    {p.company && <span className="mr-2">{p.company}</span>}
                    {p.before && p.after && (
                      <span className="tabular-nums">
                        {yen(p.before)} → {yen(p.after)}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 text-[11px] leading-5 font-bold text-white ${p.kind === "price_up" ? "bg-red-500" : "bg-blue-500"}`}
                >
                  {p.kind === "price_up" ? "値上げ" : "値下げ"}
                  {r !== null && ` ${r > 0 ? "+" : ""}${r}%`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
