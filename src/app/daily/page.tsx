import type { Metadata } from "next";
import Link from "next/link";
import { dayLabel, recentDays } from "@/lib/archive";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "日付別ニュース｜その日の主なニュースをまとめて振り返る",
  description: "日付ごとに、その日に報じられた主なニュースをジャンル別にまとめています。過去の日のニュースも振り返れます。",
  alternates: { canonical: "/daily" },
};

export default function DailyIndexPage() {
  const days = recentDays(60);
  // 月ごとに分けて並べる
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="card p-5 sm:p-6">
        <h1 className="text-2xl font-black">日付別ニュース</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">その日に報じられた主なニュースを、日付ごとにまとめています。</p>
      </header>
      {months.map((m) => (
        <section key={m} className="card p-4 sm:p-5">
          <h2 className="mb-2 text-base font-black">
            {Number(m.slice(0, 4))}年{Number(m.slice(5, 7))}月
            <Link href={`/archive/${m}`} prefetch={false} className="ml-3 text-xs font-bold text-accent hover:underline">
              ジャンル別の月間まとめ →
            </Link>
          </h2>
          <ul className="flex flex-wrap gap-2">
            {days
              .filter((d) => d.startsWith(m))
              .map((d) => (
                <li key={d}>
                  <Link href={`/daily/${d}`} prefetch={false} className="inline-block rounded-full border border-border px-3 py-1 text-xs font-bold hover:border-accent hover:text-accent">
                    {dayLabel(d)}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
