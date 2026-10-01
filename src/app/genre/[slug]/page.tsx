import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleRanking } from "@/components/article-ranking";
import { GenreIcon } from "@/components/genre-icon";
import { Pagination } from "@/components/pagination";
import { SectionHeading } from "@/components/section-heading";
import { TopicList } from "@/components/topic-card";
import { GameHighlights } from "@/components/game-highlights";
import { companyPath } from "@/lib/company";
import {
  countTopics,
  getTopCompanies,
  countTrendingTopics,
  getGameReleases,
  getGenre,
  getNewGames,
  getLatestArticles,
  getLatestTopics,
  getSocialBuzz,
  getTrendingTopics,
} from "@/lib/queries";

import { SortButtons, SortPanels } from "./sort-tabs";

const PER_PAGE = 20;

/** 話題順・新着順の1ページ目をまとめて作り、キャッシュする（切り替えは画面の中で行う） */
export const revalidate = 60;

/** ビルド時には生成せず、初回アクセス時に生成して ISR でキャッシュする */
export async function generateStaticParams() {
  return [];
}

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

export default async function GenrePage({ params }: PageProps<"/genre/[slug]">) {
  const { slug } = await params;
  const genre = await getGenre(slug);
  if (!genre) notFound();

  const [trending, latest, trendingTotal, latestTotal, buzz] = await Promise.all([
    getTrendingTopics({ genreId: genre.id, take: PER_PAGE }),
    getLatestTopics({ genreId: genre.id, take: PER_PAGE }),
    countTrendingTopics(genre.id),
    countTopics(genre.id),
    getSocialBuzz(8, genre.id),
  ]);
  // SNS の話題シグナルがないジャンルは、代わりに新着記事を表示する
  const sidebar = buzz.length > 0 ? null : await getLatestArticles(8, genre.id);
  // 経済のページだけ、話題の企業への入口を出す（企業を追いたい人が多いジャンル）
  const companies = genre.slug === "business" ? await getTopCompanies(7, 8) : [];
  // ゲームのページだけ、発売スケジュール（今月・来月）と新着ゲームを出す
  const game = genre.slug === "game" ? await loadGameHighlights() : null;
  const pages = (total: number) => Math.min(50, Math.ceil(total / PER_PAGE));
  // 2ページ目以降は別のページ（/genre/[slug]/more）で読み込む
  const href = (sort: "trending" | "latest") => (p: number) =>
    p === 1 ? `/genre/${genre.slug}${sort === "latest" ? "#latest" : ""}` : `/genre/${genre.slug}/more?${new URLSearchParams({ ...(sort === "latest" ? { sort } : {}), page: String(p) })}`;
  const total = trendingTotal;

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
        <SortButtons />
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

      {game && <GameHighlights {...game} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card min-w-0 px-4 sm:px-5">
          <SortPanels
            trending={
              <>
                <TopicList topics={trending} showGenre={false} />
                <div className="pb-5">
                  <Pagination page={1} totalPages={pages(trendingTotal)} href={href("trending")} />
                </div>
              </>
            }
            latest={
              <>
                <TopicList topics={latest} showGenre={false} />
                <div className="pb-5">
                  <Pagination page={1} totalPages={pages(latestTotal)} href={href("latest")} />
                </div>
              </>
            }
          />
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

/** 日本時間の今月・来月（YYYY-MM） */
function jstMonths(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3_600_000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const key = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}`;
  return { year: y, thisKey: key(y, m), nextKey: key(next.y, next.m), labels: [`今月（${m}月）`, `来月（${next.m}月）`] as [string, string] };
}

async function loadGameHighlights() {
  const [releases, newGames] = await Promise.all([getGameReleases(), getNewGames(7, 6)]);
  const { year, thisKey, nextKey, labels } = jstMonths();
  const pick = (r: (typeof releases)[number]) => ({ topicId: r.topicId, title: r.title, release: r.release, platforms: r.platforms });
  return {
    thisMonth: releases.filter((r) => r.release.startsWith(thisKey)).map(pick),
    nextMonth: releases.filter((r) => r.release.startsWith(nextKey)).map(pick),
    newGames: newGames.map((t) => ({
      topicId: t.id,
      headline: t.aiTitle ?? t.title,
      kind: t.aiGameKind,
      release: t.aiGameRelease,
      platforms: t.aiGamePlatforms,
    })),
    thisYear: year,
    monthLabels: labels,
  };
}
