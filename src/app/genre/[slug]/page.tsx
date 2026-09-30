import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleRanking } from "@/components/article-ranking";
import { GenreIcon } from "@/components/genre-icon";
import { Pagination, parsePage } from "@/components/pagination";
import { SectionHeading } from "@/components/section-heading";
import { TopicList } from "@/components/topic-card";
import {
  countTopics,
  countTrendingTopics,
  getGenre,
  getLatestArticles,
  getLatestTopics,
  getSocialBuzz,
  getTrendingTopics,
} from "@/lib/queries";

const PER_PAGE = 20;

export async function generateMetadata({ params }: PageProps<"/genre/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenre(slug);
  if (!genre) return {};
  return {
    title: `${genre.name}ニュース`,
    description: `${genre.name}の最新ニュースと話題を、主要メディアからまとめてお届けします。`,
    alternates: { canonical: `/genre/${genre.slug}` },
  };
}

export default async function GenrePage({ params, searchParams }: PageProps<"/genre/[slug]">) {
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
  const totalPages = Math.min(50, Math.ceil(total / PER_PAGE));
  if (page > 1 && topics.length === 0) notFound();

  const href = (p: number, s = sort) => {
    const q = new URLSearchParams();
    if (s === "latest") q.set("sort", "latest");
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return `/genre/${genre.slug}${qs ? `?${qs}` : ""}`;
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
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 text-white sm:p-6"
        style={{ background: `linear-gradient(120deg, ${color}, color-mix(in oklab, ${color} 50%, #000))` }}
      >
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
            <GenreIcon slug={genre.slug} className="h-8 w-8" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{genre.name}</h1>
            <p className="text-sm opacity-90">直近の話題 {total}件</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-black/15 p-1">
          {tab("trending", "話題順")}
          {tab("latest", "新着順")}
        </div>
      </header>

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
