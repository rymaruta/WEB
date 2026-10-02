import type { Metadata } from "next";
import Link from "next/link";
import { FEATURE_KINDS, featurePath, getFeature, jstMonth } from "@/lib/features";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "特集｜今月から変わること・発売のゲーム・始まるアニメ",
  description: "ニュースで報じられた日付をもとに、今月・来月に始まる値上げや制度の変更、発売されるゲーム、始まるアニメを一覧にした特集です。",
  alternates: { canonical: "/feature" },
};

export default async function FeatureIndexPage() {
  const months = [jstMonth(), jstMonth(new Date(), 1)];
  const features = await Promise.all(months.flatMap((m) => FEATURE_KINDS.map((k) => getFeature(k, m))));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="card p-5 sm:p-6">
        <h1 className="text-2xl font-black">特集</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          ニュースで報じられた日付をもとに、今月・来月に始まることを1ページにまとめました。毎日自動で更新しています。
        </p>
        <p className="mt-3 text-sm">
          <Link href="/calendar" prefetch={false} className="font-bold text-accent hover:underline">
            すべての分野を1つにまとめた「ぜんぶカレンダー」 →
          </Link>
        </p>
      </header>
      {/* 月ごとに見出しを付けて分ける（今月と来月の特集を混ぜて並べない） */}
      {months.map((month) => (
        <section key={month} aria-labelledby={`feature-${month}`}>
          <h2 id={`feature-${month}`} className="mb-2 text-lg font-black">
            {Number(month.slice(5, 7))}月の特集
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {features
              .filter((f) => f.month === month)
              .map((f) => (
                <li key={`${f.kind}-${f.month}`}>
                  <Link href={featurePath(f.kind, f.month)} prefetch={false} className="card group block h-full p-4 hover:border-accent">
                    <p className="text-xs font-bold" style={{ color: `var(--g-${f.genreSlug})` }}>
                      {f.items.length}件
                    </p>
                    <h3 className="mt-1 leading-snug font-bold group-hover:text-accent">{f.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{f.description}</p>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
