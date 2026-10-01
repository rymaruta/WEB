import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleRanking } from "@/components/article-ranking";
import { GenreIcon } from "@/components/genre-icon";
import { Pagination, parsePage } from "@/components/pagination";
import { SectionHeading } from "@/components/section-heading";
import { TopicList } from "@/components/topic-card";
import { companyPath } from "@/lib/company";
import {
  countTopics,
  getTopCompanies,
  countTrendingTopics,
  getGenre,
  getLatestArticles,
  getLatestTopics,
  getSocialBuzz,
  getTrendingTopics,
} from "@/lib/queries";

const PER_PAGE = 20;

export async function generateMetadata({ params }: PageProps<"/genre/[slug]/more">): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenre(slug);
  if (!genre) return {};
  return {
    title: `${genre.name}ニュース`,
    description: `${genre.name}の最新ニュースと話題を、主要メディアからまとめてお届けします。`,
    alternates: { canonical: `/genre/${genre.slug}` },
    // 2ページ目以降と新着順の続き。1ページ目（/genre/[slug]）と内容が重なるため検索エンジンには登録しない
    robots: { index: false, follow: true },
  };
}

export default async function GenrePage({ params, searchParams }: PageProps<"/genre/[slug]/more">) {
  const { slug } = await params;
  const sp = await searchParams;
  const genre = await getGenre(slug);
  if (!genre) notFound();

  const sort = sp.sort === "latest" ? "latest" : "trending";
  const page = parsePage(sp.page);
  const skip = (page - 1) * PER_PAGE;

  const [topics, total, buzz] = await Promise.all([
    sort === "latest"
      ? getLatestTopics({ genreId: genre.id, skip, take: PER_PAGE })
      : getTrendingTopics({ genreId: genre.id, skip, take: PER_PAGE }),
    sort === "latest" ? countTopics(genre.id) : countTrendingTopics(genre.id),
    getSocialBuzz(8, genre.id),
  ]);
  // SNS の話題シグナルがないジャンルは、代わりに新着記事を表示する
  const sidebar = buzz.length > 0 ? null : await getLatestArticles(8, genre.id);
  // 経済のページだけ、話題の企業への入口を出す（企業を追いたい人が多いジャンル）
  const companies = genre.slug === "business" ? await getTopCompanies(7, 8) : [];
  const totalPages = Math.min(50, Math.ceil(total / PER_PAGE));
  if (page > 1 && topics.length === 0) notFound();

  const href = (p: number, s = sort) => {
    const q = new URLSearchParams();
    if (s === "latest") q.set("sort", "latest");
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    // 1ページ目は、話題順・新着順をその場で切り替えられる /genre/[slug] に戻す
    if (p === 1) return `/genre/${genre.slug}${s === "latest" ? "#latest" : ""}`;
    return `/genre/${genre.slug}/more${qs ? `?${qs}` : ""}`;
  };

  const tab = (value: "trending" | "latest", label: string) => (
    <Link
      href={href(1, value)}
      aria-current={sort === value ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
        sort === value ? "bg-white text-black" : "text-white/85 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  const color = `var(--g-${genre.slug})`;

  return (
    <div className="space-y-6">
      <header
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-white sm:gap-4 sm:p-6"
        style={{ background: `linear-gradient(120deg, ${color}, color-mix(in oklab, ${color} 50%, #000))` }}
      >
        {/* スマホでは見出しの帯を低くして、最初の画面にニュースが見えるようにする */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 sm:h-14 sm:w-14 sm:rounded-2xl">
            <GenreIcon slug={genre.slug} className="h-6 w-6 sm:h-8 sm:w-8" />
          </span>
          <div>
            <h1 className="text-xl font-black tracking-tight sm:text-3xl">{genre.name}</h1>
            <p className="text-xs opacity-90 sm:text-sm">直近の話題 {total}件</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-black/15 p-1">
          {tab("trending", "話題順")}
          {tab("latest", "新着順")}
        </div>
      </header>

      {companies.length > 0 && (
        <nav aria-label="話題の企業" className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="shrink-0 text-xs font-bold text-fg-muted">話題の企業</span>
          {companies.map((c) => (
            <Link
              key={c.name}
              href={companyPath(c.name)}
              prefetch={false}
              className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold hover:border-accent hover:text-accent"
            >
              {c.name}
            </Link>
          ))}
          <Link href="/company" prefetch={false} className="shrink-0 text-xs font-bold text-accent hover:underline">
            すべて見る →
          </Link>
        </nav>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card min-w-0 px-4 sm:px-5">
          <TopicList topics={topics} showGenre={false} />
          <div className="pb-5">
            <Pagination page={page} totalPages={totalPages} href={(p) => href(p)} />
          </div>
        </section>
        <aside className="min-w-0">
          <section className="card p-4">
            {sidebar ? (
              <>
                <SectionHeading title={`${genre.name}の新着`} />
                <ArticleRanking items={sidebar} />
              </>
            ) : (
              <>
                <SectionHeading title={`SNSで話題の${genre.name}`} note="はてなブックマーク数" />
                <ArticleRanking items={buzz} metric="social" />
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
