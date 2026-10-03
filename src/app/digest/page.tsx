import type { Metadata } from "next";
import Link from "next/link";
import { digestPath, listPublishedDigests } from "@/lib/digest/archive";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "配信アーカイブ",
  description: "X で配信した「朝のニュース」などの過去の回をまとめて読めます。",
  alternates: { canonical: "/digest" },
};

const MARK = { MORNING: "☀️", LUNCH: "🕛", EVENING: "🌙" } as const;

/** 定時配信の過去の回の一覧（日付ごと） */
export default async function DigestArchivePage() {
  const list = await listPublishedDigests(90);
  const byDate = new Map<string, typeof list>();
  for (const d of list) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight">配信アーカイブ</h1>
        <p className="mt-1 text-sm text-fg-muted">毎朝 7:00 に知っておきたいニュースを3本、日中は大きなニュースを1本ずつ配信しています。</p>
      </header>
      {byDate.size === 0 ? (
        <p className="card p-6 text-sm text-fg-subtle">まだ配信した回はありません。</p>
      ) : (
        [...byDate].map(([date, items]) => (
          <section key={date} className="card p-4">
            <h2 className="mb-2 text-base font-black">{items[0].dateLabel}</h2>
            <ul className="divide-y divide-border">
              {items.map((d) => (
                <li key={d.slot}>
                  <Link href={digestPath(d.date, d.slot)} className="block py-3 hover:bg-surface-muted">
                    <span className="text-sm font-bold">
                      <span aria-hidden className="mr-1">{MARK[d.slot]}</span>
                      {d.title}
                      <span className="ml-2 text-xs font-medium text-fg-subtle">{d.time}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-fg-muted">{d.headlines.join(" ／ ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
