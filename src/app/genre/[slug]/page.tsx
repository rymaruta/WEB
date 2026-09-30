import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleRanking } from "@/components/article-ranking";
import { Pagination, parsePage } from "@/components/pagination";
import { SectionHeading } from "@/components/section-heading";
import { TopicList } from "@/components/topic-card";
import {
  countTopics,
  countTrendingTopics,
  getGenre,
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
      className={`rounded-full px-3 py-1 text-sm font-medium ${
        sort === value ? "bg-fg text-bg" : "bg-surface-muted text-fg-muted hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <span aria-hidden className="h-5 w-1.5 rounded-full" style={{ backgroundColor: `var(--g-${genre.slug})` }} />
            {genre.name}
          </h1>
          <div className="flex gap-2">
            {tab("trending", "話題順")}
            {tab("latest", "新着順")}
          </div>
        </div>
        <TopicList topics={topics} showGenre={false} />
        <Pagination page={page} totalPages={totalPages} href={(p) => href(p)} />
      </section>
      <aside className="min-w-0">
        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading title={`SNSで話題の${genre.name}`} />
          <ArticleRanking items={buzz} metric="social" />
        </section>
      </aside>
    </div>
  );
}
