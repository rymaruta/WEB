import { AdsenseScript } from "@/components/adsense-script";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveRow } from "@/components/archive-list";
import { siteConfig } from "@/config/site";
import { archiveMonths, getMonthlyGenre, isArchiveMonth, MIN_INDEXABLE, monthLabel } from "@/lib/archive";
import { getGenres } from "@/lib/queries";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const revalidate = 1800;

export async function generateMetadata({ params }: PageProps<"/archive/[month]/[genre]">): Promise<Metadata> {
  const { month, genre } = await params;
  if (!isArchiveMonth(month)) return {};
  const data = await getMonthlyGenre(month, genre);
  if (!data) return {};
  const head = data.items.slice(0, 3).map((t) => t.aiTitle ?? t.title);
  return {
    title: `${monthLabel(month)}の${data.genre.name}ニュースまとめ`,
    description: `${monthLabel(month)}に報じられた${data.genre.name}の主なニュースを、報じた媒体の多い順にまとめました。${head.join("／")}など。`.slice(0, 160),
    alternates: { canonical: `/archive/${month}/${genre}` },
    robots: data.items.length >= MIN_INDEXABLE ? undefined : { index: false, follow: true },
  };
}

export default async function MonthlyGenrePage({ params }: PageProps<"/archive/[month]/[genre]">) {
  const { month, genre } = await params;
  if (!isArchiveMonth(month)) notFound();
  const [data, genres] = await Promise.all([getMonthlyGenre(month, genre), getGenres()]);
  if (!data) notFound();
  const months = archiveMonths();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 広告は、検索エンジンに登録する（内容のある）ページだけ。移動用の一覧や中身の少ないページには出さない */}
      {data.items.length >= MIN_INDEXABLE && <AdsenseScript />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "月間まとめ", path: `/archive/${month}` },
              { name: `${monthLabel(month)}の${data.genre.name}`, path: `/archive/${month}/${genre}` },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${monthLabel(month)}の${data.genre.name}ニュース`,
              itemListElement: data.items.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteConfig.url}/topic/${t.id}`, name: t.aiTitle ?? t.title })),
            },
          ]),
        }}
      />
      <header className="card p-5 sm:p-6">
        <p className="text-xs font-bold" style={{ color: `var(--g-${data.genre.slug})` }}>
          月間まとめ
        </p>
        <h1 className="mt-1 text-2xl leading-snug font-black">
          {monthLabel(month)}の{data.genre.name}ニュース
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">この月に最初に報じられた{data.genre.name}の出来事を、報じた媒体の多い順に{data.items.length}本まとめました。</p>
        <nav aria-label="ほかのジャンル" className="mt-3 flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <Link
              key={g.slug}
              href={`/archive/${month}/${g.slug}`}
              prefetch={false}
              aria-current={g.slug === genre ? "page" : undefined}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${g.slug === genre ? "border-accent bg-accent text-accent-fg" : "border-border text-fg-muted hover:border-accent hover:text-accent"}`}
            >
              {g.name}
            </Link>
          ))}
        </nav>
      </header>
      {data.items.length === 0 ? (
        <p className="card p-6 text-sm text-fg-subtle">この月の出来事はまだありません。</p>
      ) : (
        <ol className="card divide-y divide-border px-4 sm:px-5">
          {data.items.map((t, i) => (
            <ArchiveRow key={t.id} t={t} rank={i + 1} />
          ))}
        </ol>
      )}
      {months.length > 1 && (
        <nav aria-label="ほかの月" className="card p-4">
          <h2 className="text-sm font-bold text-fg-muted">ほかの月の{data.genre.name}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {months.map((m) => (
              <li key={m}>
                <Link href={`/archive/${m}/${genre}`} prefetch={false} className="inline-block rounded-full border border-border px-3 py-1 text-xs font-bold hover:border-accent hover:text-accent">
                  {monthLabel(m)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
