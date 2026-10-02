import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveRow } from "@/components/archive-list";
import { siteConfig } from "@/config/site";
import { DAILY_TOP, dayLabel, getDaily, isDailyKey, jstDay, MIN_INDEXABLE, shiftDay } from "@/lib/archive";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const revalidate = 900;

const yearOf = (date: string) => `${Number(date.slice(0, 4))}年`;

export async function generateMetadata({ params }: PageProps<"/daily/[date]">): Promise<Metadata> {
  const { date } = await params;
  if (!isDailyKey(date)) return {};
  const data = await getDaily(date);
  const head = data.top.slice(0, 3).map((t) => t.aiTitle ?? t.title);
  return {
    title: `${yearOf(date)}${dayLabel(date)}のニュースまとめ`,
    description: `${yearOf(date)}${dayLabel(date)}に報じられた主なニュース${data.total}件をジャンル別にまとめました。${head.join("／")}など。`.slice(0, 160),
    alternates: { canonical: `/daily/${date}` },
    robots: data.total >= MIN_INDEXABLE ? undefined : { index: false, follow: true },
  };
}

export default async function DailyPage({ params }: PageProps<"/daily/[date]">) {
  const { date } = await params;
  if (!isDailyKey(date)) notFound();
  const data = await getDaily(date);
  const today = date === jstDay(new Date());
  const prev = shiftDay(date, -1);
  const next = shiftDay(date, 1);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "日付別ニュース", path: "/daily" },
              { name: dayLabel(date), path: `/daily/${date}` },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${dayLabel(date)}のニュースまとめ`,
              itemListElement: data.top.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteConfig.url}/topic/${t.id}`, name: t.aiTitle ?? t.title })),
            },
          ]),
        }}
      />
      <header className="card p-5 sm:p-6">
        <p className="text-xs font-bold text-accent">日付別ニュース</p>
        <h1 className="mt-1 text-2xl leading-snug font-black">
          {dayLabel(date)}のニュース
          <span className="mt-1 block text-sm font-bold text-fg-muted">
            {yearOf(date)}・{data.total}件の出来事{today && "（途中経過）"}
          </span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">この日に最初に報じられた出来事を、報じた媒体の多い順にまとめました。上位{DAILY_TOP}本と、ジャンルごとの主なニュースです。</p>
        <nav aria-label="前後の日" className="mt-4 flex items-center justify-between text-sm font-bold">
          {isDailyKey(prev) ? (
            <Link href={`/daily/${prev}`} prefetch={false} className="text-accent hover:underline">
              ← {dayLabel(prev)}
            </Link>
          ) : (
            <span />
          )}
          {isDailyKey(next) && (
            <Link href={`/daily/${next}`} prefetch={false} className="text-accent hover:underline">
              {dayLabel(next)} →
            </Link>
          )}
        </nav>
      </header>

      {data.top.length === 0 ? (
        <p className="card p-6 text-sm text-fg-subtle">この日の出来事はまだありません。</p>
      ) : (
        <section className="card px-4 sm:px-5" aria-labelledby="daily-top">
          <h2 id="daily-top" className="pt-4 text-lg font-black">
            この日の主なニュース
          </h2>
          <ol className="divide-y divide-border">
            {data.top.map((t, i) => (
              <ArchiveRow key={t.id} t={t} rank={i + 1} />
            ))}
          </ol>
        </section>
      )}

      {data.sections.map((s) => (
        <section key={s.genre.id} className="card px-4 sm:px-5" aria-label={s.genre.name}>
          <h2 className="flex items-center justify-between pt-4 text-base font-black">
            <span style={{ color: `var(--g-${s.genre.slug})` }}>{s.genre.name}</span>
            <Link href={`/archive/${date.slice(0, 7)}/${s.genre.slug}`} prefetch={false} className="text-xs font-bold text-accent hover:underline">
              この月の{s.genre.name}まとめ →
            </Link>
          </h2>
          <ul className="divide-y divide-border">
            {s.items.map((t) => (
              <ArchiveRow key={t.id} t={t} showLead={false} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
