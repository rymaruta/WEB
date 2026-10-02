import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GenreBadge } from "@/components/genre-badge";
import { siteConfig } from "@/config/site";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { getWeekly, isWeeklyKey, recentWeeks, weekKey, weekLabel } from "@/lib/weekly";

export const revalidate = 900;

export async function generateMetadata({ params }: PageProps<"/weekly/[week]">): Promise<Metadata> {
  const { week } = await params;
  if (!isWeeklyKey(week)) return {};
  const title = `今週の10大ニュース（${weekLabel(week)}）`;
  const description = `${weekLabel(week)}に最も多くの媒体が報じたニュースを10本、まとめ記事の要約つきで振り返ります。`;
  return {
    title,
    description,
    alternates: { canonical: `/weekly/${week}` },
    openGraph: { title, description, type: "article", siteName: siteConfig.name, locale: "ja_JP" },
  };
}

export default async function WeeklyPage({ params }: PageProps<"/weekly/[week]">) {
  const { week } = await params;
  if (!isWeeklyKey(week)) notFound();
  const data = await getWeekly(week);
  if (!data) notFound();
  const current = week === weekKey();
  const weeks = recentWeeks(6);
  const label = weekLabel(week);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "今週の10大ニュース", path: `/weekly/${week}` },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `今週の10大ニュース（${label}）`,
              itemListElement: data.items.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteConfig.url}/topic/${t.id}`, name: t.aiTitle ?? t.title })),
            },
          ]),
        }}
      />
      <header className="card p-5 sm:p-6">
        <p className="text-xs font-bold text-accent">週刊まとめ</p>
        <h1 className="mt-1 text-2xl leading-snug font-black">
          今週の10大ニュース
          <span className="mt-1 block text-base font-bold text-fg-muted">
            {label}
            {current && "（途中経過）"}
          </span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          この週に最初に報じられた出来事を、報じた媒体の多い順に並べました（同じジャンルは3本まで）。忙しくてニュースを追えなかった週も、ここを読めば大きな出来事を押さえられます。
          {current && "週の途中は、新しい報道に合わせて順位が入れ替わります。"}
        </p>
      </header>

      {data.items.length === 0 ? (
        <p className="card p-6 text-sm text-fg-subtle">この週の出来事はまだありません。</p>
      ) : (
        <ol className="space-y-3">
          {data.items.map((t, i) => (
            <li key={t.id} className="card flex gap-4 p-4 sm:p-5">
              <span className="w-8 shrink-0 text-3xl leading-none font-black text-accent tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/topic/${t.id}`} prefetch={false} className="text-[17px] leading-snug font-black hover:text-accent">
                  {t.aiTitle ?? t.title}
                </Link>
                {t.aiLead && <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{t.aiLead}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                  <GenreBadge genre={t.genre} />
                  <span>
                    <strong className="text-sm font-black text-accent tabular-nums">{t.publisherCount}</strong>媒体が報道
                  </span>
                  <span>{t.articleCount}本の記事</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {weeks.length > 1 && (
        <nav aria-label="ほかの週" className="card p-4">
          <h2 className="text-sm font-bold text-fg-muted">ほかの週</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {weeks.map((w) => (
              <li key={w}>
                <Link
                  href={`/weekly/${w}`}
                  prefetch={false}
                  aria-current={w === week ? "page" : undefined}
                  className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${w === week ? "border-accent bg-accent text-accent-fg" : "border-border hover:border-accent hover:text-accent"}`}
                >
                  {weekLabel(w)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
