import { ArticleRanking } from "@/components/article-ranking";
import { CalendarPreview } from "@/components/calendar-preview";
import { DigestSummaryCard } from "@/components/digest-summary";
import { FeatureNav } from "@/components/feature-nav";
import { Fold } from "@/components/fold";
import { SideFold } from "@/components/side-fold";
import { SinceLastVisit } from "@/components/since-last-visit";
import { SectionHeading } from "@/components/section-heading";
import { HeroTopic, TopicCard, TopicList } from "@/components/topic-card";
import { getCalendar, jstDate } from "@/lib/calendar";
import { getLatestDigest, isFreshDigest } from "@/lib/digest/latest";
import { formatNumber } from "@/lib/format";
import { serializeJsonLd, siteJsonLd } from "@/lib/structured-data";
import Link from "next/link";
import { companyPath } from "@/lib/company";
import { getGenres, getLatestArticles, getMostRead, getPinnedTopic, getSiteStats, getSocialBuzz, getTopCompanies, getTrendingTopics } from "@/lib/queries";

export const revalidate = 60;

/** 一番上の大きな枠に優先して置くジャンル（多くの読者に関わる出来事） */
const HERO_GENRES = new Set(["domestic", "world", "business", "tech"]);

export default async function HomePage() {
  const [genres, headline, mostRead, buzz, latest, stats, companies, digest, calendar, pinned] = await Promise.all([
    getGenres(),
    getTrendingTopics({ minPublishers: 2, take: 9 }),
    getMostRead(8),
    getSocialBuzz(8),
    getLatestArticles(8),
    getSiteStats(),
    getTopCompanies(7, 8),
    // 配信の失敗でトップ全体を止めない
    getLatestDigest().catch(() => null),
    // ぜんぶカレンダーの入口（この1週間）。失敗してもトップは出す
    getCalendar(new Date(), 7).catch(() => null),
    // 運営者が固定した大きな出来事（一番上に出す）
    getPinnedTopic().catch(() => null),
  ]);

  const headlineIds = [...headline.map((t) => t.id), ...(pinned ? [pinned.id] : [])];
  const sections = await Promise.all(
    genres.map(async (genre) => ({
      genre,
      topics: await getTrendingTopics({ genreId: genre.id, take: 5, excludeIds: headlineIds }),
    })),
  );

  // 一番上は、まとめ記事があり、多くの読者に関わるジャンルの話題を優先する（なければ話題度の1位）
  // 運営者が固定した出来事があれば、それを一番上にする
  const lead = pinned ?? headline.find((t) => t.aiTitle && HERO_GENRES.has(t.genre.slug)) ?? headline[0];
  const others = headline.filter((t) => t.id !== lead?.id);
  // 配信したばかりの回は一番上に。時間がたった回は「いま話題」の下に回し、開いてすぐ今のニュースが見えるようにする
  const digestOnTop = digest ? isFreshDigest(digest) : false;

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(siteJsonLd()) }} />
      {/* ページの見出しはサイト名（画面では上のロゴがサイト名を示しているため、読み上げと検索エンジン向けに置く） */}
      <h1 className="sr-only">ぜんぶナビ｜主要メディアのニュースをまとめて読めるニュースサイト</h1>
      {/* X で配信した最新の回（朝・昼・夜のニュース）。X から来た人が同じ形で続きを読めるように一番上に置く */}
      <SinceLastVisit />
      {digest && digestOnTop && <DigestSummaryCard digest={digest} />}
      <section aria-labelledby="trending">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="trending" className="text-2xl font-black tracking-tight">いま話題のニュース</h2>
            <p className="mt-0.5 text-xs text-fg-subtle">複数の媒体が報じている出来事を、話題の大きさ順にまとめています。</p>
          </div>
          <p className="flex gap-4 text-xs text-fg-muted">
            <span>
              直近24時間 <strong className="text-base font-black text-fg tabular-nums">{formatNumber(stats.articles24h)}</strong> 件
            </span>
            <span>
              <strong className="text-base font-black text-fg tabular-nums">{stats.publishers}</strong> 媒体から収集
            </span>
          </p>
        </div>

        {lead ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <HeroTopic topic={lead} />
              {/* 2本目からは写真の小さい詰めた並びにして、スマホでも一目で数本見えるようにする */}
              {others.length > 0 && (
                <div className="card divide-y divide-border px-4">
                  {others.map((t) => (
                    <TopicCard key={t.id} topic={t} />
                  ))}
                </div>
              )}
              {digest && !digestOnTop && <DigestSummaryCard digest={digest} />}
              {/* スマホではサイドバーが一番下になるため、ランキングを話題の一覧の後に出す */}
              <section className="card p-4 lg:hidden">
                {mostRead.length > 0 ? (
                  <>
                    <SectionHeading title="よく読まれている" href="/ranking" moreLabel="ランキング" />
                    <ArticleRanking items={mostRead.slice(0, 5)} metric="clicks" />
                  </>
                ) : (
                  <>
                    <SectionHeading title="SNSで話題" note="はてなブックマーク数" href="/ranking" moreLabel="ランキング" />
                    <ArticleRanking items={buzz.slice(0, 5)} metric="social" showGenre />
                  </>
                )}
              </section>
            </div>
            <aside className="min-w-0 space-y-6">
              {mostRead.length > 0 && (
                <section className="card hidden p-4 lg:block">
                  <SectionHeading title="よく読まれている" href="/ranking" moreLabel="ランキング" />
                  <ArticleRanking items={mostRead} metric="clicks" />
                </section>
              )}
              {/* スマホでは一番下に来るため、最初は閉じておく（見出しを押すと開く） */}
              <SideFold id="home-buzz" title="SNSで話題" note="はてなブックマーク数">
                <ArticleRanking items={buzz} metric="social" showGenre />
              </SideFold>
              <SideFold id="home-latest" title="新着">
                <ArticleRanking items={latest} showGenre />
              </SideFold>
            </aside>
          </div>
        ) : (
          <p className="card p-6 text-sm text-fg-subtle">ニュースを準備しています。しばらくしてから再度お越しください。</p>
        )}
      </section>

      {/* ぜんぶカレンダーの入口。今日と明日の予定を見せる（このサイトにしかない一覧なので、ニュースのすぐ下に置く） */}
      {calendar && calendar.items.length > 0 && (
        <CalendarPreview today={calendar.from} tomorrow={jstDate(new Date(), 1)} items={calendar.items} weekCount={calendar.items.length} />
      )}

      {/* 特集への入口（今月・来月に始まること・発売のゲーム・始まるアニメの一覧） */}
      <section className="card px-4 py-3" aria-labelledby="home-features">
        <Link href="/feature" prefetch={false} id="home-features" className="text-sm font-extrabold hover:text-accent">
          特集
        </Link>
        <FeatureNav className="mt-2" />
      </section>

      {/* 企業別ニュースへの入口。この1週間によく取り上げられた企業を並べる */}
      {companies.length > 0 && (
        <Fold
          id="home-companies"
          className="card px-4 py-3"
          summary={
            <Link href="/company" prefetch={false} className="text-sm font-extrabold hover:text-accent">
              企業別ニュース
            </Link>
          }
        >
          <nav aria-label="話題の企業" className="mt-2 flex flex-wrap items-center gap-2">
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
        </Fold>
      )}

      <section aria-labelledby="by-genre">
        <h2 id="by-genre" className="mb-1 text-xl font-black tracking-tight">ジャンル別ニュース</h2>
        <p className="mb-3 text-xs text-fg-subtle md:hidden">横にスワイプすると、ほかのジャンルが見られます</p>
        {/* スマホでは横に並べてスワイプで見る（縦に10ジャンル並べるとトップが長くなりすぎるため）。広い画面では格子に並べる */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:mx-0 md:grid md:snap-none md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
          {sections.map(({ genre, topics }) => {
            const [top, ...more] = topics;
            return (
              <section key={genre.id} aria-label={genre.name} className="card flex w-[85%] min-w-0 shrink-0 snap-start flex-col p-4 md:w-auto">
                <SectionHeading title={genre.name} href={`/genre/${genre.slug}`} genreSlug={genre.slug} />
                {top ? (
                  <>
                    <div className="border-b border-border">
                      <TopicCard topic={top} showGenre={false} />
                    </div>
                    <TopicList topics={more.slice(0, 2)} variant="compact" showGenre={false} />
                    {/* スマホでは各ジャンル3本までにして、トップが縦に長くなりすぎないようにする */}
                    {more.length > 2 && (
                      <div className="hidden border-t border-border md:block">
                        <TopicList topics={more.slice(2)} variant="compact" showGenre={false} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="py-6 text-sm text-fg-subtle">直近のニュースはありません。</p>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
